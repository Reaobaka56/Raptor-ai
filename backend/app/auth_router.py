import os
import time
import hmac
import hashlib
import secrets
import json
import requests
from urllib.parse import urlencode
from typing import Optional, Dict, Any

from fastapi import APIRouter, Request, HTTPException, Response

from .models import GitHubLoginUrlResponse, AuthCallbackRequest, UserProfile, RepositoryInfo
from .services.session_store import save_session

router = APIRouter(prefix="/api/auth", tags=["Auth"])

IN_MEMORY_SESSIONS: Dict[str, Any] = {}


def _make_signed_state(state: str) -> str:
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

    # Validate OAuth state against signed cookie to prevent CSRF replay
    if getattr(req, "state", None):
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
        headers=_get_github_auth_headers(access_token),
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
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    # Persist session (Redis-backed when available)
    try:
        save_session(session_token, session_obj)
    except Exception:
        IN_MEMORY_SESSIONS[session_token] = session_obj

    resp = {"token": session_token, "user": session_obj["user"], "repositories": session_obj["repositories"]}
    return resp


@router.get("/github/login", response_model=GitHubLoginUrlResponse)
def github_login(redirectUri: Optional[str] = None):
    client_id = os.getenv("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")
    state = secrets.token_urlsafe(16)
    signed = _make_signed_state(state)
    params = {"client_id": client_id, "scope": "repo read:user", "state": state}
    if redirectUri:
        params["redirect_uri"] = redirectUri
    url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    from fastapi import Response
    response_obj = {"url": url}
    resp = Response(content=json.dumps(response_obj), media_type="application/json")
    resp.set_cookie("oauth_state", signed, httponly=True, samesite="lax", max_age=300)
    return resp
