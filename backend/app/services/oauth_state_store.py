"""
OAuth state store — Postgres-backed (see migrations/015_oauth_state.sql).

Previously Redis-backed, left over from before sessions moved to Postgres
in migration 010. No Redis service is provisioned, so this was hard-failing
every /api/auth/github/login call with a 503. Mirrors session_store.py:
fails closed on DB errors — callers should treat exceptions as "auth
temporarily unavailable", not silently degrade.
"""
import os
import logging
from datetime import datetime, timedelta, timezone

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)

OAUTH_STATE_TTL_SECONDS = int(os.getenv("OAUTH_STATE_TTL_SECONDS", "600"))


class OAuthStateStoreUnavailable(Exception):
    """Raised when the DB pool isn't configured/reachable. Callers should
    map this to a 503, matching the old Redis-unavailable behavior."""


async def save_oauth_state(state: str) -> None:
    conn = await get_conn()
    if not conn:
        raise OAuthStateStoreUnavailable("database pool unavailable")
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=OAUTH_STATE_TTL_SECONDS)
        await conn.execute(
            """
            INSERT INTO oauth_state (state, expires_at)
            VALUES ($1, $2)
            ON CONFLICT (state) DO UPDATE SET expires_at = EXCLUDED.expires_at
            """,
            state, expires_at,
        )
    except OAuthStateStoreUnavailable:
        raise
    except Exception as e:
        logger.exception("[oauth_state_store] Failed to save state")
        raise OAuthStateStoreUnavailable(str(e))
    finally:
        await release_conn(conn)


async def consume_oauth_state(state: str) -> bool:
    """Verify and delete in one shot so a state value can't be replayed."""
    conn = await get_conn()
    if not conn:
        raise OAuthStateStoreUnavailable("database pool unavailable")
    try:
        row = await conn.fetchrow(
            "DELETE FROM oauth_state WHERE state = $1 AND expires_at > now() RETURNING state",
            state,
        )
        return row is not None
    except OAuthStateStoreUnavailable:
        raise
    except Exception as e:
        logger.exception("[oauth_state_store] Failed to verify state")
        raise OAuthStateStoreUnavailable(str(e))
    finally:
        await release_conn(conn)
