"""
Migration runner — applies backend/migrations/*.sql against the configured
Postgres DB at startup, in filename order, tracking what's already been
applied in a `schema_migrations` table so each file runs exactly once.

This closes the gap that let 010_sessions.sql exist in the repo without
ever being applied to production: nothing previously executed migration
files outside of memory_service's one-off 001 runner. Every future
migration file dropped into backend/migrations/ now gets picked up
automatically on next deploy — no manual `psql -f` step required.
"""
import os
import logging

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "migrations")

_CREATE_TRACKING_TABLE = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


async def run_pending_migrations() -> None:
    """Apply any .sql files in migrations/ not yet recorded in
    schema_migrations. No-ops quietly if the DB pool isn't configured
    (matches the rest of the app's fail-open-at-boot behavior — a missing
    DB surfaces as 503s on DB-backed routes, not a crash at startup)."""
    conn = await get_conn()
    if not conn:
        logger.warning("[migrations] DB pool unavailable; skipping migration run")
        return

    try:
        await conn.execute(_CREATE_TRACKING_TABLE)

        applied_rows = await conn.fetch("SELECT filename FROM schema_migrations")
        applied = {r["filename"] for r in applied_rows}

        if not os.path.isdir(MIGRATIONS_DIR):
            logger.warning("[migrations] migrations dir not found at %s", MIGRATIONS_DIR)
            return

        pending = sorted(f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql") and f not in applied)

        if not pending:
            logger.info("[migrations] up to date (%d already applied)", len(applied))
            return

        for filename in pending:
            path = os.path.join(MIGRATIONS_DIR, filename)
            with open(path, "r") as f:
                sql = f.read()
            try:
                async with conn.transaction():
                    await conn.execute(sql)
                    await conn.execute(
                        "INSERT INTO schema_migrations (filename) VALUES ($1)", filename
                    )
                logger.info("[migrations] applied %s", filename)
            except Exception:
                logger.exception("[migrations] failed to apply %s — stopping migration run", filename)
                # Stop rather than skip ahead: later migrations may depend on
                # this one (e.g. foreign keys onto a table it creates).
                raise
    finally:
        await release_conn(conn)
