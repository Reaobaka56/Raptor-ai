"""
Task Service — Task orchestration and management for AI agents.
"""
import json
import logging
import uuid as _uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .db import get_conn, release_conn, row_to_dict as _row_to_dict

logger = logging.getLogger(__name__)

VALID_TASK_STATUSES = {"backlog", "assigned", "in_progress", "review", "done", "failed", "blocked"}
VALID_REVIEW_STATUSES = {"pending", "approved", "rejected", "needs_changes"}
# A task stuck in_progress longer than this (process restart / crashed worker)
# can be claimed again instead of being locked forever.
STALE_RUN_MINUTES = 15


class ValidationError(ValueError):
    """Bad client input -> HTTP 400/404 in the router layer."""


def _is_uuid(v: Any) -> bool:
    try:
        _uuid.UUID(str(v))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def validate_task_payload(data: Dict[str, Any], partial: bool = False) -> Dict[str, Any]:
    """Validate/normalize client task input. Raises ValidationError."""
    out: Dict[str, Any] = dict(data)
    if "title" in out or not partial:
        title = (out.get("title") or ("" if not partial else None))
        if title is None or not str(title).strip():
            raise ValidationError("Task title is required")
        if len(str(title)) > 300:
            raise ValidationError("Task title is too long (max 300 characters)")
        out["title"] = str(title).strip()
    if "priority" in out:
        p = out["priority"]
        if isinstance(p, bool) or not isinstance(p, int) or not 0 <= p <= 3:
            raise ValidationError("priority must be an integer from 0 (critical) to 3 (low)")
    if "status" in out and out["status"] not in VALID_TASK_STATUSES:
        raise ValidationError(f"status must be one of {sorted(VALID_TASK_STATUSES)}")
    if "review_status" in out and out["review_status"] not in VALID_REVIEW_STATUSES:
        raise ValidationError(f"review_status must be one of {sorted(VALID_REVIEW_STATUSES)}")
    for key in ("assigned_agent_id", "parent_task_id"):
        if out.get(key) is not None and not _is_uuid(out[key]):
            raise ValidationError(f"{key} must be a UUID")
    if "dependencies" in out:
        deps = out["dependencies"]
        if not isinstance(deps, list) or not all(_is_uuid(d) for d in deps) or len(deps) > 50:
            raise ValidationError("dependencies must be a list of up to 50 task UUIDs")
        out["dependencies"] = [str(d) for d in deps]
    if "metadata" in out and not isinstance(out["metadata"], dict):
        raise ValidationError("metadata must be an object")
    for key in ("description", "input_context", "output"):
        if out.get(key) is not None and len(str(out[key])) > 100_000:
            raise ValidationError(f"{key} is too long")
    return out


async def _assert_owned(conn, table: str, ids, owner_id: str, label: str) -> None:
    ids = [i for i in ids if i]
    if not ids:
        return
    rows = await conn.fetch(
        f"SELECT id FROM {table} WHERE id = ANY($1::uuid[]) AND owner_id = $2::uuid", ids, owner_id
    )
    if len(rows) != len(set(map(str, ids))):
        raise ValidationError(f"{label} not found")


_TASK_COLUMNS = """id, owner_id, title, description, priority, status,
                   assigned_agent_id, parent_task_id, dependencies,
                   input_context, output, logs, errors, review_status,
                   metadata, started_at, completed_at, created_at, updated_at"""


