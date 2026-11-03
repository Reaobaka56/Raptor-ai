import json
import logging
import os
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)
DB_URL = os.getenv("DATABASE_URL") or os.getenv("PGVECTOR_CONN_STRING")

_pool: Optional[asyncpg.Pool] = None


def _jsonb_encode(value) -> str:
    """Encoder for json/jsonb params. Call sites pass EITHER a Python object
    (correct) OR a pre-serialized JSON string via json.dumps(...) (very common
    in this codebase). Blindly json.dumps-ing the second form stores a JSON
    *string* containing JSON text instead of an object/array, which breaks
    jsonb_array_elements(), `col || $1::jsonb`, and every reader. So: a str
    that already parses to an object/array is passed through untouched; any
    other value is serialized normally."""
    if isinstance(value, str):
        try:
            if isinstance(json.loads(value), (dict, list)):
                return value
        except ValueError:
            pass
    return json.dumps(value, default=str)


def _jsonb_decode(text: str):
    """Decoder that also repairs legacy double-encoded rows (a JSON string
    holding serialized JSON) written before _jsonb_encode existed."""
    value = json.loads(text)
    if isinstance(value, str) and value.lstrip()[:1] in ("{", "["):
        try:
            inner = json.loads(value)
            if isinstance(inner, (dict, list)):
                return inner
        except ValueError:
            pass
    return value


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Per-connection setup, run by asyncpg on every new pooled connection.

    asyncpg returns json/jsonb columns as raw text by default (unlike
    psycopg2), so we register codecs that decode to Python objects pool-wide
    instead of patching every call site. See _jsonb_encode/_jsonb_decode for
    the double-encoding pitfalls this guards against.
    """
    for typename in ("json", "jsonb"):
        await conn.set_type_codec(
            typename,
            encoder=_jsonb_encode,
            decoder=_jsonb_decode,
            schema="pg_catalog",
        )


async def init_pool(minconn: int = 2, maxconn: int = int(os.getenv("DB_POOL_MAX", "20"))):
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
            command_timeout=float(os.getenv("DB_COMMAND_TIMEOUT", "30")),
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
    # Fail fast instead of queueing forever when the pool is exhausted.
    return await _pool.acquire(timeout=float(os.getenv("DB_ACQUIRE_TIMEOUT", "10")))


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
