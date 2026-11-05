"""
Task router — REST API for agent tasks with real LLM execution.
"""
import asyncio
import logging
import os
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from .auth_dependencies import get_required_github_session, get_current_user as _get_user
from .services.user_service import get_user_by_username
from .services import task_service, agent_service, agent_runtime
from .services.provider_key_service import get_decrypted_key
from .services.db import get_conn, release_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


async def _get_agent(agent_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    # Full agent row (incl. sandbox_id, which the tool runtime needs).
    return await agent_service.get_agent(agent_id, owner_id)


# ── LLM providers ─────────────────────────────────────────────────────────────
# These are blocking calls; _run_task always runs them in a worker thread,
# under a concurrency cap and an overall timeout.

LLM_TIMEOUT_SECONDS = int(os.getenv("AGENT_LLM_TIMEOUT_SECONDS", "120"))
AGENT_RUN_TIMEOUT_SECONDS = int(os.getenv("AGENT_RUN_TIMEOUT_SECONDS", "600"))
_llm_semaphore = asyncio.Semaphore(int(os.getenv("MAX_CONCURRENT_AGENT_RUNS", "8")))
PLATFORM_DAILY_LIMIT = int(os.getenv("AGENT_PLATFORM_DAILY_LIMIT", "25"))

# OpenAI-compatible chat/completions endpoints.
OPENAI_COMPATIBLE = {
    "openai":     ("https://api.openai.com/v1/chat/completions", "gpt-4o", "OPENAI_API_KEY"),
    "groq":       ("https://api.groq.com/openai/v1/chat/completions", "llama-3.3-70b-versatile", "GROQ_API_KEY"),
    "mistral":    ("https://api.mistral.ai/v1/chat/completions", "mistral-large-latest", "MISTRAL_API_KEY"),
    "deepseek":   ("https://api.deepseek.com/chat/completions", "deepseek-chat", "DEEPSEEK_API_KEY"),
    "xai":        ("https://api.x.ai/v1/chat/completions", "grok-4", "XAI_API_KEY"),
    "openrouter": ("https://openrouter.ai/api/v1/chat/completions", "openai/gpt-4o", "OPENROUTER_API_KEY"),
}
GEMINI_PROVIDERS = {"gemini", "google"}


def _execute_with_gemini(api_key: str, model: str, system_prompt: str, task_prompt: str) -> str:
    """Call Google Gemini with the given system prompt and task."""
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=api_key)
    resp = client.models.generate_content(
        model=model or "gemini-2.5-pro",
        contents=task_prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
            system_instruction=system_prompt or None,
        ),
    )
    return resp.text or ""


def _execute_openai_compatible(provider: str, api_key: str, model: str,
                               system_prompt: str, task_prompt: str) -> str:
    import requests
    url, default_model, _ = OPENAI_COMPATIBLE[provider]
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": task_prompt})
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model or default_model, "messages": messages, "temperature": 0.7},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _execute_with_openai(api_key, model, system_prompt, task_prompt) -> str:
    return _execute_openai_compatible("openai", api_key, model, system_prompt, task_prompt)


def _execute_with_groq(api_key, model, system_prompt, task_prompt) -> str:
    return _execute_openai_compatible("groq", api_key, model, system_prompt, task_prompt)


def _execute_with_anthropic(api_key: str, model: str, system_prompt: str, task_prompt: str) -> str:
    """Call Anthropic Claude with the given system prompt and task."""
    import requests
    payload: Dict[str, Any] = {
        "model": model or "claude-sonnet-4-5",
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": task_prompt}],
    }
    if system_prompt:
        payload["system"] = system_prompt
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["content"][0]["text"]


class RunError(Exception):
    """A user-presentable reason a task could not run."""


def _canonical_provider(provider: Optional[str]) -> str:
    p = (provider or "google").lower().strip()
    return "google" if p in GEMINI_PROVIDERS else p


