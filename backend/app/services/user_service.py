"""
User service — upsert/fetch user records from the users table.
All mutations go through this module so the rest of the app stays DB-agnostic.
"""
import logging
from typing import Optional, Dict, Any

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)

ADMIN_USERNAME = "reaobaka56"

_USER_COLUMNS = """id, github_id, username, name, email, avatar_url,
                   role, account_status, created_at, last_login_at"""


def _shape_user(row) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    user = dict(row)
    user["id"] = str(user["id"])
    user["created_at"] = user["created_at"].isoformat() if user["created_at"] else None
    user["last_login_at"] = user["last_login_at"].isoformat() if user["last_login_at"] else None
    return user


async def upsert_user(github_id: int, username: str, name: Optional[str],
                       email: Optional[str], avatar_url: Optional[str],
                       return_is_new: bool = False):
    """
    Insert or update a user record on every GitHub login.
    Returns the full user row as a dict, or None if the DB is unavailable.
    If return_is_new is True, returns (user_dict, is_new_user) instead —
    is_new_user is True only the first time this github_id is ever seen,
    which is what triggers the Raptor Bot welcome message.
    """
    conn = await get_conn()
    if not conn:
        logger.warning("[user_service] DB unavailable — skipping user upsert for %s", username)
        return (None, False) if return_is_new else None

    # Force admin role for the owner account regardless of what's in the DB
    role = "admin" if username.lower() == ADMIN_USERNAME.lower() else "user"

    try:
        row = await conn.fetchrow(
            f"""
            INSERT INTO users (github_id, username, name, email, avatar_url, role, last_login_at)
            VALUES ($1, $2, $3, $4, $5, $6, now())
            ON CONFLICT (github_id) DO UPDATE SET
                username      = EXCLUDED.username,
                name          = EXCLUDED.name,
                email         = COALESCE(EXCLUDED.email, users.email),
                avatar_url    = EXCLUDED.avatar_url,
                role          = CASE WHEN users.username = $7 THEN 'admin' ELSE users.role END,
                last_login_at = now()
            RETURNING {_USER_COLUMNS}, (xmax = 0) AS is_new
            """,
            github_id, username, name, email, avatar_url, role, ADMIN_USERNAME,
        )
        is_new = bool(row["is_new"]) if row else False
        user = _shape_user({k: v for k, v in dict(row).items() if k != "is_new"}) if row else None
        return (user, is_new) if return_is_new else user
    except Exception:
        logger.exception("[user_service] Failed to upsert user %s", username)
        return (None, False) if return_is_new else None
    finally:
        await release_conn(conn)


async def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            f"SELECT {_USER_COLUMNS} FROM users WHERE username = $1 LIMIT 1",
            username,
        )
        return _shape_user(row)
    except Exception:
        logger.exception("[user_service] Failed to fetch user %s", username)
        return None
    finally:
        await release_conn(conn)


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            f"SELECT {_USER_COLUMNS} FROM users WHERE id::text = $1 LIMIT 1",
            user_id,
        )
        return _shape_user(row)
    except Exception:
        logger.exception("[user_service] Failed to fetch user by id %s", user_id)
        return None
    finally:
        await release_conn(conn)


async def is_admin(username: str) -> bool:
    """Fast check — always true for the owner, otherwise check DB role."""
    if username.lower() == ADMIN_USERNAME.lower():
        return True
    user = await get_user_by_username(username)
    return bool(user and user.get("role") == "admin")
