import os
import time
from typing import Optional, Dict, Any
import secrets
from fastapi import Depends, Header, HTTPException, Request

import logging

from .services.session_store import save_session, get_session, delete_session, refresh_session
from .services.user_service import get_user_by_username, upsert_user

logger = logging.getLogger(__name__)


SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "3600"))


def get_optional_github_session(
    authorization: Optional[str] = Header(default=None),
    session_token: Optional[str] = Header(default=None),
) -> Optional[Dict[str, Any]]:
    # Support Authorization header: "Bearer <token>" or direct session token header
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
    if not token and session_token:
        token = session_token

    if not token:
        return None

    try:
        session = get_session(token)
    except Exception:
        # Previously fell back to a per-process in-memory session dict here.
        # That meant a Redis blip silently downgraded auth to per-instance
        # state — a session created on replica A would look logged-out on
        # replica B, and any session_token guessed against one instance
        # only had to beat that instance's local dict. Fail loudly instead:
        # treat it as "not authenticated" and let the caller see a 401
        # rather than serve degraded, instance-local auth.
        logger.error("[auth] Redis unavailable while resolving session token")
        raise HTTPException(status_code=503, detail="Auth service temporarily unavailable")

    if not session:
        return None

    # Sliding TTL refresh
    try:
        refresh_session(token)
    except Exception:
        pass

    return session


def get_internal_api_token(authorization: Optional[str] = Header(default=None)) -> bool:
    if not authorization or not authorization.startswith("Bearer "):
        return False
    token = authorization.removeprefix("Bearer ").strip()
    expected = os.getenv("INTERNAL_API_TOKEN")
    return bool(expected and secrets.compare_digest(token, expected))


def get_required_github_session(
    session: Optional[Dict[str, Any]] = Depends(get_optional_github_session),
    internal_auth: bool = Depends(get_internal_api_token),
) -> Optional[Dict[str, Any]]:
    if session:
        return session
    if internal_auth:
        return None
    raise HTTPException(status_code=401, detail="Invalid or expired session context")


def get_configured_github_token() -> Optional[str]:
    token = os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_PAT")
    if not token:
        return None
    token = token.strip()
    if token.startswith(("your_", "optional_")):
        return None
    return token


def get_current_user(session: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Shared helper: resolve the DB user record for a session returned by
    get_required_github_session. Raises 401 if there's no session (e.g. the
    internal-auth bypass was used, which carries no user identity), or 404 if
    the session's username has no matching user record and it can't be
    self-healed (see below)."""
    if not session:
        raise HTTPException(status_code=401, detail="This endpoint requires a user session")

    profile = session.get("user", {}) or {}
    username = profile.get("username", "")
    user = get_user_by_username(username)

    if not user:
        # The GitHub session itself is valid, but there's no matching `users`
        # row. This happens when the DB was briefly unreachable during login
        # (auth_router's upsert_user call is non-fatal by design, so login
        # still succeeds and issues a session even if the upsert failed).
        # Rather than forcing the person to log out/in again, re-provision
        # the row from the profile fields already cached in the session and
        # retry once before giving up.
        github_id = profile.get("githubId")
        if github_id:
            logger.warning(
                "[auth] No user row for session username=%s githubId=%s — "
                "re-provisioning from cached session profile",
                username, github_id,
            )
            user = upsert_user(
                github_id=github_id,
                username=username,
                name=profile.get("name"),
                email=profile.get("email"),
                avatar_url=profile.get("avatarUrl"),
            )

    if not user:
        raise HTTPException(status_code=404, detail="User record not found — log in again")
    return user
