from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks
import hmac
import hashlib
import os
import json
import logging
import time
from typing import Optional

router = APIRouter(prefix="/webhook", tags=["GitHub Webhook"])


def verify_signature(payload_body: bytes, signature_header: str, secret: str) -> bool:
    """Verify X-Hub-Signature-256 using the shared secret."""
    if not signature_header or "=" not in signature_header:
        return False
    sha_name, signature = signature_header.split("=", 1)
    if sha_name != "sha256":
        return False
    mac = hmac.new(secret.encode(), msg=payload_body, digestmod=hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), signature)


@router.post("/github", status_code=200)
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: Optional[str] = Header(None),
    x_github_event: Optional[str] = Header(None),
):
    """
    Handle GitHub webhook events.
    - Verifies HMAC-SHA256 signature
    - Logs the event
    - For PR opened/synchronize/reopened: triggers full AI review as background task
      and posts inline comments back to the PR
    """
    secret = os.getenv("GITHUB_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    body = await request.body()

    if not x_hub_signature_256 or not verify_signature(body, x_hub_signature_256, secret):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Log to the shared Redis-backed webhook log (visible from any instance)
    from ..state import append_webhook_log
    from ..models import WebhookLogItem

    event_log = WebhookLogItem(
        id=f"wh_{int(time.time() * 1000)}",
        repo=payload.get("repository", {}).get("full_name", "unknown"),
        event=x_github_event or payload.get("action", "unknown"),
        status=200,
        time="just now",
    )
    try:
        append_webhook_log(event_log)
    except Exception:
        # Best-effort logging only — never fail webhook processing (which
        # GitHub retries on non-2xx) just because the log write failed.
        logging.getLogger(__name__).exception("[webhook] failed to persist webhook log entry")

    # Only process PR events we care about
    action = payload.get("action", "")
    pr_data = payload.get("pull_request")

    if pr_data and action in {"opened", "synchronize", "reopened"}:
        repo_full_name = payload["repository"]["full_name"]
        pr_number = int(pr_data["number"])
        commit_sha = pr_data.get("head", {}).get("sha", "")

        from ..services.scan_service import run_scan

        async def _scan_and_comment():
            try:
                await run_scan(
                    target=repo_full_name,
                    pr_number_override=pr_number,
                    post_comments=True,
                    # No github_token here — scan_service will use the GitHub App
                    # installation token or fall back to GITHUB_TOKEN env var
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(
                    "Webhook scan failed for %s#%s: %s", repo_full_name, pr_number, e
                )

        background_tasks.add_task(_scan_and_comment)

    return {"status": "received", "event": x_github_event}
