"""
Task router — REST API for agent tasks with real LLM execution.
"""
import asyncio
import logging
import os
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from .auth_dependencies import get_required_github_session
from .services.user_service import get_user_by_username
from .services import task_service
from .services.db import get_conn, release_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


def _get_user(session: Dict[str, Any]) -> Dict[str, Any]:
    username = session.get("user", {}).get("username", "")
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _get_user_api_key(user_id: str, provider: str) -> Optional[str]:
    """Get decrypted API key for a user+provider combo. Falls back to env var."""
    import hashlib
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT key_encrypted FROM user_api_keys WHERE user_id=%s::uuid AND provider=%s AND is_active=TRUE ORDER BY created_at DESC LIMIT 1",
                (user_id, provider)
            )
            row = cur.fetchone()
            if not row:
                return None
            # Decrypt
            secret = os.getenv("SECRET_KEY", "raptor-default-secret-change-in-production")
            key = hashlib.sha256(secret.encode()).digest()
            data = bytes.fromhex(row[0])
            decrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
            return decrypted.decode()
    except Exception:
        return None
    finally:
        release_conn(conn)


def _get_agent(agent_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name, role, description, system_prompt, model, provider,
                          tools, permissions, status, config
                   FROM agents WHERE id=%s::uuid AND owner_id=%s::uuid""",
                (agent_id, owner_id)
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            a = dict(zip(cols, row))
            a["id"] = str(a["id"])
            return a
    except Exception:
        return None
    finally:
        release_conn(conn)


def _execute_with_gemini(api_key: str, model: str, system_prompt: str, task_prompt: str) -> str:
    """Call Google Gemini with the given system prompt and task."""
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=api_key)
    full_prompt = f"{system_prompt}\n\n---\n\n{task_prompt}" if system_prompt else task_prompt
    resp = client.models.generate_content(
        model=model or "gemini-2.5-pro",
        contents=full_prompt,
        config=types.GenerateContentConfig(temperature=0.7),
    )
    return resp.text or ""


def _execute_with_openai(api_key: str, model: str, system_prompt: str, task_prompt: str) -> str:
    """Call OpenAI with the given system prompt and task."""
    import requests
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": task_prompt})
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model or "gpt-4o", "messages": messages, "temperature": 0.7},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


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


def _execute_with_groq(api_key: str, model: str, system_prompt: str, task_prompt: str) -> str:
    """Call Groq API (OpenAI-compatible)."""
    import requests
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": task_prompt})
    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model or "llama-3.3-70b-versatile", "messages": messages},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _run_task_sync(task_id: str, owner_id: str, agent: Dict[str, Any]) -> None:
    """Synchronous task execution — called in a background thread."""
    conn = get_conn()
    if not conn:
        return

    def _update(status: str, output: str = None, error: str = None):
        try:
            with conn.cursor() as cur:
                if output is not None:
                    cur.execute(
                        "UPDATE tasks SET status=%s, output=%s, completed_at=now() WHERE id=%s::uuid",
                        (status, output, task_id)
                    )
                elif error is not None:
                    cur.execute(
                        "UPDATE tasks SET status=%s, errors=errors||%s::jsonb WHERE id=%s::uuid",
                        (status, f'[{{"error":"{error}"}}]', task_id)
                    )
                else:
                    cur.execute("UPDATE tasks SET status=%s WHERE id=%s::uuid", (status, task_id))
                conn.commit()
        except Exception:
            try: conn.rollback()
            except: pass

    try:
        # Get task details
        with conn.cursor() as cur:
            cur.execute(
                "SELECT title, description, input_context FROM tasks WHERE id=%s::uuid",
                (task_id,)
            )
            row = cur.fetchone()
            if not row:
                return
            title, description, context = row

        _update("in_progress")

        # Build task prompt
        task_prompt = f"Task: {title}"
        if description:
            task_prompt += f"\n\nDescription:\n{description}"
        if context:
            task_prompt += f"\n\nContext:\n{context}"

        provider = (agent.get("provider") or "gemini").lower()
        model    = agent.get("model") or "gemini-2.5-pro"
        system_prompt = agent.get("system_prompt") or ""

        # Get API key — user's BYOK first, then env var
        api_key = _get_user_api_key(owner_id, provider)

        if not api_key:
            if provider in ("gemini", "google"):
                api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            elif provider == "openai":
                api_key = os.getenv("OPENAI_API_KEY")
            elif provider == "anthropic":
                api_key = os.getenv("ANTHROPIC_API_KEY")
            elif provider == "groq":
                api_key = os.getenv("GROQ_API_KEY")

        if not api_key:
            # Fall back to default Gemini key
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            provider = "gemini"
            model = "gemini-2.5-pro"

        if not api_key:
            _update("failed", error="No API key configured. Add a key in Settings → API Keys.")
            return

        # Execute
        start = time.time()
        if provider in ("gemini", "google"):
            output = _execute_with_gemini(api_key, model, system_prompt, task_prompt)
        elif provider == "openai":
            output = _execute_with_openai(api_key, model, system_prompt, task_prompt)
        elif provider == "anthropic":
            output = _execute_with_anthropic(api_key, model, system_prompt, task_prompt)
        elif provider == "groq":
            output = _execute_with_groq(api_key, model, system_prompt, task_prompt)
        else:
            output = _execute_with_gemini(api_key, model, system_prompt, task_prompt)

        duration = int((time.time() - start) * 1000)
        _update("done", output=output)

        # Update agent status back to idle
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE agents SET status='idle', current_task_id=NULL WHERE id=%s::uuid",
                (agent["id"],)
            )
            conn.commit()

        logger.info("Task %s completed in %dms", task_id, duration)

    except Exception as e:
        logger.exception("Task %s failed", task_id)
        _update("failed", error=str(e)[:500])
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE agents SET status='idle' WHERE id=%s::uuid", (agent["id"],))
                conn.commit()
        except Exception:
            pass
    finally:
        release_conn(conn)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_task(data: dict, session: Dict[str, Any] = Depends(get_required_github_session)):
    user = _get_user(session)
    return task_service.create_task(user["id"], data)


@router.get("")
def list_tasks(
    status: Optional[str] = None,
    agent_id: Optional[str] = None,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    return task_service.list_tasks(user["id"], status, agent_id)


@router.get("/{task_id}")
def get_task(task_id: str, session: Dict[str, Any] = Depends(get_required_github_session)):
    user = _get_user(session)
    task = task_service.get_task(task_id, user["id"])
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}")
def update_task(
    task_id: str, data: dict,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    task = task_service.update_task(task_id, user["id"], data)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, session: Dict[str, Any] = Depends(get_required_github_session)):
    user = _get_user(session)
    if not task_service.delete_task(task_id, user["id"]):
        raise HTTPException(status_code=404, detail="Task not found")


@router.post("/{task_id}/execute")
def execute_task(
    task_id: str,
    background_tasks: BackgroundTasks,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """
    Execute a task using the assigned agent's LLM.
    Supports Gemini, OpenAI, Anthropic, and Groq.
    Uses the user's BYOK key if configured, falls back to platform default.
    """
    user = _get_user(session)

    # Get task
    task = task_service.get_task(task_id, user["id"])
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.get("status") == "in_progress":
        raise HTTPException(status_code=400, detail="Task is already running")
    if not task.get("assigned_agent_id"):
        raise HTTPException(status_code=400, detail="Task has no assigned agent")

    # Get agent
    agent = _get_agent(task["assigned_agent_id"], user["id"])
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Mark agent as working
    conn = get_conn()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE agents SET status='working', current_task_id=%s::uuid WHERE id=%s::uuid",
                    (task_id, agent["id"])
                )
                conn.commit()
        except Exception:
            pass
        finally:
            release_conn(conn)

    # Run in background so request returns immediately
    background_tasks.add_task(_run_task_sync, task_id, user["id"], agent)

    return {"status": "started", "task_id": task_id, "agent": agent["name"]}
