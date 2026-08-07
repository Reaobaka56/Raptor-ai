"""
Message Service — Inter-agent communication.
"""
import json
import logging
from typing import Any, Dict, List, Optional

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)


def _row_to_dict(cur, row) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    cols = [d[0] for d in cur.description]
    d = dict(zip(cols, row))
    for key in ("id", "owner_id", "from_agent_id", "to_agent_id", "task_id"):
        if key in d and d[key] is not None:
            d[key] = str(d[key])
    for key in ("created_at",):
        if key in d and d[key] is not None and hasattr(d[key], "isoformat"):
            d[key] = d[key].isoformat()
    return d


def send_message(owner_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_conn()
    if not conn:
        raise RuntimeError("Database unavailable")
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO agent_messages
                       (owner_id, from_agent_id, to_agent_id, message_type,
                        content, task_id, metadata)
                   VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s::uuid, %s::jsonb)
                   RETURNING id, owner_id, from_agent_id, to_agent_id, message_type,
                             content, task_id, metadata, read, created_at""",
                (
                    owner_id,
                    data.get("from_agent_id"),
                    data.get("to_agent_id"),
                    data.get("message_type", "general"),
                    data.get("content", ""),
                    data.get("task_id"),
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


def get_messages(owner_id: str,
                 agent_id: Optional[str] = None,
                 limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            query = """SELECT m.id, m.owner_id, m.from_agent_id, m.to_agent_id, m.message_type,
                              m.content, m.task_id, m.metadata, m.read, m.created_at,
                              f.name as from_agent_name, t.name as to_agent_name
                       FROM agent_messages m
                       LEFT JOIN agents f ON m.from_agent_id = f.id
                       LEFT JOIN agents t ON m.to_agent_id = t.id
                       WHERE m.owner_id = %s::uuid"""
            params = [owner_id]
            if agent_id:
                query += " AND (m.from_agent_id = %s::uuid OR m.to_agent_id = %s::uuid OR m.to_agent_id IS NULL)"
                params.extend([agent_id, agent_id])

            query += " ORDER BY m.created_at DESC LIMIT %s"
            params.append(limit)

            cur.execute(query, params)
            rows = cur.fetchall()
            return [_row_to_dict(cur, row) for row in rows]
    finally:
        release_conn(conn)


def mark_read(message_id: str, owner_id: str) -> bool:
    conn = get_conn()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE agent_messages SET read = TRUE WHERE id = %s::uuid AND owner_id = %s::uuid",
                (message_id, owner_id)
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