async def _resolve_api_key(owner_id: str, provider: str):
    """Return (api_key, used_platform_key). BYOK first. Google keys may have
    been saved under either 'google' or 'gemini'. The platform key is used only
    for the SAME provider (never substituting another provider's model)."""
    names = ("google", "gemini") if provider == "google" else (provider,)
    for name in names:
        key = await get_decrypted_key(owner_id, name)
        if key:
            return key, False
    if provider == "google":
        env = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    elif provider in OPENAI_COMPATIBLE:
        env = os.getenv(OPENAI_COMPATIBLE[provider][2])
    elif provider == "anthropic":
        env = os.getenv("ANTHROPIC_API_KEY")
    else:
        env = None
    return (env, True) if env else (None, False)


async def _platform_quota_ok(owner_id: str) -> bool:
    """Cap how many runs per UTC day a user can spend on the platform's key.
    Fails open if Redis is unavailable (consistent with the rate limiter)."""
    try:
        from datetime import datetime, timezone
        from .services.redis_client import get_async_redis
        r = get_async_redis()
        key = f"agent_platform_runs:{owner_id}:{datetime.now(timezone.utc):%Y%m%d}"
        n = await r.incr(key)
        if n == 1:
            await r.expire(key, 90000)
        return n <= PLATFORM_DAILY_LIMIT
    except Exception:
        return True


def _call_provider(provider: str, api_key: str, model: str, system_prompt: str, task_prompt: str) -> str:
    if provider == "google":
        return _execute_with_gemini(api_key, model, system_prompt, task_prompt)
    if provider in OPENAI_COMPATIBLE:
        return _execute_openai_compatible(provider, api_key, model, system_prompt, task_prompt)
    if provider == "anthropic":
        return _execute_with_anthropic(api_key, model, system_prompt, task_prompt)
    raise RunError(f"Provider '{provider}' is not supported for task execution yet.")


async def _run_task(task_id: str, owner_id: str, agent: Dict[str, Any]) -> None:
    """Execute one claimed task. No DB connection is held while the LLM runs;
    every state change goes through short atomic helpers."""
    agent_id = agent["id"]
    try:
        task = await task_service.get_task(task_id, owner_id)
        if not task:
            return

        task_prompt = f"Task: {task['title']}"
        if task.get("description"):
            task_prompt += f"\n\nDescription:\n{task['description']}"
        if task.get("input_context"):
            task_prompt += f"\n\nContext:\n{task['input_context']}"

        provider = _canonical_provider(agent.get("provider"))
        model = agent.get("model") or ""
        system_prompt = agent.get("system_prompt") or ""

        api_key, used_platform = await _resolve_api_key(owner_id, provider)
        if not api_key:
            raise RunError(
                f"No API key for provider '{provider}'. Add one in Settings -> API Keys."
            )
        if used_platform and not await _platform_quota_ok(owner_id):
            raise RunError(
                "Daily limit for the shared platform key reached. Add your own API key in Settings -> API Keys."
            )

        async def llm(system: str, prompt: str) -> str:
            async with _llm_semaphore:
                return await asyncio.wait_for(
                    asyncio.to_thread(_call_provider, provider, api_key, model, system, prompt),
                    timeout=LLM_TIMEOUT_SECONDS,
                )

        start = time.time()
        outcome_status = "done"
        sandbox_id = agent.get("sandbox_id")
        if sandbox_id and [t for t in (agent.get("tools") or []) if t in agent_runtime.EXECUTABLE_TOOLS]:
            # Tool-using run inside the attached sandbox, with the agent's tools
            # and permissions enforced by agent_runtime.authorize().
            from .services import sandbox_service
            sess = await sandbox_service.get_session(str(sandbox_id), owner_id)
            if not sess or sess.get("status") != "running":
                raise RunError("The sandbox attached to this agent is not running. Start it or detach the agent.")

            async def on_event(kind: str, desc: str, meta: Dict[str, Any]) -> None:
                await agent_service.log_activity(owner_id, agent_id, kind, desc, {"task_id": task_id, **meta})

            result = await asyncio.wait_for(
                agent_runtime.run_agent_loop(
                    agent, task_prompt, llm,
                    agent_runtime.SandboxToolBackend(str(sandbox_id), owner_id, sess.get("workspace_path")),
                    on_event=on_event,
                ),
                timeout=AGENT_RUN_TIMEOUT_SECONDS,
            )
            output = result.output
            if result.files_changed or result.commands_run:
                output += (f"\n\n---\nSteps: {result.steps} · commands: {result.commands_run} · "
                           f"files changed: {', '.join(result.files_changed) or 'none'}")
                # Agents that changed things need human sign-off unless explicitly disabled.
                if (agent.get("permissions") or {}).get("requires_approval", True):
                    outcome_status = "review"
            if result.incomplete:
                raise RunError(output)
        else:
            output = await llm(system_prompt, task_prompt)
        duration = int((time.time() - start) * 1000)

        await task_service.finish_task(task_id, owner_id, ok=True, output=output, status=outcome_status)
        await agent_service.release_agent(agent_id, owner_id, task_id, "idle")
        await agent_service.log_activity(
            owner_id, agent_id, "task_completed",
            f"Completed task '{task['title']}'" + (" - awaiting your review" if outcome_status == "review" else ""),
            {"task_id": task_id, "duration_ms": duration, "status": outcome_status},
        )
        logger.info("Task %s completed in %dms", task_id, duration)

    except asyncio.TimeoutError:
        await _fail(task_id, owner_id, agent_id, f"Timed out after {LLM_TIMEOUT_SECONDS}s")
    except RunError as e:
        await _fail(task_id, owner_id, agent_id, str(e))
    except Exception as e:
        logger.exception("Task %s failed", task_id)
        await _fail(task_id, owner_id, agent_id, f"{type(e).__name__}: {str(e)[:500]}")


