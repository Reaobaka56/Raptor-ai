"""Integration tests for the agent/task system and review scoping against a
real Postgres. Skipped unless TEST_DATABASE_URL is set, e.g.

    TEST_DATABASE_URL=postgresql://postgres@/raptor_test?host=/tmp&port=54329 pytest

The DB must already have migrations 002-010 (+016/017) applied (the pgvector
ones, 001/014, are not needed here)."""
import asyncio
import os
import uuid

import pytest
from fastapi import BackgroundTasks, HTTPException

TEST_DB = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL not set")


@pytest.fixture
async def db():
    from app.services import db as dbm
    dbm.DB_URL = TEST_DB
    dbm._pool = None
    await dbm.init_pool()
    conn = await dbm.get_conn()
    await conn.execute(
        "TRUNCATE agent_activity_log, agent_tasks, agents, reviews, users RESTART IDENTITY CASCADE"
    )
    await dbm.release_conn(conn)
    yield dbm
    await dbm._pool.close()
    dbm._pool = None


async def _user(db, name):
    conn = await db.get_conn()
    try:
        row = await conn.fetchrow(
            "INSERT INTO users (github_id, username) VALUES ($1, $2) RETURNING id",
            abs(hash(name)) % 10**9, name,
        )
        return str(row["id"])
    finally:
        await db.release_conn(conn)


def _session(name):
    return {"user": {"username": name}, "access_token": "t"}


# ── jsonb codec ───────────────────────────────────────────────────────────────

async def test_jsonb_roundtrip_objects_and_pre_dumped_strings(db):
    import json
    conn = await db.get_conn()
    try:
        await conn.execute("CREATE TEMP TABLE t (id int, j jsonb)")
        await conn.execute("INSERT INTO t VALUES (1, $1::jsonb)", {"a": [1]})
        await conn.execute("INSERT INTO t VALUES (2, $1::jsonb)", json.dumps({"a": [1]}))
        await conn.execute("INSERT INTO t VALUES (3, $1::jsonb)", "plain string")
        rows = await conn.fetch("SELECT id, j, jsonb_typeof(j) AS ty FROM t ORDER BY id")
        assert [r["j"] for r in rows] == [{"a": [1]}, {"a": [1]}, "plain string"]
        assert [r["ty"] for r in rows] == ["object", "object", "string"]
    finally:
        await db.release_conn(conn)


# ── agents ────────────────────────────────────────────────────────────────────

async def test_agent_create_validate_and_status_machine(db):
    from app.services import agent_service as A
    uid = await _user(db, "alice")

    ag = await A.create_agent(uid, {"name": "Eng", "tools": ["file_read", "lint"], "permissions": {"can_commit": False}})
    assert ag["tools"] == ["file_read", "lint"] and ag["permissions"] == {"can_commit": False}
    assert ag["status"] == "idle"

    with pytest.raises(A.AgentValidationError):
        await A.create_agent(uid, {"name": "Bad", "tools": ["rm_rf"]})
    with pytest.raises(A.AgentValidationError):
        await A.create_agent(uid, {"name": "  "})
    with pytest.raises(A.AgentValidationError):
        await A.update_agent(ag["id"], uid, {"provider": "nonsense"})

    assert (await A.update_agent_status(ag["id"], uid, "working"))["status"] == "working"
    with pytest.raises(ValueError):
        await A.update_agent_status(ag["id"], uid, "planning")  # working -> planning invalid
    assert await A.get_agent("not-a-uuid", uid) is None


async def test_agent_tenant_isolation(db):
    from app.services import agent_service as A
    a, b = await _user(db, "alice"), await _user(db, "bob")
    ag = await A.create_agent(a, {"name": "Mine"})
    assert await A.get_agent(ag["id"], b) is None
    assert await A.update_agent(ag["id"], b, {"name": "pwn"}) is None
    assert await A.delete_agent(ag["id"], b) is False
    assert await A.update_agent_status(ag["id"], b, "working") is None


# ── tasks ─────────────────────────────────────────────────────────────────────

