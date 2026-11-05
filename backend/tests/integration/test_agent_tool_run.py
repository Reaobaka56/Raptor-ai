"""End-to-end: an agent attached to a REAL sandbox session (local executor)
runs the tool loop with a scripted LLM, against a real Postgres. Verifies that
tools/permissions are enforced, files really land in the workspace, activity is
logged, and tasks that changed things wait for human approval."""
import json
import os

import pytest
from fastapi import BackgroundTasks

from helpers import _user, _session

pytestmark = pytest.mark.integration


def J(**kw):
    return json.dumps(kw)


async def setup(db, monkeypatch, replies, tools, **perms):
    from app import task_router as R
    from app.services import agent_service as A, task_service as T, sandbox_service as S
    monkeypatch.delenv("SANDBOX_BACKEND", raising=False)
    monkeypatch.delenv("SANDBOX_REQUIRE_ISOLATION", raising=False)
    uid = await _user(db, "alice")
    sbx = await S.create_session(uid, "ws", None, "coder", {}, {})
    ag = await A.create_agent(uid, {"name": "Dev", "tools": tools, "permissions": perms})
    await A.attach_agent_to_sandbox(ag["id"], uid, sbx["id"])
    t = await T.create_task(uid, {"title": "Do work", "assigned_agent_id": ag["id"]})

    it = iter(replies)
    prompts = []

    def fake_provider(provider, key, model, system, prompt):
        prompts.append(prompt)
        return next(it)

    async def fake_key(owner, provider):
        return ("k", False)
    monkeypatch.setattr(R, "_call_provider", fake_provider)
    monkeypatch.setattr(R, "_resolve_api_key", fake_key)
    return R, A, T, S, uid, ag, sbx, t, prompts


async def run(R, uid, task_id):
    bt = BackgroundTasks()
    await R.execute_task(task_id, bt, _session("alice"))
    await bt()


async def test_agent_writes_file_runs_command_and_waits_for_review(db, monkeypatch):
    replies = [
        J(tool="file_write", args={"path": "hello.py", "content": "print('hi')\n"}),
        J(tool="command_exec", args={"command": "python3 hello.py"}),
        J(final="created hello.py"),
    ]
    R, A, T, S, uid, ag, sbx, t, prompts = await setup(db, monkeypatch, replies, ["file_write", "command_exec"])
    await run(R, uid, t["id"])

    task = await T.get_task(t["id"], uid)
    assert task["status"] == "review" and task["review_status"] == "pending" and task["completed_at"] is None
    assert "created hello.py" in task["output"] and "files changed: hello.py" in task["output"]
    ws = (await S.get_session(sbx["id"], uid))["workspace_path"]
    assert open(os.path.join(ws, "hello.py")).read() == "print('hi')\n"
    assert "hi" in prompts[2]                                        # command output reached the model
    kinds = [x["activity_type"] for x in await A.get_activity_log(uid, ag["id"])]
    assert "file_modified" in kinds and "command_run" in kinds and "task_completed" in kinds
    assert (await A.get_agent(ag["id"], uid))["status"] == "idle"


async def test_requires_approval_false_completes_directly(db, monkeypatch):
    replies = [J(tool="file_write", args={"path": "a.txt", "content": "x"}), J(final="ok")]
    R, A, T, S, uid, ag, sbx, t, _ = await setup(db, monkeypatch, replies, ["file_write"], requires_approval=False)
    await run(R, uid, t["id"])
    task = await T.get_task(t["id"], uid)
    assert task["status"] == "done" and task["completed_at"]


async def test_allowed_paths_enforced_end_to_end(db, monkeypatch):
    replies = [J(tool="file_write", args={"path": "src/app.py", "content": "pwned"}),
               J(tool="file_write", args={"path": "docs/ok.md", "content": "fine"}),
               J(final="done")]
    R, A, T, S, uid, ag, sbx, t, prompts = await setup(db, monkeypatch, replies, ["file_write"], allowed_paths=["docs/"])
    await run(R, uid, t["id"])
    ws = (await S.get_session(sbx["id"], uid))["workspace_path"]
    assert not os.path.exists(os.path.join(ws, "src", "app.py"))
    assert open(os.path.join(ws, "docs", "ok.md")).read() == "fine"
    assert "DENIED" in prompts[1]


async def test_disabled_tool_and_commit_denied(db, monkeypatch):
    replies = [J(tool="command_exec", args={"command": "echo no"}),            # tool not enabled
               J(tool="git_ops", args={"args": "commit -m x"}),                # can_commit false
               J(final="done")]
    R, A, T, S, uid, ag, sbx, t, prompts = await setup(db, monkeypatch, replies, ["git_ops", "file_read"])
    await run(R, uid, t["id"])
    task = await T.get_task(t["id"], uid)
    assert task["status"] == "done"                                             # nothing changed -> no review needed
    assert "not enabled" in prompts[1] and "not permitted to commit" in prompts[2]


async def test_sandbox_secret_policy_still_applies_under_agent_policy(db, monkeypatch):
    replies = [J(tool="file_read", args={"path": ".env"}), J(final="done")]
    R, A, T, S, uid, ag, sbx, t, prompts = await setup(db, monkeypatch, replies, ["file_read"])
    await run(R, uid, t["id"])
    assert "sensitive path blocked" in prompts[1] or "ERROR" in prompts[1] or "DENIED" in prompts[1]


async def test_stopped_sandbox_fails_task_cleanly(db, monkeypatch):
    R, A, T, S, uid, ag, sbx, t, _ = await setup(db, monkeypatch, [J(final="x")], ["file_read"])
    await S.stop_session(sbx["id"], uid)
    await run(R, uid, t["id"])
    task = await T.get_task(t["id"], uid)
    assert task["status"] == "failed" and "not running" in task["errors"][0]["error"]
    assert (await A.get_agent(ag["id"], uid))["status"] == "idle"


async def test_agent_without_sandbox_still_does_plain_completion(db, monkeypatch):
    from app import task_router as R
    from app.services import agent_service as A, task_service as T
    uid = await _user(db, "alice")
    ag = await A.create_agent(uid, {"name": "Plain", "tools": ["file_read"]})
    t = await T.create_task(uid, {"title": "think", "assigned_agent_id": ag["id"]})
    monkeypatch.setattr(R, "_call_provider", lambda *a: "just text")
    async def k(o, p): return ("k", False)
    monkeypatch.setattr(R, "_resolve_api_key", k)
    await run(R, uid, t["id"])
    task = await T.get_task(t["id"], uid)
    assert task["status"] == "done" and task["output"] == "just text"
