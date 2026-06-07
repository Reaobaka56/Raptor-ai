import json
import os
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
import asyncio

from ..models import Review, ReviewIssue
from .github_app import github_app_service  # local import path


async def run_scan(target: str, github_token: Optional[str] = None) -> Review:
    """Run a full repository/PR scan and return a Review model.
    This function mirrors the previous scan logic extracted from main.py so it
    can be called directly from the webhook handler and the /api/scan endpoint.
    """
    # parse target (owner/repo or URL)
    from ..main import parse_github_scan_target, get_github_auth_headers

    repo_name, requested_pr_number = parse_github_scan_target(target)

    try:
        app_token = github_app_service.get_installation_token_for_repo(repo_name)
        if app_token:
            github_token = app_token
    except Exception:
        pass

    if not github_token:
        # fallback to configured PAT/GITHUB_TOKEN
        from ..main import get_configured_github_token

        github_token = get_configured_github_token()

    github_headers = get_github_auth_headers(github_token)

    # Fetch PR or latest commit info
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if requested_pr_number:
                pr_res = await client.get(
                    f"https://api.github.com/repos/{repo_name}/pulls/{requested_pr_number}",
                    headers=github_headers,
                )
                pr_res.raise_for_status()
                pr_data = pr_res.json()
                pr_number = int(pr_data["number"])
                pr_title = pr_data.get("title") or f"Pull request #{pr_number}"
                pr_url = pr_data.get("html_url") or f"https://github.com/{repo_name}/pull/{pr_number}"
                diff_url = pr_data.get("diff_url") or f"{pr_url}.diff"
            else:
                pulls_res = await client.get(
                    f"https://api.github.com/repos/{repo_name}/pulls?state=open&sort=updated&direction=desc&per_page=1",
                    headers=github_headers,
                )
                pulls_res.raise_for_status()
                pulls_data = pulls_res.json()
                if pulls_data:
                    pr_data = pulls_data[0]
                    pr_number = int(pr_data["number"])
                    pr_title = pr_data.get("title") or f"Pull request #{pr_number}"
                    pr_url = pr_data.get("html_url") or f"https://github.com/{repo_name}/pull/{pr_number}"
                    diff_url = pr_data.get("diff_url") or f"{pr_url}.diff"
                else:
                    commits_res = await client.get(
                        f"https://api.github.com/repos/{repo_name}/commits?per_page=1",
                        headers=github_headers,
                    )
                    commits_res.raise_for_status()
                    commits_data = commits_res.json()
                    if not commits_data:
                        raise Exception("No pull requests or commits found for this repository")
                    latest_commit = commits_data[0]
                    sha = latest_commit["sha"]
                    pr_number = 0
                    pr_title = latest_commit["commit"]["message"]
                    pr_url = f"https://github.com/{repo_name}/commit/{sha}"
                    diff_url = f"{pr_url}.diff"

                # Fetch diff
            diff_res = await client.get(diff_url, headers=github_headers)
            diff_res.raise_for_status()
            diff_text = diff_res.text

        # Analyze via ai_service (blocking Gemini SDK) in a thread
        from ..services.ai_service import ai_service as real_ai_service

        ai_result = await asyncio.to_thread(
            real_ai_service.analyze_pr, repo_name, pr_number, pr_title, diff_text
        )

        new_review = Review(
            id=str(uuid.uuid4()),
            githubRepo=repo_name,
            prNumber=pr_number,
            prTitle=pr_title,
            prUrl=pr_url,
            issues=[ReviewIssue(**issue) for issue in ai_result.get("issues", [])],
            summary=ai_result.get("summary", "LLM analysis completed"),
            status="completed",
            reviewTimeMs=ai_result.get("reviewTimeMs", 0),
            createdAt=datetime.now(timezone.utc).isoformat(),
        )

        # Memory integration (best-effort)

        try:
            from .embedding_service import generate_embedding
            from . import memory_service

            issue_titles = " | ".join(i.title for i in new_review.issues) or "No issues"
            review_text = f"{new_review.summary or ''} {issue_titles}"
            embedding = generate_embedding(review_text)

            # run DB/memory operations in thread to avoid blocking
            await asyncio.to_thread(
                memory_service.store_review_embedding,
                new_review.id,
                repo_name,
                new_review.prNumber,
                issue_titles,
                new_review.summary or "",
                embedding,
            )

        except Exception:
            # swallow memory errors — not critical for scan
            pass

        return new_review

    except Exception as exc:
        raise
