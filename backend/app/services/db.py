import json
import logging
import os
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)
DB_URL = os.getenv("DATABASE_URL") or os.getenv("PGVECTOR_CONN_STRING")

_pool: Optional[asyncpg.Pool] = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Per-connection setup, run by asyncpg on every new pooled connection.

    Unlike psycopg2 (which auto-decoded json/jsonb columns into dicts/lists
    via psycopg2.extras), asyncpg returns json/jsonb columns as raw text by
    default. Without this, every jsonb column (meetings, provider keys,
    agent configs, telemetry payloads, etc.) comes back as a JSON *string*
    instead of a parsed object/array, which breaks consumers that expect a
    dict/list (e.g. frontend code calling .filter() on what it assumes is
    an array). Registering these codecs restores the old psycopg2 behavior
    pool-wide instead of patching every call site individually.
    """
    await conn.set_type_codec(
        "json",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def init_pool(minconn: int = 2, maxconn: int = 10):
    global _pool
    if not DB_URL:
        logger.warning("[db] DATABASE_URL/PGVECTOR_CONN_STRING not configured; skipping connection pool initialization")
        return None
    if _pool is not None:
        return _pool
    try:
        # statement_cache_size=0 disables asyncpg's client-side prepared
        # statement cache. Required when DB_URL points at Supabase's
        # pgbouncer connection pooler (transaction mode) since pgbouncer
        # can route each query to a different backend connection, breaking
        # server-side prepared statements. Harmless against a direct
        # Postgres connection too, so this is safe either way.
        _pool = await asyncpg.create_pool(
            dsn=DB_URL,
            min_size=minconn,
            max_size=maxconn,
            statement_cache_size=0,
            init=_init_connection,
        )
        return _pool
    except Exception:
        logger.exception("[db] Failed to create connection pool")
        _pool = None
        return None


async def get_conn() -> Optional[asyncpg.pool.PoolConnectionProxy]:
    """Acquire a connection from the pool. Must be paired with release_conn
    in a finally block. Returns None if the pool/DB isn't configured."""
    global _pool
    if _pool is None:
        await init_pool()
    if _pool is None:
        return None
    return await _pool.acquire()


async def release_conn(conn) -> None:
    global _pool
    if not conn or _pool is None:
        return
    try:
        await _pool.release(conn)
    except Exception:
        logger.exception("[db] Failed to release connection back to pool")


def row_to_dict(row) -> Optional[dict]:
    """Convert an asyncpg Record into a plain, JSON-safe dict — serializes
    UUIDs (via str) and datetimes/dates (via .isoformat()). Shared across
    services so row-shaping logic isn't copy-pasted per file.

    NOTE: signature changed from the psycopg2 version (which took
    `(cur, row)`); asyncpg Records carry their own column names, so only
    the row itself is needed now.
    """
    if row is None:
        return None
    d = dict(row)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif hasattr(v, "hex") and not isinstance(v, (str, bytes, bytearray, int)):
            d[k] = str(v)
    return d


def rows_to_dicts(rows) -> list:
    return [row_to_dict(r) for r in rows]
