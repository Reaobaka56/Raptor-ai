import requests
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List
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
def list_repositories(session: dict = Depends(get_required_github_session)):
    return _fetch_github_repositories(session["access_token"])


@router.get("/reviews", response_model=List[Review])
def get_all_reviews():
    conn = get_conn()
    if not conn:
        return []

    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM reviews ORDER BY created_at DESC LIMIT 50")
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [_serialize_review_row(dict(zip(cols, row))) for row in rows]
    finally:
        release_conn(conn)


@router.get("/reviews/{review_id}", response_model=Review)
def get_review_by_id(review_id: str):
    conn = get_conn()
    if not conn:
        raise HTTPException(status_code=404, detail="Review not found")

    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM reviews WHERE id = %s", (review_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Review not found")
        cols = [d[0] for d in cur.description]
        return _serialize_review_row(dict(zip(cols, row)))
    finally:
        release_conn(conn)


def _fetch_review_from_db(review_id: str) -> dict | None:
    conn = get_conn()
    if not conn:
        return None

    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM reviews WHERE id = %s", (review_id,))
        row = cur.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cur.description]
        return _serialize_review_row(dict(zip(cols, row)))
    finally:
        release_conn(conn)


def _update_review_fix_pr(review_id: str, fix_pr_number: int, fix_pr_url: str):
    conn = get_conn()
    if not conn:
        return

    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE reviews SET fix_pr_number = %s, fix_pr_url = %s, status = %s WHERE id = %s",
            (fix_pr_number, fix_pr_url, "pr_created", review_id),
        )
        conn.commit()
    except Exception:
        # Best-effort persistence; do not fail the fix PR creation if DB update is unavailable.
        pass
    finally:
        release_conn(conn)


@router.post("/reviews/{review_id}/pull-request", response_model=CreatePRResponse)
def create_fix_pull_request(review_id: str):
    review = _fetch_review_from_db(review_id)
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
        pr = github_app_service.create_fix_pull_request(SimpleNamespace(**review))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"GitHub App pull request creation failed: {exc}") from exc

    if review is not None and review.get("id"):
        _update_review_fix_pr(review_id, pr["number"], pr["html_url"])

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
