import os
import time
import secrets
import requests
from urllib.parse import urlencode
from typing import Optional, Dict, Any

import logging

from fastapi import APIRouter, Request, HTTPException

from .models import GitHubLoginUrlResponse, AuthCallbackRequest, UserProfile, RepositoryInfo
from .services.session_store import save_session, SessionStoreUnavailable
from .services.user_service import upsert_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])
logger = logging.getLogger(__name__)


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
    db_user, is_new_user = await upsert_user(
        github_id=github_id,
        username=github_login,
        name=name,
        email=email,
        avatar_url=avatar_url,
        return_is_new=True,
    )
    if db_user and is_new_user:
        try:
            from .services.bot_service import send_welcome
            await send_welcome(db_user["id"])
        except Exception:
            logger.exception("[auth] failed to send Raptor Bot welcome message to %s", github_login)
    if not db_user:
        # Login still proceeds (see get_current_user's self-healing retry),
        # but this is worth surfacing loudly since it means every DB-backed
        # endpoint will 404 until it re-provisions the row.
        logger.warning(
            "[auth] upsert_user failed for username=%s githubId=%s — "
            "session will be issued without a DB user row",
            github_login, github_id,
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
        await save_session(session_token, session_obj)
    except SessionStoreUnavailable:
        # Previously fell back to a per-process in-memory dict, which meant
        # the session token handed back to the client would only work on
        # whichever instance issued it — silent, instance-local auth. Fail
        # the login instead so the client gets a clear error and can retry.
        logger.error("[auth] Session store unavailable while saving session for username=%s", github_login)
        raise HTTPException(status_code=503, detail="Auth service temporarily unavailable, please try again")

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
