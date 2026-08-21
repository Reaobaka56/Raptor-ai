"""
Raptor Bot service — the system's automated assistant, implemented as a real
row in `users` (username 'raptor-bot', seeded by migration 011) so its
messages flow through the existing chat_messages table and existing Chat UI
instead of a parallel notification system.

Adding a new automated notification type later means adding one small
function here and calling it from the relevant place — no chat/schema
changes required.
"""
import logging
from typing import Any, Dict, Optional

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)

BOT_USERNAME = "raptor-bot"

_bot_id_cache: Optional[str] = None


async def get_bot_user_id() -> Optional[str]:
    global _bot_id_cache
    if _bot_id_cache:
        return _bot_id_cache
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow("SELECT id FROM users WHERE username = $1", BOT_USERNAME)
        if row:
            _bot_id_cache = str(row["id"])
        return _bot_id_cache
    except Exception:
        logger.exception("[bot_service] get_bot_user_id failed")
        return None
    finally:
        await release_conn(conn)


async def _send(receiver_id: str, content: str) -> Optional[Dict[str, Any]]:
    bot_id = await get_bot_user_id()
    if not bot_id or not receiver_id:
        return None
    if bot_id == receiver_id:
        return None  # never message itself
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO chat_messages (sender_id, receiver_id, content)
            VALUES ($1::uuid, $2::uuid, $3)
            RETURNING id, sender_id, receiver_id, content, read, created_at
            """,
            bot_id, receiver_id, content,
        )
        return dict(row) if row else None
    except Exception:
        logger.exception("[bot_service] failed to send bot message to %s", receiver_id)
        return None
    finally:
        await release_conn(conn)


async def send_welcome(user_id: str) -> None:
    await _send(
        user_id,
        "Welcome to Raptor! I'm your Raptor assistant. I'll keep you updated "
        "about your tasks, meetings, and team activity.",
    )


async def send_task_completed(user_id: str, task_title: str) -> None:
    await _send(user_id, f"🎉 Nice work! You've completed your task: **{task_title}**.")


async def send_meeting_invite(user_id: str, meeting_title: str, inviter_name: str,
                               date: str, time: str) -> None:
    await _send(
        user_id,
        f"📅 You've been invited to **{meeting_title}** by {inviter_name}.\n"
        f"**{date} at {time}**",
    )
