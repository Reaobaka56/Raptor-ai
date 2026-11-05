"""Integration fixtures: a real Postgres, skipped unless TEST_DATABASE_URL is set.

    TEST_DATABASE_URL=postgresql://postgres@/raptor_test?host=/tmp&port=54329 pytest -m integration

The database must already have migrations applied (the pgvector ones, 001/014,
are not required by these tests).
"""
import os

import pytest

TEST_DB = os.getenv("TEST_DATABASE_URL")


def pytest_collection_modifyitems(config, items):
    if TEST_DB:
        return
    skip = pytest.mark.skip(reason="TEST_DATABASE_URL not set")
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip)


@pytest.fixture
async def db():
    from app.services import db as dbm
    dbm.DB_URL = TEST_DB
    dbm._pool = None
    await dbm.init_pool()
    conn = await dbm.get_conn()
    await conn.execute(
        "TRUNCATE agent_activity_log, agent_tasks, agents, reviews, sandbox_sessions, users RESTART IDENTITY CASCADE"
    )
    await dbm.release_conn(conn)
    yield dbm
    await dbm._pool.close()
    dbm._pool = None
