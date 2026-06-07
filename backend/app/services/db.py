import os
from typing import Optional

DB_URL = os.getenv("DATABASE_URL") or os.getenv("PGVECTOR_CONN_STRING")

_pool = None


def init_pool(minconn: int = 2, maxconn: int = 10):
    global _pool
    if not DB_URL:
        return None
    if _pool is not None:
        return _pool
    try:
        from psycopg2 import pool
        _pool = pool.ThreadedConnectionPool(minconn, maxconn, dsn=DB_URL)
        return _pool
    except Exception as e:
        import logging
        logging.exception("[db] Failed to create connection pool")
        _pool = None
        return None


def get_conn():
    global _pool
    if _pool is None:
        init_pool()
    if _pool:
        return _pool.getconn()
    # Fallback to a direct connection (not pooled)
    if not DB_URL:
        return None
    import psycopg2
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    return conn


def release_conn(conn):
    global _pool
    if not conn:
        return
    try:
        if _pool:
            _pool.putconn(conn)
        else:
            conn.close()
    except Exception:
        try:
            conn.close()
        except Exception:
            pass