async def test_task_validation_and_ownership(db):
    from app.services import agent_service as A, task_service as T
    a, b = await _user(db, "alice"), await _user(db, "bob")
    bobs_agent = await A.create_agent(b, {"name": "Bob's"})
    with pytest.raises(T.ValidationError):
        await T.create_task(a, {"title": "x", "assigned_agent_id": bobs_agent["id"]})
    with pytest.raises(T.ValidationError):
        await T.create_task(a, {"title": "x", "priority": "high"})
    with pytest.raises(T.ValidationError):
        await T.create_task(a, {"title": "x", "status": "whatever"})
    with pytest.raises(T.ValidationError):
        await T.create_task(a, {"title": ""})
    t = await T.create_task(a, {"title": "ok", "priority": 1})
    with pytest.raises(T.ValidationError):
        await T.update_task(t["id"], a, {"dependencies": [t["id"]]})  # self-dependency
    assert await T.get_task(t["id"], b) is None
    assert await T.get_task("nope", a) is None


async def test_claim_is_atomic_and_stale_runs_recover(db):
    from app.services import task_service as T
    a = await _user(db, "alice")
    t = await T.create_task(a, {"title": "x"})
    results = await asyncio.gather(*[T.claim_task(t["id"], a) for _ in range(5)])
    assert sum(r is not None for r in results) == 1          # exactly one winner
    conn = await db.get_conn()
    await conn.execute("UPDATE agent_tasks SET started_at = now() - interval '1 hour' WHERE id = $1::uuid", t["id"])
    await db.release_conn(conn)
    assert await T.claim_task(t["id"], a) is not None         # stale -> reclaimable


async def test_unmet_dependencies(db):
    from app.services import task_service as T
    a = await _user(db, "alice")
    dep = await T.create_task(a, {"title": "dep"})
    t = await T.create_task(a, {"title": "main", "dependencies": [dep["id"]]})
    assert await T.unmet_dependencies(t, a) == [dep["id"]]
    await T.update_task(dep["id"], a, {"status": "done"})
    assert await T.unmet_dependencies(t, a) == []


# ── end-to-end execution ──────────────────────────────────────────────────────

async def _setup_run(db, monkeypatch, provider_fn, key=("k", False)):
    from app import task_router as R
    from app.services import agent_service as A, task_service as T
    uid = await _user(db, "alice")
    ag = await A.create_agent(uid, {"name": "Eng", "provider": "google"})
    t = await T.create_task(uid, {"title": "Do it", "description": "desc", "assigned_agent_id": ag["id"]})

    async def fake_key(owner, provider):
        return key
    monkeypatch.setattr(R, "_resolve_api_key", fake_key)
    monkeypatch.setattr(R, "_call_provider", provider_fn)
    return R, A, T, uid, ag, t


async def _execute(R, uid, task_id, name="alice"):
    bt = BackgroundTasks()
    res = await R.execute_task(task_id, bt, _session(name))
    await bt()                                   # run the background job to completion
    return res


async def test_execute_happy_path(db, monkeypatch):
    R, A, T, uid, ag, t = await _setup_run(db, monkeypatch, lambda *a: "result text")
    res = await _execute(R, uid, t["id"])
    assert res["status"] == "started"
    done = await T.get_task(t["id"], uid)
    assert done["status"] == "done" and done["output"] == "result text" and done["completed_at"]
    agent = await A.get_agent(ag["id"], uid)
    assert agent["status"] == "idle" and agent["current_task_id"] is None
    kinds = [x["activity_type"] for x in await A.get_activity_log(uid, ag["id"])]
    assert "task_assigned" in kinds and "task_completed" in kinds


async def test_execute_failure_records_valid_error_json(db, monkeypatch):
    def boom(*a):
        raise RuntimeError('bad "quote" \n {json: [broken}')
    R, A, T, uid, ag, t = await _setup_run(db, monkeypatch, boom)
    await _execute(R, uid, t["id"])
    task = await T.get_task(t["id"], uid)
    assert task["status"] == "failed"
    assert isinstance(task["errors"], list) and 'bad "quote"' in task["errors"][0]["error"]
    assert (await A.get_agent(ag["id"], uid))["status"] == "idle"


async def test_execute_times_out(db, monkeypatch):
    import time
    R, A, T, uid, ag, t = await _setup_run(db, monkeypatch, lambda *a: time.sleep(1.5) or "late")
    monkeypatch.setattr(R, "LLM_TIMEOUT_SECONDS", 0.2)
    await _execute(R, uid, t["id"])
    task = await T.get_task(t["id"], uid)
    assert task["status"] == "failed" and "Timed out" in task["errors"][0]["error"]


