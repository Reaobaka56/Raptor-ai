"""
Session store — Postgres-backed (see migrations/010_sessions.sql).

Previously Redis-backed. Sessions now live in the same Postgres DB that
sign-in already depends on for the users table, so login has one fewer
external dependency that can be missing/misconfigured. Fails closed on DB
errors (same as before) — callers should treat exceptions as "auth
temporarily unavailable", not silently degrade to per-instance state.
"""
import os
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "3600"))


class SessionStoreUnavailable(Exception):
    """Raised when the DB pool isn't configured/reachable. Callers should
    map this to a 503, matching the old Redis-unavailable behavior."""


async def save_session(token: str, session: Dict[str, Any]) -> None:
    conn = await get_conn()
    if not conn:
        raise SessionStoreUnavailable("database pool unavailable")
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
        await conn.execute(
            """
            INSERT INTO sessions (token, data, expires_at)
            VALUES ($1, $2::jsonb, $3)
            ON CONFLICT (token) DO UPDATE SET
                data = EXCLUDED.data,
                expires_at = EXCLUDED.expires_at
            """,
            token, json.dumps(session, default=str), expires_at,
        )
    except SessionStoreUnavailable:
        raise
    except Exception as e:
        logger.exception("[session_store] Failed to save session")
        raise SessionStoreUnavailable(str(e))
    finally:
        await release_conn(conn)


async def get_session(token: str) -> Optional[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        raise SessionStoreUnavailable("database pool unavailable")
    try:
        row = await conn.fetchrow(
            "SELECT data FROM sessions WHERE token = $1 AND expires_at > now()",
            token,
        )
        if not row:
            return None
        data = row["data"]
        return json.loads(data) if isinstance(data, str) else data
    except SessionStoreUnavailable:
        raise
    except Exception:
        logger.exception("[session_store] Failed to fetch session")
        raise SessionStoreUnavailable("query failed")
    finally:
        await release_conn(conn)


async def delete_session(token: str) -> None:
    conn = await get_conn()
    if not conn:
        return
    try:
        await conn.execute("DELETE FROM sessions WHERE token = $1", token)
    except Exception:
        logger.exception("[session_store] Failed to delete session")
    finally:
        await release_conn(conn)


async def refresh_session(token: str) -> None:
    conn = await get_conn()
    if not conn:
        return
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
        await conn.execute(
            "UPDATE sessions SET expires_at = $2 WHERE token = $1",
            token, expires_at,
        )
    except Exception:
        logger.exception("[session_store] Failed to refresh session")
    finally:
        await release_conn(conn)
