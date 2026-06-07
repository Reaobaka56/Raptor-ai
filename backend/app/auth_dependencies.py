import os
import time
from typing import Optional, Dict, Any
import secrets
from fastapi import Depends, Header, HTTPException, Request

from .services.session_store import save_session, get_session, delete_session, refresh_session


USER_SESSIONS: Dict[str, Any] = {}
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

    session = None
    try:
        session = get_session(token)
    except Exception:
        session = USER_SESSIONS.get(token)

    if not session:
        return None

    # Sliding TTL refresh
    try:
        refresh_session(token)
    except Exception:
        pass

    return session


def get_required_github_session(
    session: Optional[Dict[str, Any]] = Depends(get_optional_github_session),
    internal_auth: bool = Depends(lambda: False),
) -> Optional[Dict[str, Any]]:
    if session:
        return session
    if internal_auth:
        return None
    raise HTTPException(status_code=401, detail="Invalid or expired session context")


def get_internal_api_token(authorization: Optional[str] = Header(default=None)) -> bool:
    if not authorization or not authorization.startswith("Bearer "):
        return False
    token = authorization.removeprefix("Bearer ").strip()
    expected = os.getenv("INTERNAL_API_TOKEN")
    return bool(expected and secrets.compare_digest(token, expected))


def get_configured_github_token() -> Optional[str]:
    token = os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_PAT")
    if not token:
        return None
    token = token.strip()
    if token.startswith(("your_", "optional_")):
        return None
    return token
