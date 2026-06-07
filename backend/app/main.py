import os
import random
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, TypedDict, Literal
from urllib.parse import urlencode, urlparse

import requests
from dotenv import load_dotenv
import hmac
import hashlib

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Body, Header, Cookie, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from .analysis import router as analysis_router
from .router.webhook import router as webhook_router
from .memory_router import router as memory_router
from .rate_limit import InMemoryRateLimitMiddleware, build_rate_limit_rules
from .services.db import get_conn, release_conn
from pydantic import BaseModel, Field
from .services.session_store import save_session, get_session, delete_session, refresh_session
from .auth_dependencies import (
    get_optional_github_session,
    get_required_github_session,
    get_internal_api_token,
    get_configured_github_token,
)

load_dotenv()
import logging
import contextvars
import uuid as _uuid


# =====================================================================
# INTEGRATED PYDANTIC MODELS
# =====================================================================
class ReviewIssue(BaseModel):
    file: str = Field(..., description="Target file path")
    line: int = Field(..., description="Line number of the issue")
    severity: Literal['critical', 'high', 'medium', 'low']
    category: Literal['security', 'performance', 'quality', 'design']
    title: str
    description: str
    suggestion: str

class Review(BaseModel):
    id: str
    githubRepo: str
    prNumber: int
    prTitle: Optional[str] = None
    prUrl: Optional[str] = None
    fixPrNumber: Optional[int] = None
    ## session helpers moved to `auth_dependencies.py`
    private: bool
    defaultBranch: str
    lastScan: Optional[str] = None
    issuesCount: int = 0
    language: str

class UserProfile(BaseModel):
    username: str
    avatarUrl: str
    githubId: int

class GitHubLoginUrlResponse(BaseModel):
    url: str

class GitHubAuthRequest(BaseModel):
    code: str
    redirectUri: str

class AuthResponse(BaseModel):
    token: str
    user: UserProfile
    repositories: List[RepositoryInfo]

class AuthCallbackRequest(BaseModel):
    code: str
    state: str
    redirectUri: Optional[str] = None

class GitHubOAuthUser(BaseModel):
    id: int
    login: str
    avatar_url: Optional[str] = None

class ScanRequest(BaseModel):
    repo: str

class CreatePRResponse(BaseModel):
    status: str
    prNumber: Optional[int] = None
    prUrl: str
    message: str

class WebhookLogItem(BaseModel):
    id: str
    repo: str
    event: str
    status: int
    time: str

class ParserStatusItem(BaseModel):
    language: str
    version: str
    status: str
    cacheHits: str

class SystemTelemetry(BaseModel):
    cpuLoad: float
    astCacheRate: float
    queueBacklog: int
    memoryUsedGb: float
    memoryTotalGb: float
    uptimeSec: int
    parsers: List[ParserStatusItem]
    webhookLogs: List[WebhookLogItem]

# =====================================================================
# FIXED INTERNAL COMPONENT IMPORTS
# =====================================================================
from .services.github_app import github_app_service

from .state import app, request_id_var, START_TIME
ACTIVE_QUEUE_COUNT = 0

# Register routers (avoid importing routers from state to prevent circular imports)
from .auth_router import router as auth_router
from .router.webhook import router as webhook_router
from .memory_router import router as memory_router
from .analysis import router as analysis_router

app.include_router(auth_router)
app.include_router(memory_router, prefix="/api")
app.include_router(webhook_router)
app.include_router(analysis_router, prefix="/debug")
from .scan_router import router as scan_router
app.include_router(scan_router)
from .reviews_router import router as reviews_router
from .telemetry_router import router as telemetry_router
app.include_router(reviews_router)
app.include_router(telemetry_router)

class GitHubSession(TypedDict):
    access_token: str
    user: UserProfile
    repositories: List[RepositoryInfo]
    created_at: str

USER_SESSIONS: Dict[str, GitHubSession] = {}
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "3600"))

from .state import LIVE_WEBHOOK_LOGS, AST_CACHE_STATS, MOCK_REPOSITORIES, MOCK_REVIEWS


