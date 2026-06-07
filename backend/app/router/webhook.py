from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks
import hmac
import hashlib
import os
import json
import time
from typing import Optional
import importlib
from ..services.github_app import github_app_service
router = APIRouter(prefix="/webhook", tags=["GitHub Webhook"])

def verify_signature(payload_body: bytes, signature_header: str, secret: str) -> bool:
    """Verify X-Hub-Signature-256 using the shared secret.
    Returns True if valid, else False.
    """
    sha_name, signature = signature_header.split('=')
    if sha_name != 'sha256':
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
    """Handle GitHub webhook events for pull requests.
    Verifies signature, logs event, and triggers a scan for opened/edited PRs.
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

    # Basic logging to in‑memory list for demo purposes
    # Lazy import to avoid circular dependency
    main_module = importlib.import_module('backend.app.main')
    LIVE_WEBHOOK_LOGS = getattr(main_module, 'LIVE_WEBHOOK_LOGS')
    WebhookLogItem = getattr(main_module, 'WebhookLogItem')
    event_log = WebhookLogItem(
        id=f"wh_{int(time.time()*1000)}",
        repo=payload.get("repository", {}).get("full_name", "unknown"),
        event=x_github_event or payload.get("action", "unknown"),
        status=200,
        time="just now",
    )
    LIVE_WEBHOOK_LOGS.append(event_log)

    # Process only pull request events we care about
    if payload.get("pull_request") and payload.get("action") in {"opened", "synchronize", "reopened"}:
        repo_full_name = payload["repository"]["full_name"]
        pr_number = payload["pull_request"]["number"]
        # Call scan_service.run_scan directly to avoid internal HTTP call which breaks multi-worker setups
        from ..services.scan_service import run_scan

        # BackgroundTasks supports async callables; schedule the coroutine with the repo argument
        background_tasks.add_task(run_scan, repo_full_name)

    return {"status": "received"}
