"""User endpoints — profile, role check, bot notification preferences."""
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth_dependencies import get_required_github_session, get_optional_github_session
from .services.user_service import get_user_by_username, is_admin
from .services.bot_service import NOTIFICATION_TYPES
from .services.db import get_conn, release_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me")
async def get_me(session: Dict[str, Any] = Depends(get_required_github_session)):
    """Return the full DB user record for the logged-in user."""
    username = session.get("user", {}).get("username")
    if not username:
        raise HTTPException(status_code=401, detail="No username in session")

    db_user = await get_user_by_username(username)
    if db_user:
        return db_user

    # DB unavailable — return what we have in the session
    return session.get("user", {})


@router.get("/me/is-admin")
async def check_admin(session: Dict[str, Any] = Depends(get_required_github_session)):
    username = session.get("user", {}).get("username", "")
    return {"isAdmin": await is_admin(username)}


class NotificationPrefsUpdate(BaseModel):
    prefs: Dict[str, bool]


@router.get("/me/notification-settings")
async def get_notification_settings(session: Dict[str, Any] = Depends(get_required_github_session)):
    """Return every togglable bot notification type and the user's current preference.

    A type absent from the stored prefs map defaults to enabled (True) —
    see bot_service._is_subscribed for the same default applied when a
    notification is actually sent.
    """
    username = session.get("user", {}).get("username")
    db_user = await get_user_by_username(username) if username else None
    stored = (db_user or {}).get("notification_prefs") or {}
    return {
        "types": [
            {"key": key, "label": label, "enabled": stored.get(key, True) is not False}
            for key, label in NOTIFICATION_TYPES.items()
        ]
    }


@router.put("/me/notification-settings")
async def update_notification_settings(
    body: NotificationPrefsUpdate,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Merge the given {notif_type: enabled} pairs into the user's stored prefs.
    Unknown keys are rejected so a typo'd type can't silently no-op forever.
    """
    unknown = set(body.prefs) - set(NOTIFICATION_TYPES)
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown notification type(s): {', '.join(sorted(unknown))}")

    username = session.get("user", {}).get("username")
    db_user = await get_user_by_username(username) if username else None
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        row = await conn.fetchrow(
            """
            UPDATE users
            SET notification_prefs = COALESCE(notification_prefs, '{}'::jsonb) || $2::jsonb
            WHERE id = $1::uuid
            RETURNING notification_prefs
            """,
            db_user["id"], body.prefs,
        )
        prefs = row["notification_prefs"] if row else {}
        return {
            "types": [
                {"key": key, "label": label, "enabled": prefs.get(key, True) is not False}
                for key, label in NOTIFICATION_TYPES.items()
            ]
        }
    except Exception:
        logger.exception("update_notification_settings failed")
        raise HTTPException(status_code=500, detail="Failed to update notification settings")
    finally:
        await release_conn(conn)


@router.get("/{username}")
async def get_public_profile(username: str,
                              session: Optional[Dict[str, Any]] = Depends(get_optional_github_session)):
    """Public profile — only returns non-sensitive fields."""
    user = await get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "username": user["username"],
        "name": user["name"],
        "avatar_url": user["avatar_url"],
        "created_at": user["created_at"],
    }
