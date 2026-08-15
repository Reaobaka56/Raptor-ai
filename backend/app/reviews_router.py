import requests
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List, Optional
from types import SimpleNamespace

from .auth_dependencies import get_required_github_session
from .models import Review, CreatePRResponse, RepositoryInfo
from .services.db import get_conn, release_conn
from .services.github_app import github_app_service
from .state import MOCK_REVIEWS

router = APIRouter(prefix="/api", tags=["Reviews"])


def _serialize_review_row(row: dict) -> dict:
    return {
        "id": str(row.get("id")),
        "githubRepo": row.get("github_repo"),
        "prNumber": row.get("pr_number"),
        "prTitle": row.get("pr_title"),
        "prUrl": row.get("pr_url"),
        "fixPrNumber": row.get("fix_pr_number"),
        "fixPrUrl": row.get("fix_pr_url"),
        "issues": row.get("issues") or [],
        "summary": row.get("summary"),
        "status": row.get("status"),
        "reviewTimeMs": row.get("review_time_ms"),
        "createdAt": row.get("created_at"),
    }


def _fetch_github_repositories(access_token: str) -> List[RepositoryInfo]:
    # NOTE: still a sync `requests` call — this is item 4 of the scaling
    # plan (async AI/HTTP calls) and hasn't been touched yet. It's only
    # invoked from a route handler below and isn't on the DB pool, so it
    # wasn't part of this auth-outage fix; left as-is.
    repos: List[RepositoryInfo] = []
    url = "https://api.github.com/user/repos"
    params = {"per_page": 100, "type": "all"}
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {access_token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    while url:
        res = requests.get(url, headers=headers, params=params, timeout=15)
        if res.status_code != 200:
            break
        data = res.json()
        for repo in data:
            repos.append(
                RepositoryInfo(
                    id=str(repo.get("id")),
                    fullName=repo.get("full_name", ""),
                    private=bool(repo.get("private", False)),
                    defaultBranch=repo.get("default_branch") or "main",
                    lastScan=None,
                    issuesCount=0,
                    language=repo.get("language") or "Unknown",
                )
            )
        link_header = res.headers.get("Link", "")
        next_url = None
        if link_header:
            for part in link_header.split(","):
                section = part.strip().split(";")
                if len(section) == 2 and "rel=\"next\"" in section[1]:
                    next_url = section[0].strip().strip("<>")
                    break
        url = next_url
        params = {}

    return repos


@router.get("/repos", response_model=List[RepositoryInfo])
async def list_repositories(session: dict = Depends(get_required_github_session)):
    return _fetch_github_repositories(session["access_token"])


@router.get("/reviews", response_model=List[Review])
async def get_all_reviews():
    conn = await get_conn()
    if not conn:
        return []

    try:
        rows = await conn.fetch("SELECT * FROM reviews ORDER BY created_at DESC LIMIT 50")
        return [_serialize_review_row(dict(row)) for row in rows]
    finally:
        await release_conn(conn)


@router.get("/reviews/{review_id}", response_model=Review)
async def get_review_by_id(review_id: str):
    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=404, detail="Review not found")

    try:
        row = await conn.fetchrow("SELECT * FROM reviews WHERE id = $1", review_id)
        if not row:
            raise HTTPException(status_code=404, detail="Review not found")
        return _serialize_review_row(dict(row))
    finally:
        await release_conn(conn)


async def _fetch_review_from_db(review_id: str) -> Optional[dict]:
    conn = await get_conn()
    if not conn:
        return None

    try:
        row = await conn.fetchrow("SELECT * FROM reviews WHERE id = $1", review_id)
        if not row:
            return None
        return _serialize_review_row(dict(row))
    finally:
        await release_conn(conn)


async def _update_review_fix_pr(review_id: str, fix_pr_number: int, fix_pr_url: str):
    conn = await get_conn()
    if not conn:
        return

    try:
        await conn.execute(
            "UPDATE reviews SET fix_pr_number = $1, fix_pr_url = $2, status = $3 WHERE id = $4",
            fix_pr_number, fix_pr_url, "pr_created", review_id,
        )
    except Exception:
        # Best-effort persistence; do not fail the fix PR creation if DB update is unavailable.
        pass
    finally:
        await release_conn(conn)


@router.post("/reviews/{review_id}/pull-request", response_model=CreatePRResponse)
async def create_fix_pull_request(review_id: str):
    review = await _fetch_review_from_db(review_id)
    if not review:
        for candidate in MOCK_REVIEWS:
            if candidate.get("id") == review_id:
                review = candidate
                break

    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.get("fixPrUrl") and review.get("fixPrNumber"):
        return CreatePRResponse(
            status="pr_created",
            prNumber=review.get("fixPrNumber"),
            prUrl=review.get("fixPrUrl"),
            message="Fix pull request already created for this review.",
        )

    try:
        # github_app_service.create_fix_pull_request is still sync (item 4,
        # not addressed here — same as _fetch_github_repositories above).
        pr = github_app_service.create_fix_pull_request(SimpleNamespace(**review))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"GitHub App pull request creation failed: {exc}") from exc

    if review is not None and review.get("id"):
        await _update_review_fix_pr(review_id, pr["number"], pr["html_url"])

    if isinstance(review, dict):
        review["status"] = "pr_created"
        review["fixPrNumber"] = pr["number"]
        review["fixPrUrl"] = pr["html_url"]

    return CreatePRResponse(
        status="pr_created",
        prNumber=pr["number"],
        prUrl=pr["html_url"],
        message="Created a remediation pull request with the installed GitHub App.",
    )