async def create_task(owner_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    data = validate_task_payload(data)
    conn = await get_conn()
    if not conn:
        raise RuntimeError("Database unavailable")
    try:
        await _assert_owned(conn, "agents", [data.get("assigned_agent_id")], owner_id, "Assigned agent")
        await _assert_owned(conn, "agent_tasks", [data.get("parent_task_id")] + data.get("dependencies", []),
                            owner_id, "Parent/dependency task")
        row = await conn.fetchrow(
            f"""INSERT INTO agent_tasks
                   (owner_id, title, description, priority, status,
                    assigned_agent_id, parent_task_id, dependencies,
                    input_context, metadata)
               VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, $7::uuid,
                       $8::jsonb, $9, $10::jsonb)
               RETURNING {_TASK_COLUMNS}""",
            owner_id,
            data["title"],
            data.get("description"),
            data.get("priority", 2),
            data.get("status", "backlog"),
            data.get("assigned_agent_id"),
            data.get("parent_task_id"),
            json.dumps(data.get("dependencies", [])),
            data.get("input_context"),
            json.dumps(data.get("metadata", {})),
        )
        return _row_to_dict(row)
    except Exception:
        logger.exception("[task_service] create_task failed")
        raise
    finally:
        await release_conn(conn)


async def get_task(task_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    if not _is_uuid(task_id):
        return None
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            f"""SELECT {_TASK_COLUMNS}
               FROM agent_tasks
               WHERE id = $1::uuid AND owner_id = $2::uuid""",
            task_id, owner_id,
        )
        return _row_to_dict(row)
    finally:
        await release_conn(conn)


async def list_tasks(owner_id: str,
                      status: Optional[str] = None,
                      agent_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if agent_id and not _is_uuid(agent_id):
        return []
    conn = await get_conn()
    if not conn:
        return []
    try:
        query = f"""SELECT {_TASK_COLUMNS}
                   FROM agent_tasks
                   WHERE owner_id = $1::uuid"""
        params: List[Any] = [owner_id]
        if status:
            params.append(status)
            query += f" AND status = ${len(params)}"
        if agent_id:
            params.append(agent_id)
            query += f" AND assigned_agent_id = ${len(params)}::uuid"
        query += " ORDER BY created_at DESC LIMIT 200"

        rows = await conn.fetch(query, *params)
        return [_row_to_dict(row) for row in rows]
    finally:
        await release_conn(conn)


async def update_task(task_id: str, owner_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    allowed_fields = {
        "title", "description", "priority", "status", "assigned_agent_id",
        "parent_task_id", "dependencies", "input_context", "output",
        "review_status", "metadata"
    }
    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        return await get_task(task_id, owner_id)
    updates = validate_task_payload(updates, partial=True)
    if not _is_uuid(task_id):
        return None

    conn = await get_conn()
    if not conn:
        return None
    try:
        await _assert_owned(conn, "agents", [updates.get("assigned_agent_id")], owner_id, "Assigned agent")
        await _assert_owned(conn, "agent_tasks",
                            [updates.get("parent_task_id")] + updates.get("dependencies", []),
                            owner_id, "Parent/dependency task")
        if task_id in (updates.get("dependencies") or []) or updates.get("parent_task_id") == task_id:
            raise ValidationError("A task cannot depend on itself")
        set_parts = []
        values: List[Any] = []
        for key, val in updates.items():
            values.append(json.dumps(val) if key in ("dependencies", "metadata") else val)
            idx = len(values)
            if key in ("dependencies", "metadata"):
                set_parts.append(f"{key} = ${idx}::jsonb")
            elif key in ("assigned_agent_id", "parent_task_id"):
                set_parts.append(f"{key} = ${idx}::uuid")
            else:
                set_parts.append(f"{key} = ${idx}")

        # Track timestamps based on status
        if "status" in updates:
            if updates["status"] == "in_progress":
                set_parts.append("started_at = COALESCE(started_at, now())")
            elif updates["status"] in ("done", "failed"):
                set_parts.append("completed_at = now()")

        set_parts.append("updated_at = now()")
        values.extend([task_id, owner_id])
        id_idx = len(values) - 1
        owner_idx = len(values)

        row = await conn.fetchrow(
            f"""UPDATE agent_tasks SET {', '.join(set_parts)}
                WHERE id = ${id_idx}::uuid AND owner_id = ${owner_idx}::uuid
                RETURNING {_TASK_COLUMNS}""",
            *values,
        )
        return _row_to_dict(row)
    except Exception:
        logger.exception("[task_service] update_task failed")
        raise
    finally:
        await release_conn(conn)


async def delete_task(task_id: str, owner_id: str) -> bool:
    if not _is_uuid(task_id):
        return False
    conn = await get_conn()
    if not conn:
        return False
    try:
        result = await conn.execute(
            "DELETE FROM agent_tasks WHERE id = $1::uuid AND owner_id = $2::uuid",
            task_id, owner_id,
        )
        return result.split()[-1] != "0"
    except Exception:
        logger.exception("[task_service] delete_task failed")
        raise
    finally:
        await release_conn(conn)


# ── Execution lifecycle (atomic, short-lived connections) ──────────────────────

async def claim_task(task_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    """Atomically move a task to in_progress. Returns the task, or None if it
    is already running (and not stale) / doesn't exist. Two concurrent
    /execute calls can't both win."""
    if not _is_uuid(task_id):
        return None
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            f"""UPDATE agent_tasks
                   SET status = 'in_progress',
                       started_at = now(), completed_at = NULL, updated_at = now()
                 WHERE id = $1::uuid AND owner_id = $2::uuid
                   AND (status <> 'in_progress'
                        OR started_at IS NULL
                        OR started_at < now() - make_interval(mins => $3))
                RETURNING {_TASK_COLUMNS}""",
            task_id, owner_id, STALE_RUN_MINUTES,
        )
        return _row_to_dict(row)
    finally:
        await release_conn(conn)


async def release_task(task_id: str, owner_id: str, status: str = "assigned") -> None:
    conn = await get_conn()
    if not conn:
        return
    try:
        await conn.execute(
            "UPDATE agent_tasks SET status = $3, updated_at = now() WHERE id = $1::uuid AND owner_id = $2::uuid",
            task_id, owner_id, status,
        )
    finally:
        await release_conn(conn)


async def finish_task(task_id: str, owner_id: str, ok: bool,
                      output: Optional[str] = None, error: Optional[str] = None) -> None:
    """Record a run's result. Errors are stored via json.dumps (never string
    formatting) so quotes/newlines in an error message can't corrupt the JSON."""
    conn = await get_conn()
    if not conn:
        return
    try:
        if ok:
            await conn.execute(
                """UPDATE agent_tasks SET status = 'done', output = $3,
                          completed_at = now(), updated_at = now()
                    WHERE id = $1::uuid AND owner_id = $2::uuid""",
                task_id, owner_id, output or "",
            )
        else:
            entry = [{"error": (error or "Unknown error")[:2000],
                      "at": datetime.now(timezone.utc).isoformat()}]
            await conn.execute(
                """UPDATE agent_tasks SET status = 'failed', errors = errors || $3::jsonb,
                          completed_at = now(), updated_at = now()
                    WHERE id = $1::uuid AND owner_id = $2::uuid""",
                task_id, owner_id, json.dumps(entry),
            )
    except Exception:
        logger.exception("[task_service] finish_task failed for %s", task_id)
    finally:
        await release_conn(conn)


async def unmet_dependencies(task: Dict[str, Any], owner_id: str) -> List[str]:
    """IDs of dependency tasks that are not 'done' yet."""
    deps = task.get("dependencies") or []
    if not deps:
        return []
    conn = await get_conn()
    if not conn:
        return list(deps)
    try:
        rows = await conn.fetch(
            "SELECT id, status FROM agent_tasks WHERE id = ANY($1::uuid[]) AND owner_id = $2::uuid",
            deps, owner_id,
        )
        done = {str(r["id"]) for r in rows if r["status"] == "done"}
        return [d for d in deps if str(d) not in done]
    finally:
        await release_conn(conn)
