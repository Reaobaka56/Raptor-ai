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

# =========================
# OPTIONAL PSUTIL
# =========================
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


# =========================
# MODELS
# =========================
class ReviewIssue(BaseModel):
    file: str
    line: int
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


class GitHubLoginUrlResponse(BaseModel):
    url: str


class UserProfile(BaseModel):
    username: str
    avatarUrl: str
    githubId: int


# =========================
# APP SETUP
# =========================
app = FastAPI(title="Raptor AI", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

START_TIME = time.time()
USER_SESSIONS: Dict[str, Any] = {}


# =========================
# HEALTH
# =========================
@app.get("/health")
def health():
    return {
        "status": "operational",
        "uptime_sec": int(time.time() - START_TIME)
    }


# =========================
# 🔥 FIXED: LOGIN ROUTE
# =========================
@app.get("/api/auth/github/login", response_model=GitHubLoginUrlResponse)
def github_login(
    state: str = Query(..., min_length=16),
    redirectUri: str = Query(...)
):
    client_id = os.getenv("GITHUB_CLIENT_ID")

    if not client_id:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    url = "https://github.com/login/oauth/authorize?" + urlencode({
        "client_id": client_id,
        "redirect_uri": redirectUri,
        "scope": "read:user repo",
        "state": state
    })

    return GitHubLoginUrlResponse(url=url)


# =========================
# 🔥 CALLBACK ROUTE (FIXED)
# =========================
@app.get("/api/auth/github/callback")
def github_callback(
    code: str = Query(None),
    state: str = Query(None)
):
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")

    token_res = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "
