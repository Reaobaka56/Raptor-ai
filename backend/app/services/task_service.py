"""
Task Service — Task orchestration and management for AI agents.
"""
import json
import logging
from typing import Any, Dict, List, Optional

from .db import get_conn, release_conn, row_to_dict as _row_to_dict

logger = logging.getLogger(__name__)

_TASK_COLUMNS = """id, owner_id, title, description, priority, status,
                   assigned_agent_id, parent_task_id, dependencies,
                   input_context, output, logs, errors, review_status,
                   metadata, started_at, completed_at, created_at, updated_at"""


async def create_task(owner_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = await get_conn()
    if not conn:
        raise RuntimeError("Database unavailable")
    try:
        row = await conn.fetchrow(
            f"""INSERT INTO agent_tasks
                   (owner_id, title, description, priority, status,
                    assigned_agent_id, parent_task_id, dependencies,
                    input_context, metadata)
               VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, $7::uuid,
                       $8::jsonb, $9, $10::jsonb)
               RETURNING {_TASK_COLUMNS}""",
            owner_id,
            data.get("title", "Untitled Task"),
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

    conn = await get_conn()
    if not conn:
        return None
    try:
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
