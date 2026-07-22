"""User endpoints — profile, role check."""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException

from .auth_dependencies import get_required_github_session, get_optional_github_session
from .services.user_service import get_user_by_username, is_admin

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me")
def get_me(session: Dict[str, Any] = Depends(get_required_github_session)):
    """Return the full DB user record for the logged-in user."""
    username = session.get("user", {}).get("username")
    if not username:
        raise HTTPException(status_code=401, detail="No username in session")

    db_user = get_user_by_username(username)
    if db_user:
        return db_user

    # DB unavailable — return what we have in the session
    return session.get("user", {})


@router.get("/me/is-admin")
def check_admin(session: Dict[str, Any] = Depends(get_required_github_session)):
    username = session.get("user", {}).get("username", "")
    return {"isAdmin": is_admin(username)}


@router.get("/{username}")
def get_public_profile(username: str,
                       session: Optional[Dict[str, Any]] = Depends(get_optional_github_session)):
    """Public profile — only returns non-sensitive fields."""
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "username": user["username"],
        "name": user["name"],
        "avatar_url": user["avatar_url"],
        "created_at": user["created_at"],
    }
