"""
User service — upsert/fetch user records from the users table.
All mutations go through this module so the rest of the app stays DB-agnostic.
"""
import logging
from typing import Optional, Dict, Any

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)

ADMIN_USERNAME = "reaobaka56"


def upsert_user(github_id: int, username: str, name: Optional[str],
                email: Optional[str], avatar_url: Optional[str]) -> Optional[Dict[str, Any]]:
    """
    Insert or update a user record on every GitHub login.
    Returns the full user row as a dict, or None if the DB is unavailable.
    """
    conn = get_conn()
    if not conn:
        logger.warning("[user_service] DB unavailable — skipping user upsert for %s", username)
        return None

    # Force admin role for the owner account regardless of what's in the DB
    role = "admin" if username.lower() == ADMIN_USERNAME.lower() else "user"

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (github_id, username, name, email, avatar_url, role, last_login_at)
                VALUES (%s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (github_id) DO UPDATE SET
                    username      = EXCLUDED.username,
                    name          = EXCLUDED.name,
                    email         = COALESCE(EXCLUDED.email, users.email),
                    avatar_url    = EXCLUDED.avatar_url,
                    role          = CASE WHEN users.username = %s THEN 'admin' ELSE users.role END,
                    last_login_at = now()
                RETURNING id, github_id, username, name, email, avatar_url,
                          role, account_status, created_at, last_login_at
                """,
                (github_id, username, name, email, avatar_url, role, ADMIN_USERNAME),
            )
            conn.commit()
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            user = dict(zip(cols, row))
            # Convert UUID and datetimes to strings for JSON serialisation
            user["id"] = str(user["id"])
            user["created_at"] = user["created_at"].isoformat() if user["created_at"] else None
            user["last_login_at"] = user["last_login_at"].isoformat() if user["last_login_at"] else None
            return user
    except Exception:
        logger.exception("[user_service] Failed to upsert user %s", username)
        try:
            conn.rollback()
        except Exception:
            pass
        return None
    finally:
        release_conn(conn)


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, github_id, username, name, email, avatar_url,
                       role, account_status, created_at, last_login_at
                FROM users WHERE username = %s LIMIT 1
                """,
                (username,),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            user = dict(zip(cols, row))
            user["id"] = str(user["id"])
            user["created_at"] = user["created_at"].isoformat() if user["created_at"] else None
            user["last_login_at"] = user["last_login_at"].isoformat() if user["last_login_at"] else None
            return user
    except Exception:
        logger.exception("[user_service] Failed to fetch user %s", username)
        return None
    finally:
        release_conn(conn)


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, github_id, username, name, email, avatar_url,
                       role, account_status, created_at, last_login_at
                FROM users WHERE id = %s LIMIT 1
                """,
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            user = dict(zip(cols, row))
            user["id"] = str(user["id"])
            user["created_at"] = user["created_at"].isoformat() if user["created_at"] else None
            user["last_login_at"] = user["last_login_at"].isoformat() if user["last_login_at"] else None
            return user
    except Exception:
        logger.exception("[user_service] Failed to fetch user by id %s", user_id)
        return None
    finally:
        release_conn(conn)


def is_admin(username: str) -> bool:
    """Fast check — always true for the owner, otherwise check DB role."""
    if username.lower() == ADMIN_USERNAME.lower():
        return True
    user = get_user_by_username(username)
    return bool(user and user.get("role") == "admin")