async def _fail(task_id: str, owner_id: str, agent_id: str, message: str) -> None:
    await task_service.finish_task(task_id, owner_id, ok=False, error=message)
    await agent_service.release_agent(agent_id, owner_id, task_id, "idle")
    await agent_service.log_activity(
        owner_id, agent_id, "error", f"Task failed: {message[:300]}", {"task_id": task_id}
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_task(data: dict, session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_user(session)
    try:
        return await task_service.create_task(user["id"], data)
    except task_service.ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
async def list_tasks(
    status: Optional[str] = None,
    agent_id: Optional[str] = None,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = await _get_user(session)
    return await task_service.list_tasks(user["id"], status, agent_id)


@router.get("/{task_id}")
async def get_task(task_id: str, session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_user(session)
    task = await task_service.get_task(task_id, user["id"])
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}")
async def update_task(
    task_id: str, data: dict,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = await _get_user(session)
    try:
        task = await task_service.update_task(task_id, user["id"], data)
    except task_service.ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_user(session)
    if not await task_service.delete_task(task_id, user["id"]):
        raise HTTPException(status_code=404, detail="Task not found")


@router.post("/{task_id}/execute")
async def execute_task(
    task_id: str,
    background_tasks: BackgroundTasks,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """
    Execute a task using the assigned agent's LLM.
    Supports Gemini, OpenAI, Anthropic, and Groq.
    Uses the user's BYOK key if configured, falls back to platform default.
    """
    user = await _get_user(session)

    task = await task_service.get_task(task_id, user["id"])
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not task.get("assigned_agent_id"):
        raise HTTPException(status_code=400, detail="Task has no assigned agent")

    agent = await _get_agent(task["assigned_agent_id"], user["id"])
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    unmet = await task_service.unmet_dependencies(task, user["id"])
    if unmet:
        raise HTTPException(status_code=409, detail=f"Waiting on {len(unmet)} unfinished dependency task(s)")

    # Atomic claims: two concurrent /execute calls can't both start the task,
    # and an agent can't be double-booked.
    if not await task_service.claim_task(task_id, user["id"]):
        raise HTTPException(status_code=409, detail="Task is already running")
    if not await agent_service.claim_agent(agent["id"], user["id"], task_id):
        await task_service.release_task(task_id, user["id"], "assigned")
        raise HTTPException(status_code=409, detail="Agent is busy with another task")

    await agent_service.log_activity(
        user["id"], agent["id"], "task_assigned",
        f"Started task '{task['title']}'", {"task_id": task_id},
    )
    # Run in background so request returns immediately
    background_tasks.add_task(_run_task, task_id, user["id"], agent)

    return {"status": "started", "task_id": task_id, "agent": agent["name"]}
