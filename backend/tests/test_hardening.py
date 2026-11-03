import asyncio
import os

import pytest

from app.services import sandbox_service as sb


def test_sandbox_env_does_not_leak_secrets(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://secret")
    monkeypatch.setenv("GEMINI_API_KEY", "sk-secret")
    env = sb._sandbox_env("/tmp", "sid")
    assert "DATABASE_URL" not in env and "GEMINI_API_KEY" not in env
    assert env["SANDBOX"] == "1" and env["RAPTOR_SANDBOX_ID"] == "sid"


def test_sandbox_command_cannot_read_server_env(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "sk-secret")
    r = sb._run_blocking("env", str(tmp_path), sb._sandbox_env(str(tmp_path), "s"), 10)
    assert "sk-secret" not in r.stdout


def test_sandbox_timeout_kills_process_group(tmp_path):
    import subprocess
    with pytest.raises(subprocess.TimeoutExpired):
        sb._run_blocking("sleep 30", str(tmp_path), sb._sandbox_env(str(tmp_path), "s"), 1)


async def test_exec_does_not_block_event_loop(tmp_path):
    ticks = 0

    async def ticker():
        nonlocal ticks
        while True:
            await asyncio.sleep(0.05)
            ticks += 1

    t = asyncio.create_task(ticker())
    await asyncio.to_thread(
        sb._run_blocking, "sleep 1", str(tmp_path), sb._sandbox_env(str(tmp_path), "s"), 5
    )
    t.cancel()
    assert ticks >= 10  # loop kept running while the command ran


@pytest.mark.parametrize("path", ["/api/reviews", "/api/stats", "/api/repos"])
def test_review_endpoints_require_auth(client, path):
    assert client.get(path).status_code == 401


def test_debug_solve_requires_auth(client):
    r = client.post("/debug/solve", json={"stack_trace": "x", "files": []})
    assert r.status_code in (401, 422)


def test_embeddings_fallback_is_deterministic_768(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    from app.services import embedding_service as es
    a = es.generate_embeddings_batch(["hello", "world", ""])
    assert len(a) == 3 and all(len(v) == 768 for v in a)
    assert es.generate_embedding("hello") == a[0]
