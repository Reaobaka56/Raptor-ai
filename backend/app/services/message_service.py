"""
Message Service — Inter-agent communication.
"""
import json
import logging
from typing import Any, Dict, List, Optional

from .db import get_conn, release_conn, row_to_dict as _row_to_dict

logger = logging.getLogger(__name__)


async def send_message(owner_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = await get_conn()
    if not conn:
        raise RuntimeError("Database unavailable")
    try:
        row = await conn.fetchrow(
            """INSERT INTO agent_messages
                   (owner_id, from_agent_id, to_agent_id, message_type,
                    content, task_id, metadata)
               VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7::jsonb)
               RETURNING id, owner_id, from_agent_id, to_agent_id, message_type,
                         content, task_id, metadata, read, created_at""",
            owner_id,
            data.get("from_agent_id"),
            data.get("to_agent_id"),
            data.get("message_type", "general"),
            data.get("content", ""),
            data.get("task_id"),
            json.dumps(data.get("metadata", {})),
        )
        return _row_to_dict(row)
    except Exception:
        logger.exception("[message_service] send_message failed")
        raise
    finally:
        await release_conn(conn)


async def get_messages(owner_id: str,
                        agent_id: Optional[str] = None,
                        limit: int = 100) -> List[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return []
    try:
        query = """SELECT m.id, m.owner_id, m.from_agent_id, m.to_agent_id, m.message_type,
                          m.content, m.task_id, m.metadata, m.read, m.created_at,
                          f.name as from_agent_name, t.name as to_agent_name
                   FROM agent_messages m
                   LEFT JOIN agents f ON m.from_agent_id = f.id
                   LEFT JOIN agents t ON m.to_agent_id = t.id
                   WHERE m.owner_id = $1::uuid"""
        params: List[Any] = [owner_id]
        if agent_id:
            params.append(agent_id)
            idx = len(params)
            query += f" AND (m.from_agent_id = ${idx}::uuid OR m.to_agent_id = ${idx}::uuid OR m.to_agent_id IS NULL)"

        params.append(limit)
        query += f" ORDER BY m.created_at DESC LIMIT ${len(params)}"

        rows = await conn.fetch(query, *params)
        return [_row_to_dict(row) for row in rows]
    finally:
        await release_conn(conn)


async def mark_read(message_id: str, owner_id: str) -> bool:
    conn = await get_conn()
    if not conn:
        return False
    try:
        result = await conn.execute(
            "UPDATE agent_messages SET read = TRUE WHERE id = $1::uuid AND owner_id = $2::uuid",
            message_id, owner_id,
        )
        return result.split()[-1] != "0"
    except Exception:
        logger.exception("[message_service] mark_read failed")
        raise
    finally:
        await release_conn(conn)
