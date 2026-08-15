import json
import os
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx

from ..models import Review, ReviewIssue


async def post_pr_review(
    repo_name: str,
    pr_number: int,
    issues: list,
    summary: str,
    github_token: str,
    commit_sha: str,
) -> None:
    """
    Post a single GitHub PR review with all issues as inline comments.
    Uses the Pull Request Reviews API so all comments appear as one review block.
    """
    from ..github_utils import get_github_auth_headers

    headers = get_github_auth_headers(github_token)
    headers["Content-Type"] = "application/json"

    # Build inline comments for issues that have a file + line
    comments = []
    for issue in issues:
        if issue.get("file") and issue.get("line"):
            severity_emoji = {
                "critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"
            }.get(issue.get("severity", "medium"), "🟡")

            category_label = {
                "security": "Security", "performance": "Performance",
                "quality": "Code Quality", "design": "Design"
            }.get(issue.get("category", "quality"), "Issue")

            body = (
                f"{severity_emoji} **{category_label}: {issue['title']}**\n\n"
                f"{issue['description']}\n\n"
            )
            if issue.get("suggestion"):
                body += f"**Suggested fix:**\n```\n{issue['suggestion']}\n```\n"

            comments.append({
                "path": issue["file"],
                "line": int(issue["line"]),
                "side": "RIGHT",
                "body": body,
            })

    # Build overall review body
    issue_count = len(issues)
    critical = sum(1 for i in issues if i.get("severity") == "critical")
    high = sum(1 for i in issues if i.get("severity") == "high")

    if issue_count == 0:
        review_state = "APPROVE"
        review_body = f"✅ **Raptor AI Review — No issues found**\n\n{summary or 'This PR looks clean.'}"
    elif critical > 0:
        review_state = "REQUEST_CHANGES"
        review_body = (
            f"🔴 **Raptor AI Review — {issue_count} issue(s) found ({critical} critical)**\n\n"
            f"{summary or ''}\n\n"
            f"Please address the critical issues before merging."
        )
    else:
        review_state = "COMMENT"
        review_body = (
            f"🟡 **Raptor AI Review — {issue_count} issue(s) found**\n\n"
            f"{summary or ''}"
        )

    payload = {
        "commit_id": commit_sha,
        "body": review_body,
        "event": review_state,
        "comments": comments,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"https://api.github.com/repos/{repo_name}/pulls/{pr_number}/reviews",
            headers=headers,
            json=payload,
        )
        if resp.status_code not in (200, 201):
            # Log but don't raise — scan result is still saved to DB
            import logging
            logging.getLogger(__name__).warning(
                "Failed to post PR review: %s %s", resp.status_code, resp.text[:200]
            )


async def run_scan(
    target: str,
    github_token: Optional[str] = None,
    pr_number_override: Optional[int] = None,
    post_comments: bool = True,
) -> Review:
    """
    Run a full repository/PR scan and return a Review model.
    If post_comments=True and a github_token is available, posts an inline
    GitHub PR review after analysis.
    """
    from ..github_utils import parse_github_scan_target, get_github_auth_headers
    from ..auth_dependencies import get_configured_github_token

    repo_name, requested_pr_number = parse_github_scan_target(target)

    # Override PR number if provided by the webhook
    if pr_number_override is not None:
        requested_pr_number = pr_number_override

    # Try to get a GitHub App installation token first
    try:
        from .github_app import github_app_service
        app_token = github_app_service.get_installation_token_for_repo(repo_name)
        if app_token:
            github_token = app_token
    except Exception:
        pass

    if not github_token:
        github_token = get_configured_github_token()

    github_headers = get_github_auth_headers(github_token)

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
                commit_sha = pr_data.get("head", {}).get("sha", "")
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
                    commit_sha = pr_data.get("head", {}).get("sha", "")
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
                    pr_number = 1
                    pr_title = latest_commit["commit"]["message"]
                    pr_url = f"https://github.com/{repo_name}/commit/{sha}"
                    diff_url = f"{pr_url}.diff"
                    commit_sha = sha

            diff_res = await client.get(diff_url, headers=github_headers)
            diff_res.raise_for_status()
            diff_text = diff_res.text

        # Analyze via ai_service in a thread
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

        # Post inline comments back to GitHub PR
        if post_comments and github_token and commit_sha and requested_pr_number:
            try:
                await post_pr_review(
                    repo_name=repo_name,
                    pr_number=pr_number,
                    issues=[i.dict() for i in new_review.issues],
                    summary=new_review.summary or "",
                    github_token=github_token,
                    commit_sha=commit_sha,
                )
            except Exception:
                import logging
                logging.getLogger(__name__).exception("Failed to post PR review comments")

        # Memory integration (best-effort)
        try:
            from .embedding_service import generate_embedding
            from . import memory_service

            issue_titles = " | ".join(i.title for i in new_review.issues) or "No issues"
            review_text = f"{new_review.summary or ''} {issue_titles}"
            embedding = generate_embedding(review_text)

            await memory_service.store_review_embedding(
                new_review.id,
                repo_name,
                new_review.prNumber,
                issue_titles,
                new_review.summary or "",
                embedding,
            )
        except Exception:
            pass

        return new_review

    except Exception as exc:
        raise