async def test_execute_without_key_fails_cleanly(db, monkeypatch):
    R, A, T, uid, ag, t = await _setup_run(db, monkeypatch, lambda *a: "x", key=(None, False))
    await _execute(R, uid, t["id"])
    task = await T.get_task(t["id"], uid)
    assert task["status"] == "failed" and "No API key" in task["errors"][0]["error"]


async def test_execute_rejects_double_start_busy_agent_and_unmet_deps(db, monkeypatch):
    R, A, T, uid, ag, t = await _setup_run(db, monkeypatch, lambda *a: "x")
    bt = BackgroundTasks()
    await R.execute_task(t["id"], bt, _session("alice"))            # claims, not yet run
    with pytest.raises(HTTPException) as e:
        await R.execute_task(t["id"], BackgroundTasks(), _session("alice"))
    assert e.value.status_code == 409

    t2 = await T.create_task(uid, {"title": "second", "assigned_agent_id": ag["id"]})
    with pytest.raises(HTTPException) as e:
        await R.execute_task(t2["id"], BackgroundTasks(), _session("alice"))
    assert e.value.status_code == 409 and "busy" in e.value.detail
    assert (await T.get_task(t2["id"], uid))["status"] != "in_progress"   # claim was rolled back

    dep = await T.create_task(uid, {"title": "dep"})
    t3 = await T.create_task(uid, {"title": "needs dep", "assigned_agent_id": ag["id"], "dependencies": [dep["id"]]})
    with pytest.raises(HTTPException) as e:
        await R.execute_task(t3["id"], BackgroundTasks(), _session("alice"))
    assert e.value.status_code == 409 and "dependency" in e.value.detail


async def test_provider_key_resolution_and_no_cross_provider_substitution(db, monkeypatch):
    from app import task_router as R
    async def none(*a): return None
    monkeypatch.setattr(R, "get_decrypted_key", none)
    for var in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "MISTRAL_API_KEY"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "platform-gemini")
    assert await R._resolve_api_key("u", "openai") == (None, False)      # never falls back to Gemini
    assert await R._resolve_api_key("u", "google") == ("platform-gemini", True)
    assert R._canonical_provider("Gemini") == "google"
    with pytest.raises(R.RunError):
        R._call_provider("cohere", "k", "m", "", "p")                      # no wrong-API call


# ── reviews: persistence + tenant scoping ─────────────────────────────────────

async def test_review_persist_scope_and_stats(db):
    from datetime import datetime, timezone
    from app.models import Review, ReviewIssue
    from app.services.scan_service import save_review
    from app.reviews_router import review_scope_sql, get_all_reviews, get_review_by_id
    from app.telemetry_router import get_stats

    a, b = await _user(db, "alice"), await _user(db, "bob")
    issue = ReviewIssue(file="a.py", line=1, severity="critical", category="security",
                        title="t", description="d", suggestion="s", confidence=90)

    def mk(repo):
        return Review(id=str(uuid.uuid4()), githubRepo=repo, prNumber=1, issues=[issue],
                      summary="s", status="completed", reviewTimeMs=100,
                      createdAt=datetime.now(timezone.utc).isoformat())

    ra, rb, rorg = mk("someorg/x"), mk("bob/y"), mk("alice/z")
    await save_review(ra, a)          # alice triggered it
    await save_review(rb, b)          # bob's
    await save_review(rorg, None)     # webhook review on alice's own repo

    mine = await get_all_reviews(_session("alice"))
    assert {r["id"] for r in mine} == {ra.id, rorg.id}
    assert mine[0]["issues"] and isinstance(mine[0]["createdAt"], str)
    with pytest.raises(HTTPException) as e:
        await get_review_by_id(rb.id, _session("alice"))
    assert e.value.status_code == 404

    stats = await get_stats(None, _session("alice"))
    assert stats.totalReviews == 2 and stats.totalIssues == 2
    assert stats.issuesBySeverity.critical == 2
    assert (await get_stats(None, _session("bob"))).totalReviews == 1
