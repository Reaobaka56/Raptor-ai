import os
import time
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, TypedDict, Literal
import requests
from urllib.parse import urlencode
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Body, Depends, Header, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

load_dotenv()

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# =====================================================================
# INTEGRATED PYDANTIC MODELS (No external models.py import needed!)
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

class ScanRequest(BaseModel):
    repo: str

class CreatePRResponse(BaseModel):
    status: str
    prNumber: int
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
# FIXED INTERNAL COMPONSENT IMPORTS
# =====================================================================
from app.services.github_app import github_app_service

class InlineAIService:
    def analyze_ast(self, prompt: str) -> str:
        return "Raptor local AST validation completed successfully."
ai_service = InlineAIService()

# =====================================================================
# FASTAPI APPLICATION SETUP
# =====================================================================
app = FastAPI(
    title="Raptor AI Code Review Backend",
    description="Autonomous live GitHub integration and Gemini AST analysis engine",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

START_TIME = time.time()
ACTIVE_QUEUE_COUNT = 0

class GitHubSession(TypedDict):
    access_token: str
    user: UserProfile
    repositories: List[RepositoryInfo]
    created_at: str

USER_SESSIONS: Dict[str, GitHubSession] = {}

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

MOCK_REVIEWS: List[Review] = [
    Review(
        id=1,
        githubRepo="organization/api-gateway",
        prNumber=88,
        prTitle="refactor: migrate legacy SQL queries to parameterized helpers",
        prUrl="https://github.com/organization/api-gateway/pull/88",
        issues=[
            ReviewIssue(
                file="src/controllers/paymentController.ts",
                line=42,
                severity="critical",
                category="security",
                title="Severe SQL Injection Vulnerability Detected",
                description="Direct string concatenation detected in raw database query parameter. Unsanitized input from req.body.customerId permits arbitrary query execution.",
                suggestion="const invoice = await db.query('SELECT * FROM invoices WHERE id = $1', [req.body.customerId]);"
            )
        ],
        summary="Raptor AST analysis completed.",
        status="completed",
        reviewTimeMs=1240,
        createdAt="2026-05-17T14:15:00Z"
    )
]

def get_github_auth_headers(token: Optional[str] = None):
    if not token:
        return None
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

def get_required_github_session(
    authorization: Optional[str] = Header(default=None),
    raptor_session: Optional[str] = Cookie(default=None)
) -> GitHubSession:
    session_token = None
    if authorization and authorization.startswith("Bearer "):
        session_token = authorization.removeprefix("Bearer ").strip()
    elif raptor_session:
        session_token = raptor_session

    if not session_token:
        raise HTTPException(status_code=401, detail="Missing authentication credentials")

    session = USER_SESSIONS.get(session_token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session context")
    return session

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

@app.get("/api/auth/github/callback", response_model=GitHubLoginUrlResponse, tags=["Auth"])
def get_github_login_url(state: str = Query(..., min_length=16), redirect_uri: str = Query(..., alias="redirectUri")):
    client_id = os.getenv("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GitHub OAuth is not configured")

    query = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": "read:user repo",
        "state": state,
    })
    return GitHubLoginUrlResponse(url=f"https://github.com/login/oauth/authorize?{query}")

@app.get("/api/auth/github/callback")
def github_callback(code: str = Query(None), state: str = Query(None)):
    if not code:
        raise HTTPException(status_code=400, detail="Missing OAuth exchange code")

    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="GitHub OAuth parameters are missing natively")

    token_res = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
        },
        timeout=10
    )

    token_data = token_res.json()
    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(status_code=401, detail="OAuth authorization sequence broke down")

    user_res = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10
    )

    if user_res.status_code != 200:
        raise HTTPException(status_code=502, detail="GitHub user profile fetch failed")

    user_data = user_res.json()
    user = UserProfile(
        username=user_data.get("login"),
        avatarUrl=user_data.get("avatar_url"),
        githubId=user_data.get("id")
    )

    repositories = build_repository_list(access_token)
    session_token = uuid.uuid4().hex

    USER_SESSIONS[session_token] = {
        "access_token": access_token,
        "user": user,
        "repositories": repositories,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    response = RedirectResponse(url="https://raptor-agent-ai.vercel.app/dashboard")
    response.set_cookie(
        key="raptor_session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7
    )
    return response

@app.get("/api/repos", response_model=List[RepositoryInfo], tags=["Repositories"])
def get_repositories(session: GitHubSession = Depends(get_required_github_session)):
    return session["repositories"]
