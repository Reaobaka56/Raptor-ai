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

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Body, Header, Cookie, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from .analysis import router as analysis_router
from .router.webhook import router as webhook_router
from .memory_router import router as memory_router
from .rate_limit import InMemoryRateLimitMiddleware, build_rate_limit_rules
from pydantic import BaseModel, Field

load_dotenv()


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
    id: int
    githubRepo: str
    prNumber: int
    prTitle: Optional[str] = None
    prUrl: Optional[str] = None
    fixPrNumber: Optional[int] = None
    fixPrUrl: Optional[str] = None
    issues: List[ReviewIssue] = []
    summary: Optional[str] = None
    status: str = "completed"
    reviewTimeMs: Optional[int] = None
    createdAt: str

class Pagination(BaseModel):
    total: int
    limit: int
    offset: int

class ReviewsResponse(BaseModel):
    reviews: List[Review]
    pagination: Pagination

class SeverityStats(BaseModel):
    critical: int
    high: int
    medium: int
    low: int

class CategoryStats(BaseModel):
    security: int
    performance: int
    quality: int
    design: int

class TimeSeriesPoint(BaseModel):
    date: str
    count: int
    issues: int

class Stats(BaseModel):
    totalReviews: int
    totalIssues: int
    avgReviewTime: int
    issuesBySeverity: SeverityStats
    issuesByCategory: CategoryStats
    reviewsOverTime: List[TimeSeriesPoint]

class PullRequestModel(BaseModel):
    number: int
    title: str
    html_url: str
    diff_url: str
    state: str

class RepositoryModel(BaseModel):
    full_name: str
    html_url: str

class InstallationModel(BaseModel):
    id: int

class WebhookPayload(BaseModel):
    action: Optional[str] = None
    pull_request: Optional[PullRequestModel] = None
    repository: Optional[RepositoryModel] = None
    installation: Optional[InstallationModel] = None

class RepositoryInfo(BaseModel):
    id: str
    fullName: str
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

# =====================================================================
# FASTAPI APPLICATION SETUP
# =====================================================================
app = FastAPI(
    title="Raptor AI Code Review Backend",
    description="Autonomous live GitHub integration and Gemini AST analysis engine",
    version="2.0.0"
)

configured_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]
allowed_origins = configured_origins or [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://raptor-ai.vercel.app",
    "https://raptor-ai.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "X-RateLimit-Window",
        "X-RateLimit-Policy",
        "Retry-After",
    ],
)
app.add_middleware(InMemoryRateLimitMiddleware, rules=build_rate_limit_rules())

app.include_router(analysis_router, prefix="/debug")
app.include_router(memory_router, prefix="/api")
app.include_router(webhook_router)


START_TIME = time.time()
ACTIVE_QUEUE_COUNT = 0

class GitHubSession(TypedDict):
    access_token: str
    user: UserProfile
    repositories: List[RepositoryInfo]
    created_at: str

USER_SESSIONS: Dict[str, GitHubSession] = {}
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "3600"))

LIVE_WEBHOOK_LOGS: List[WebhookLogItem] = [
    WebhookLogItem(id="wh_98a72b", repo="organization/api-gateway", event="pull_request.synchronize", status=200, time="20s ago"),
    WebhookLogItem(id="wh_98a72a", repo="organization/auth-service", event="pull_request.opened", status=200, time="3m ago"),
]

AST_CACHE_STATS: Dict[str, Dict[str, Any]] = {
    "TypeScript / JavaScript": {"version": "v5.4.2", "hits": 142, "total": 150},
    "Python": {"version": "v3.12.1", "hits": 98, "total": 106},
    "Go (Golang)": {"version": "v1.22.0", "hits": 204, "total": 210},
}

MOCK_REPOSITORIES: List[RepositoryInfo] = [
    RepositoryInfo(
        id="repo_1",
        fullName="organization/api-gateway",
        private=True,
        defaultBranch="main",
        lastScan="2026-05-17T14:15:00Z",
        issuesCount=2,
        language="TypeScript"
    ),
    RepositoryInfo(
        id="repo_2",
        fullName="organization/auth-service",
        private=False,
        defaultBranch="main",
        lastScan="2026-05-17T11:20:00Z",
        issuesCount=1,
        language="Go"
    )
]

MOCK_REVIEWS: List[Review] = []


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

    session = USER_SESSIONS.get(session_token)
    if not session:
        return None
    if is_session_expired(session):
        USER_SESSIONS.pop(session_token, None)
        return None
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

@app.post("/api/auth/github")
async def exchange_github_code(req: OAuthExchangeRequest):
    """Exchange GitHub OAuth code for a session token."""
    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

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
    USER_SESSIONS[session_token] = GitHubSession(
        access_token=access_token,
        user=UserProfile(
            username=user_data.get("login", ""),
            avatarUrl=user_data.get("avatar_url", ""),
            githubId=user_data.get("id", 0),
        ),
        repositories=[],
        created_at=datetime.now(timezone.utc).isoformat()
    )

    return {
        "token": session_token,
        "user": {
            "username": user_data.get("login"),
            "avatarUrl": user_data.get("avatar_url"),
            "githubId": user_data.get("id"),
        }
    }