def get_github_auth_headers(access_token: Optional[str]) -> Dict[str, str]:
    """Build GitHub REST API headers for OAuth, PAT, or installation tokens."""
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    return headers


def get_internal_api_token(
    authorization: Optional[str] = Header(default=None),
) -> bool:
    if not authorization or not authorization.startswith("Bearer "):
        return False
    token = authorization.removeprefix("Bearer ").strip()
    valid_tokens = {
        t for t in [os.getenv("INTERNAL_API_TOKEN"), os.getenv("GITHUB_TOKEN"), os.getenv("GITHUB_PAT")]
        if t
    }
    return token in valid_tokens


def is_session_expired(session: GitHubSession) -> bool:
    try:
        created_at = datetime.fromisoformat(session["created_at"])
    except Exception:
        return False
    return (datetime.now(timezone.utc) - created_at).total_seconds() > SESSION_TTL_SECONDS


def get_optional_github_session(
    authorization: Optional[str] = Header(default=None),
    raptor_session: Optional[str] = Cookie(default=None),
) -> Optional[GitHubSession]:
    session_token = None
    if authorization and authorization.startswith("Bearer "):
        session_token = authorization.removeprefix("Bearer ").strip()
    elif raptor_session:
        session_token = raptor_session

    if not session_token:
        return None

    # Prefer Redis-backed sessions when available
    session = None
    try:
        session = get_session(session_token)
    except Exception:
        session = None

    if not session:
        # Fallback to in-memory dict for tests/local
        session = USER_SESSIONS.get(session_token)

    if not session:
        return None

    # Sliding TTL: refresh on active use where supported
    try:
        refresh_session(session_token)
    except Exception:
        pass

    return session


def get_required_github_session(
    session: Optional[GitHubSession] = Depends(get_optional_github_session),
    internal_auth: bool = Depends(get_internal_api_token),
) -> Optional[GitHubSession]:
    if session:
        return session
    if internal_auth:
        return None
    raise HTTPException(status_code=401, detail="Invalid or expired session context")


def get_configured_github_token() -> Optional[str]:
    """Return a configured PAT-style token for authenticated GitHub reads."""
    token = os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_PAT")
    if not token:
        return None
    token = token.strip()
    if token.startswith(("your_", "optional_")):
        return None
    return token


def describe_github_rate_limit_error(status_code: int, detail: str, authenticated: bool) -> str:
    if status_code == 403 and "rate limit" in detail.lower():
        if authenticated:
            return "GitHub API rate limit exceeded for the authenticated token. Wait for the GitHub reset window or use a different GitHub App/OAuth token."
        return "GitHub API rate limit exceeded for unauthenticated requests. Connect GitHub in the app, configure GITHUB_TOKEN/GITHUB_PAT, or configure the GitHub App credentials so scans use authenticated GitHub API quota."
    return f"GitHub API scan failed ({status_code}): {detail}"


def build_repository_list(access_token: str) -> List[RepositoryInfo]:
    headers = get_github_auth_headers(access_token)
    if not headers:
        return []
    try:
        repos_res = requests.get("https://api.github.com/user/repos?per_page=30&sort=updated", headers=headers, timeout=10)
        if repos_res.status_code != 200:
            raise HTTPException(status_code=502, detail="Unable to fetch repositories from GitHub")
        
        repositories: List[RepositoryInfo] = []
        for item in repos_res.json():
            repositories.append(RepositoryInfo(
                id=str(item.get("id")),
                fullName=item.get("full_name"),
                private=bool(item.get("private", False)),
                defaultBranch=item.get("default_branch", "main"),
                lastScan=None,
                issuesCount=0,
                language=item.get("language") or "TypeScript"
            ))
        return repositories
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="GitHub API gateway connection failure")

@app.get("/health", tags=["Telemetry"])
def health_check():
    return {
        "status": "operational", 
        "uptime_sec": int(time.time() - START_TIME),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

class OAuthExchangeRequest(BaseModel):
    code: str
    state: Optional[str] = None
    redirectUri: Optional[str] = None


def _make_signed_state(state: str) -> str:
    """Return a signed state token including timestamp to store in a cookie."""
    secret = (os.getenv("APP_SECRET") or os.getenv("SECRET_KEY") or "").encode()
    ts = str(int(time.time()))
    payload = f"{state}:{ts}".encode()
    sig = hmac.new(secret, payload, hashlib.sha256).hexdigest()
    return f"{state}:{ts}:{sig}"


def _verify_signed_state(signed: str, max_age: int = 300) -> Optional[str]:
    try:
        secret = (os.getenv("APP_SECRET") or os.getenv("SECRET_KEY") or "").encode()
        parts = signed.split(":")
        if len(parts) != 3:
            return None
        state, ts_str, sig = parts
        payload = f"{state}:{ts_str}".encode()
        expected = hmac.new(secret, payload, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return None
        ts = int(ts_str)
        if abs(int(time.time()) - ts) > max_age:
            return None
        return state
    except Exception:
        return None

@app.post("/api/auth/github")
async def exchange_github_code(req: OAuthExchangeRequest, request: Request):
    """Exchange GitHub OAuth code for a session token."""
    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    # Validate OAuth state against signed cookie to prevent CSRF replay
    if req.state:
        signed = request.cookies.get("oauth_state")
        if not signed or _verify_signed_state(signed) != req.state:
            raise HTTPException(status_code=401, detail="Invalid or expired OAuth state")

    token_res = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        json={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": req.code,
        },
        timeout=15,
    )

    if token_res.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to exchange code with GitHub")

    token_data = token_res.json()
    access_token = token_data.get("access_token")

    if not access_token:
        error = token_data.get("error_description", "No access token returned")
        raise HTTPException(status_code=401, detail=error)

    user_res = requests.get(
        "https://api.github.com/user",
        headers=get_github_auth_headers(access_token),
        timeout=10,
    )

    if user_res.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to fetch GitHub user")

    user_data = user_res.json()

    session_token = secrets.token_urlsafe(32)
    session_obj = {
        "access_token": access_token,
        "user": {
            "username": user_data.get("login", ""),
            "avatarUrl": user_data.get("avatar_url", ""),
            "githubId": user_data.get("id", 0),
        },
        "repositories": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Persist session (Redis-backed when available)
    try:
        save_session(session_token, session_obj)
    except Exception:
        USER_SESSIONS[session_token] = session_obj

    # Return token and set session cookie
    resp = {
        "token": session_token,
        "user": session_obj["user"],
        "repositories": session_obj["repositories"],
    }
    return resp


@app.get("/api/auth/github/login", response_model=GitHubLoginUrlResponse)
def github_login(redirectUri: Optional[str] = None, response: Request = None):
    """Initiate GitHub OAuth: generate signed state cookie and return the GitHub auth URL."""
    client_id = os.getenv("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")
    state = secrets.token_urlsafe(16)
    signed = _make_signed_state(state)
    # Build redirect URL
    params = {"client_id": client_id, "scope": "repo read:user", "state": state}
    if redirectUri:
        params["redirect_uri"] = redirectUri
    url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    # FastAPI Request can't set cookies via Request object; return URL and expect frontend to redirect.
    response_obj = {"url": url}
    # Also instruct client to set a cookie by including Set-Cookie header via Response
    from fastapi import Response
    resp = Response(content=json.dumps(response_obj), media_type="application/json")
    resp.set_cookie("oauth_state", signed, httponly=True, samesite="lax", max_age=300)
    return resp
    

    # ── Memory Layer Integration ──────────────────────────────────────
    try:
        from .services.embedding_service import generate_embedding
        from .services import memory_service

        issue_titles = " | ".join(i.title for i in new_review.issues) or "No issues"
        review_text = f"{new_review.summary or ''} {issue_titles}"
        embedding = generate_embedding(review_text)

        memory_service.store_review_embedding(
            review_id=new_review.id,
            repo=repo_name,
            pr_number=new_review.prNumber,
            issue_titles=issue_titles,
            summary=new_review.summary or "",
            embedding=embedding,
        )

        similar = memory_service.retrieve_similar_reviews(
            embedding=embedding, repo=repo_name, top_k=5
        )
        new_review._similar_past_reviews = similar

        relevant_rules = memory_service.find_relevant_rules(
            embedding=embedding, repo=repo_name
        )
        new_review._convention_violations = relevant_rules

    except Exception as mem_err:
            logging.exception("[memory] Non-blocking memory layer error")
    # ─────────────────────────────────────────────────────────────────

    # Persist review to Postgres if configured
    conn = None
    try:
        conn = get_conn()
        if conn:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO reviews (id, github_repo, pr_number, pr_title, pr_url, fix_pr_number, fix_pr_url, issues, summary, status, review_time_ms, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s)
                """,
                (
                    new_review.id,
                    new_review.githubRepo,
                    new_review.prNumber,
                    new_review.prTitle,
                    new_review.prUrl,
                    new_review.fixPrNumber,
                    new_review.fixPrUrl,
                    json.dumps([i.dict() for i in new_review.issues]),
                    new_review.summary,
                    new_review.status,
                    new_review.reviewTimeMs,
                    new_review.createdAt,
                ),
            )
            try:
                release_conn(conn)
            except Exception:
                pass
    except Exception as e:
        # If DB persistence fails, continue with in-memory mock list but log
            logging.exception("[db] Failed to persist review to Postgres")

    sync_repository_scan_metadata(repo_name, new_review)
    MOCK_REVIEWS.insert(0, new_review)
    return new_review

@app.get("/api/reviews", tags=["Reviews"])
def get_all_reviews():
    return {
        "reviews": MOCK_REVIEWS,
        "pagination": {
            "total": len(MOCK_REVIEWS),
            "limit": 50,
            "offset": 0
        }
    }

@app.get("/api/reviews/{review_id}", response_model=Review, tags=["Reviews"])
def get_review_by_id(review_id: int):
    for r in MOCK_REVIEWS:
        if r.id == review_id:
            return r
    raise HTTPException(status_code=404, detail="Review not found")


@app.post("/api/reviews/{review_id}/pull-request", response_model=CreatePRResponse, tags=["Reviews"])
def create_fix_pull_request(review_id: int):
    for review in MOCK_REVIEWS:
        if review.id == review_id:
            if review.fixPrUrl and review.fixPrNumber:
                return CreatePRResponse(
                    status="pr_created",
                    prNumber=review.fixPrNumber,
                    prUrl=review.fixPrUrl,
                    message="Fix pull request already created for this review."
                )

            try:
                pr = github_app_service.create_fix_pull_request(review)
            except requests.HTTPError as exc:
                status_code = exc.response.status_code if exc.response is not None else 502
                detail = exc.response.text if exc.response is not None else str(exc)
                raise HTTPException(status_code=502, detail=f"GitHub App pull request creation failed ({status_code}): {detail}") from exc
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"GitHub App pull request creation failed: {exc}") from exc

            review.status = "pr_created"
            review.fixPrNumber = pr["number"]
            review.fixPrUrl = pr["html_url"]
            return CreatePRResponse(
                status="pr_created",
                prNumber=review.fixPrNumber,
                prUrl=review.fixPrUrl,
                message="Created a remediation pull request with the installed GitHub App."
            )

    raise HTTPException(status_code=404, detail="Review not found")

@app.get("/api/stats", response_model=Stats, tags=["Telemetry"])
def get_stats(repo: Optional[str] = None):
    reviews = [r for r in MOCK_REVIEWS if not repo or r.githubRepo.lower() == repo.lower()]
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    category_counts = {"security": 0, "performance": 0, "quality": 0, "design": 0}
    for review in reviews:
        for issue in review.issues:
            severity_counts[issue.severity] += 1
            category_counts[issue.category] += 1
    review_times = [r.reviewTimeMs for r in reviews if r.reviewTimeMs is not None]
    avg_review_time = int(sum(review_times) / len(review_times)) if review_times else 0
    return Stats(
        totalReviews=len(reviews),
        totalIssues=sum(len(r.issues) for r in reviews),
        avgReviewTime=avg_review_time,
        issuesBySeverity=SeverityStats(**severity_counts),
        issuesByCategory=CategoryStats(**category_counts),
        reviewsOverTime=[]
    )
