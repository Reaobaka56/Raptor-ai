"""
Migration runner — applies backend/migrations/*.sql against DATABASE_URL
(or PGVECTOR_CONN_STRING) in filename order, tracking what's already been
applied in a schema_migrations table so re-runs are cheap and safe.

Run manually:
    python -m scripts.run_migrations

Wired into render.yaml's buildCommand so every deploy self-heals schema
drift instead of silently 503ing on missing tables.
"""
import asyncio
import logging
import os
import sys
from pathlib import Path

import asyncpg

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("run_migrations")

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"
DB_URL = os.getenv("DATABASE_URL") or os.getenv("PGVECTOR_CONN_STRING")


async def main() -> int:
    if not DB_URL:
        logger.error("DATABASE_URL/PGVECTOR_CONN_STRING not set — cannot run migrations")
        return 1

    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        logger.warning("No .sql files found in %s", MIGRATIONS_DIR)
        return 0

    conn = await asyncpg.connect(dsn=DB_URL)
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename    TEXT PRIMARY KEY,
                applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        applied = {
            r["filename"] for r in await conn.fetch("SELECT filename FROM schema_migrations")
        }

        for path in files:
            if path.name in applied:
                logger.info("skip  %s (already applied)", path.name)
                continue

            sql = path.read_text()
            logger.info("apply %s", path.name)
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO schema_migrations (filename) VALUES ($1)", path.name
                )
            logger.info("done  %s", path.name)

        logger.info("Migrations up to date (%d total, %d newly applied)",
                     len(files), len(files) - len(applied))
        return 0
    except Exception:
        logger.exception("Migration run failed")
        return 1
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
