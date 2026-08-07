"""
Task Service — Task orchestration and management for AI agents.
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)


def _row_to_dict(cur, row) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    cols = [d[0] for d in cur.description]
    d = dict(zip(cols, row))
    for key in ("id", "owner_id", "assigned_agent_id", "parent_task_id"):
        if key in d and d[key] is not None:
            d[key] = str(d[key])
    for key in ("created_at", "updated_at", "started_at", "completed_at"):
        if key in d and d[key] is not None and hasattr(d[key], "isoformat"):
            d[key] = d[key].isoformat()
    return d


def create_task(owner_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_conn()
    if not conn:
        raise RuntimeError("Database unavailable")
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO agent_tasks
                       (owner_id, title, description, priority, status,
                        assigned_agent_id, parent_task_id, dependencies,
                        input_context, metadata)
                   VALUES (%s::uuid, %s, %s, %s, %s, %s::uuid, %s::uuid,
                           %s::jsonb, %s, %s::jsonb)
                   RETURNING id, owner_id, title, description, priority, status,
                             assigned_agent_id, parent_task_id, dependencies,
                             input_context, output, logs, errors, review_status,
                             metadata, started_at, completed_at, created_at, updated_at""",
                (
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
                ),
            )
            conn.commit()
            return _row_to_dict(cur, cur.fetchone())
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        release_conn(conn)


def get_task(task_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, owner_id, title, description, priority, status,
                          assigned_agent_id, parent_task_id, dependencies,
                          input_context, output, logs, errors, review_status,
                          metadata, started_at, completed_at, created_at, updated_at
                   FROM agent_tasks
                   WHERE id = %s::uuid AND owner_id = %s::uuid""",
                (task_id, owner_id),
            )
            return _row_to_dict(cur, cur.fetchone())
    finally:
        release_conn(conn)


def list_tasks(owner_id: str,
               status: Optional[str] = None,
               agent_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            query = """SELECT id, owner_id, title, description, priority, status,
                              assigned_agent_id, parent_task_id, dependencies,
                              input_context, output, logs, errors, review_status,
                              metadata, started_at, completed_at, created_at, updated_at
                       FROM agent_tasks
                       WHERE owner_id = %s::uuid"""
            params = [owner_id]
            if status:
                query += " AND status = %s"
                params.append(status)
            if agent_id:
                query += " AND assigned_agent_id = %s::uuid"
                params.append(agent_id)
            query += " ORDER BY created_at DESC LIMIT 200"

            cur.execute(query, params)
            rows = cur.fetchall()
            return [_row_to_dict(cur, row) for row in rows]
    finally:
        release_conn(conn)


def update_task(task_id: str, owner_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    allowed_fields = {
        "title", "description", "priority", "status", "assigned_agent_id",
        "parent_task_id", "dependencies", "input_context", "output",
        "review_status", "metadata"
    }
    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        return get_task(task_id, owner_id)

    conn = get_conn()
    if not conn:
        return None
    try:
        set_parts = []
        values = []
        for key, val in updates.items():
            if key in ("dependencies", "metadata"):
                set_parts.append(f"{key} = %s::jsonb")
                values.append(json.dumps(val))
            elif key in ("assigned_agent_id", "parent_task_id"):
                set_parts.append(f"{key} = %s::uuid")
                values.append(val)
            else:
                set_parts.append(f"{key} = %s")
                values.append(val)

        # Track timestamps based on status
        if "status" in updates:
            if updates["status"] == "in_progress":
                set_parts.append("started_at = COALESCE(started_at, now())")
            elif updates["status"] in ("done", "failed"):
                set_parts.append("completed_at = now()")

        set_parts.append("updated_at = now()")
        values.extend([task_id, owner_id])

        with conn.cursor() as cur:
            cur.execute(
                f"""UPDATE agent_tasks SET {', '.join(set_parts)}
                    WHERE id = %s::uuid AND owner_id = %s::uuid
                    RETURNING id, owner_id, title, description, priority, status,
                              assigned_agent_id, parent_task_id, dependencies,
                              input_context, output, logs, errors, review_status,
                              metadata, started_at, completed_at, created_at, updated_at""",
                values,
            )
            conn.commit()
            return _row_to_dict(cur, cur.fetchone())
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        release_conn(conn)


def delete_task(task_id: str, owner_id: str) -> bool:
    conn = get_conn()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM agent_tasks WHERE id = %s::uuid AND owner_id = %s::uuid",
                (task_id, owner_id),
            )
            conn.commit()
            return cur.rowcount > 0
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        release_conn(conn)
