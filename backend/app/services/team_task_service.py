"""Team task service — human-assignable to-dos scoped to a team.

Separate from agent_service/task_service on purpose: agent_tasks are units
of AI-agent execution (LLM prompts, tool permissions, sandbox runs) while
team_tasks are plain human to-dos assigned to one or more team members.
Reuses the same teams/team_members tables for membership checks.
"""
import logging
from typing import Any, Dict, List, Optional

from .db import get_conn, release_conn, row_to_dict as _row

logger = logging.getLogger(__name__)


async def create_task(team_id: str, created_by: str, title: str, description: Optional[str],
                       priority: int, assign_mode: str,
                       assignee_ids: List[str]) -> Optional[Dict[str, Any]]:
    """assignee_ids must already be verified (by the caller) as members of team_id."""
    conn = await get_conn()
    if not conn:
        return None
    try:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                INSERT INTO team_tasks (team_id, created_by, title, description, priority, assign_mode)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
                RETURNING id, team_id, created_by, title, description, priority,
                          assign_mode, status, created_at, updated_at
                """,
                team_id, created_by, title, description, priority, assign_mode,
            )
            task = _row(row)
            for uid in assignee_ids:
                await conn.execute(
                    """INSERT INTO team_task_assignees (task_id, user_id)
                       VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING""",
                    task["id"], uid,
                )
            task["assignees"] = assignee_ids
            return task
    except Exception:
        logger.exception("[team_task_service] create_task failed")
        return None
    finally:
        await release_conn(conn)


async def list_tasks_for_team(team_id: str) -> List[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return []
    try:
        rows = await conn.fetch(
            """
            SELECT t.id, t.team_id, t.created_by, t.title, t.description, t.priority,
                   t.assign_mode, t.status, t.created_at, t.updated_at,
                   cu.username AS created_by_username,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'user_id', a.user_id, 'username', au.username,
                               'avatar_url', au.avatar_url, 'completed_at', a.completed_at
                           )
                       ) FILTER (WHERE a.user_id IS NOT NULL), '[]'
                   ) AS assignees
            FROM team_tasks t
            JOIN users cu ON cu.id = t.created_by
            LEFT JOIN team_task_assignees a ON a.task_id = t.id
            LEFT JOIN users au ON au.id = a.user_id
            WHERE t.team_id::text = $1
            GROUP BY t.id, cu.username
            ORDER BY t.created_at DESC
            """,
            team_id,
        )
        return [_row(r) for r in rows]
    except Exception:
        logger.exception("[team_task_service] list_tasks_for_team failed")
        return []
    finally:
        await release_conn(conn)


async def list_tasks_for_user(user_id: str) -> List[Dict[str, Any]]:
    """All tasks (across teams) the current user is assigned to."""
    conn = await get_conn()
    if not conn:
        return []
    try:
        rows = await conn.fetch(
            """
            SELECT t.id, t.team_id, t.title, t.description, t.priority, t.status,
                   te.name AS team_name, a.completed_at
            FROM team_task_assignees a
            JOIN team_tasks t ON t.id = a.task_id
            JOIN teams te ON te.id = t.team_id
            WHERE a.user_id::text = $1
            ORDER BY (a.completed_at IS NOT NULL), t.priority ASC, t.created_at DESC
            """,
            user_id,
        )
        return [_row(r) for r in rows]
    except Exception:
        logger.exception("[team_task_service] list_tasks_for_user failed")
        return []
    finally:
        await release_conn(conn)


async def get_task_assignee_ids(task_id: str) -> List[str]:
    conn = await get_conn()
    if not conn:
        return []
    try:
        rows = await conn.fetch(
            "SELECT user_id FROM team_task_assignees WHERE task_id::text = $1", task_id,
        )
        return [str(r["user_id"]) for r in rows]
    except Exception:
        return []
    finally:
        await release_conn(conn)


async def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            "SELECT id, team_id, created_by, title, description, priority, assign_mode, status "
            "FROM team_tasks WHERE id::text = $1",
            task_id,
        )
        return _row(row) if row else None
    except Exception:
        return None
    finally:
        await release_conn(conn)


async def complete_for_user(task_id: str, user_id: str) -> bool:
    """Mark this assignee's copy complete. If every assignee is now done,
    also flips the parent task's status to 'done'."""
    conn = await get_conn()
    if not conn:
        return False
    try:
        async with conn.transaction():
            result = await conn.execute(
                """UPDATE team_task_assignees SET completed_at = now()
                   WHERE task_id::text = $1 AND user_id::text = $2 AND completed_at IS NULL""",
                task_id, user_id,
            )
            if result.split()[-1] == "0":
                return False
            remaining = await conn.fetchval(
                "SELECT COUNT(*) FROM team_task_assignees WHERE task_id::text = $1 AND completed_at IS NULL",
                task_id,
            )
            if remaining == 0:
                await conn.execute(
                    "UPDATE team_tasks SET status = 'done', updated_at = now() WHERE id::text = $1",
                    task_id,
                )
        return True
    except Exception:
        logger.exception("[team_task_service] complete_for_user failed")
        return False
    finally:
        await release_conn(conn)


async def delete_task(task_id: str) -> bool:
    conn = await get_conn()
    if not conn:
        return False
    try:
        result = await conn.execute("DELETE FROM team_tasks WHERE id::text = $1", task_id)
        return result.split()[-1] != "0"
    except Exception:
        return False
    finally:
        await release_conn(conn)
