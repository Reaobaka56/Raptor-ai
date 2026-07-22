import os
import time
import secrets
import requests
from urllib.parse import urlencode
from typing import Optional, Dict, Any

from fastapi import APIRouter, Request, HTTPException

from .models import GitHubLoginUrlResponse, AuthCallbackRequest, UserProfile, RepositoryInfo
from .services.session_store import save_session
from .services.user_service import upsert_user
from .auth_dependencies import USER_SESSIONS

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def _get_github_auth_headers(access_token: Optional[str]) -> Dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    return headers


@router.post("/github")
async def exchange_github_code(req: AuthCallbackRequest, request: Request):
    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    token_payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": req.code,
    }
    if req.redirectUri:
        token_payload["redirect_uri"] = req.redirectUri

    token_res = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        json=token_payload,
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
        headers=_get_github_auth_headers(access_token),
        timeout=10,
    )

    if user_res.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to fetch GitHub user")

    user_data = user_res.json()

    github_login = user_data.get("login", "")
    github_id    = user_data.get("id", 0)
    avatar_url   = user_data.get("avatar_url", "")
    name         = user_data.get("name")
    email        = user_data.get("email")

    # Persist / update the user record in PostgreSQL (non-fatal if DB is down)
    db_user = upsert_user(
        github_id=github_id,
        username=github_login,
        name=name,
        email=email,
        avatar_url=avatar_url,
    )

    user_profile = {
        "username":  github_login,
        "avatarUrl": avatar_url,
        "githubId":  github_id,
        # Attach DB fields when available
        "id":        db_user["id"]   if db_user else None,
        "role":      db_user["role"] if db_user else "user",
        "name":      name,
        "email":     email,
    }

    session_token = secrets.token_urlsafe(32)
    session_obj = {
        "access_token": access_token,
        "user": user_profile,
        "repositories": [],
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    try:
        save_session(session_token, session_obj)
    except Exception:
        USER_SESSIONS[session_token] = session_obj

    return {"token": session_token, "user": user_profile, "repositories": session_obj["repositories"]}


@router.get("/github/login", response_model=GitHubLoginUrlResponse)
def github_login(request: Request, redirectUri: Optional[str] = None, state: Optional[str] = None):
    client_id = os.getenv("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")
    if not state:
        state = secrets.token_urlsafe(16)
    params = {"client_id": client_id, "scope": "repo read:user", "state": state}
    if redirectUri:
        params["redirect_uri"] = redirectUri
    url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return {"url": url}