@app.get("/api/auth/github/login")
async def github_login(state: Optional[str] = None, redirectUri: Optional[str] = None):
    client_id = os.getenv("GITHUB_CLIENT_ID")
    redirect = redirectUri or os.getenv("GITHUB_REDIRECT_URI", "")
    url = f"https://github.com/login/oauth/authorize?client_id={client_id}&scope=read:user+repo&state={state or ''}&redirect_uri={redirect}"
    return {"url": url}


def parse_github_scan_target(target: str) -> tuple[str, Optional[int]]:
    """Return (owner/repo, pull_request_number) from an owner/repo or GitHub PR URL."""
    repo_name = target.strip()
    pr_number: Optional[int] = None
    if not repo_name:
        raise HTTPException(status_code=400, detail="Repository is required")

    if "://" in repo_name:
        parsed = urlparse(repo_name)
        if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
            raise HTTPException(status_code=400, detail="Only GitHub repository URLs are supported")
        path_parts = [part for part in parsed.path.strip("/").split("/") if part]
        if len(path_parts) < 2:
            raise HTTPException(status_code=400, detail="GitHub URL must include owner and repo")
        if len(path_parts) >= 4 and path_parts[2] == "pull":
            try:
                pr_number = int(path_parts[3])
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Pull request number must be numeric") from exc
        repo_name = "/".join(path_parts[:2])

    repo_name = repo_name.removesuffix(".git").strip("/")
    repo_parts = repo_name.split("/")
    if len(repo_parts) != 2 or not all(repo_parts):
        raise HTTPException(status_code=400, detail="Repository must be in owner/repo format")
    return repo_name, pr_number

def normalize_github_repo_name(repo: str) -> str:
    """Return owner/repo from either a GitHub URL or owner/repo input."""
    return parse_github_scan_target(repo)[0]

def sync_repository_scan_metadata(repo_name: str, review: Review) -> None:
    """Keep dashboard repository cards in sync after manual scans."""
    for repo in MOCK_REPOSITORIES:
        if repo.fullName.lower() == repo_name.lower():
            repo.lastScan = review.createdAt
            repo.issuesCount = len(review.issues)
            return

@app.post("/api/scan", response_model=Review, tags=["Scanning"])
def scan_repository(
    req: ScanRequest,
    session: Optional[GitHubSession] = Depends(get_required_github_session),
):
    repo_name, requested_pr_number = parse_github_scan_target(req.repo)
    from .services.ai_service import ai_service as real_ai_service

    github_token = session["access_token"] if session else None

    try:
        app_token = github_app_service.get_installation_token_for_repo(repo_name)
        if app_token:
            github_token = app_token
    except Exception as auth_exc:
        print(f"GitHub App token unavailable for {repo_name}: {auth_exc}")

    if not github_token:
        github_token = get_configured_github_token()

    github_headers = get_github_auth_headers(github_token)
    print("GitHub token configured:", bool(github_token))

    try:
        if requested_pr_number:
            pr_res = requests.get(f"https://api.github.com/repos/{repo_name}/pulls/{requested_pr_number}", headers=github_headers, timeout=15)
            pr_res.raise_for_status()
            pr_data = pr_res.json()
            pr_number = int(pr_data["number"])
            pr_title = pr_data.get("title") or f"Pull request #{pr_number}"
            pr_url = pr_data.get("html_url") or f"https://github.com/{repo_name}/pull/{pr_number}"
            diff_url = pr_data.get("diff_url") or f"{pr_url}.diff"
        else:
            pulls_res = requests.get(f"https://api.github.com/repos/{repo_name}/pulls?state=open&sort=updated&direction=desc&per_page=1", headers=github_headers, timeout=15)
            pulls_res.raise_for_status()
            pulls_data = pulls_res.json()
            if pulls_data:
                pr_data = pulls_data[0]
                pr_number = int(pr_data["number"])
                pr_title = pr_data.get("title") or f"Pull request #{pr_number}"
                pr_url = pr_data.get("html_url") or f"https://github.com/{repo_name}/pull/{pr_number}"
                diff_url = pr_data.get("diff_url") or f"{pr_url}.diff"
            else:
                commits_res = requests.get(f"https://api.github.com/repos/{repo_name}/commits?per_page=1", headers=github_headers, timeout=15)
                commits_res.raise_for_status()
                commits_data = commits_res.json()
                if not commits_data:
                    raise HTTPException(status_code=404, detail="No pull requests or commits found for this repository")
                latest_commit = commits_data[0]
                sha = latest_commit["sha"]
                pr_number = 0
                pr_title = latest_commit["commit"]["message"]
                pr_url = f"https://github.com/{repo_name}/commit/{sha}"
                diff_url = f"{pr_url}.diff"

        diff_text = real_ai_service.fetch_diff(diff_url, github_token=github_token)
        ai_result = real_ai_service.analyze_pr(repo=repo_name, pr_number=pr_number, pr_title=pr_title, diff_text=diff_text)
        new_review = Review(
            id=random.randint(10000, 99999),
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
    except HTTPException:
        raise
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(status_code=502, detail=f"GitHub API scan failed ({status_code}): {detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Repository scan failed: {exc}") from exc

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
        print(f"[memory] Non-blocking memory layer error: {mem_err}")
    # ─────────────────────────────────────────────────────────────────

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
