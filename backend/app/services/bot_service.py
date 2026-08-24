"""
Raptor Bot service — the system's automated assistant, implemented as a real
row in `users` (username 'raptor-bot', seeded by migration 011) so its
messages flow through the existing chat_messages table and existing Chat UI
instead of a parallel notification system.

Every notification type is tagged with a `notif_type` string and carries a
structured `metadata` payload (migration 013's chat_messages.metadata
column) alongside the human-readable text, so the frontend can render rich
affordances (e.g. a "View Meeting" button) without parsing message content.

Notification types can be unsubscribed per-user via
users.notification_prefs (a JSONB map of {notif_type: bool}; a missing key
means enabled). `welcome` is intentionally never gated — it's a one-time
onboarding message, not a recurring notification.

Adding a new automated notification type later means adding one small
function here and calling it from the relevant place — no chat/schema
changes required.
"""
import json
import logging
from typing import Any, Dict, Optional

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)

BOT_USERNAME = "raptor-bot"

# Notification types that can be toggled off in Settings > Bot Notifications.
# Keep this in sync with the toggles rendered on the frontend.
NOTIFICATION_TYPES = {
    "task_completed": "Task completion",
    "meeting_invite": "Meeting invites",
    "pr_review_completed": "PR review completed",
    "added_to_team": "Added to a team",
}

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


async def _is_subscribed(user_id: str, notif_type: Optional[str]) -> bool:
    """A notif_type of None (e.g. the welcome message) is never gated."""
    if notif_type is None:
        return True
    conn = await get_conn()
    if not conn:
        return True  # fail open — don't silently drop notifications on a DB hiccup
    try:
        prefs = await conn.fetchval(
            "SELECT notification_prefs FROM users WHERE id = $1::uuid", user_id
        )
        if not prefs:
            return True
        if isinstance(prefs, str):
            prefs = json.loads(prefs)
        return prefs.get(notif_type, True) is not False
    except Exception:
        logger.exception("[bot_service] failed to read notification_prefs for %s", user_id)
        return True
    finally:
        await release_conn(conn)


async def _send(
    receiver_id: str,
    content: str,
    notif_type: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    bot_id = await get_bot_user_id()
    if not bot_id or not receiver_id:
        return None
    if bot_id == receiver_id:
        return None  # never message itself

    if not await _is_subscribed(receiver_id, notif_type):
        return None

    payload = dict(metadata or {})
    if notif_type:
        payload.setdefault("type", notif_type)

    conn = await get_conn()
    if not conn:
        return None
    try:
        # NOTE: the jsonb type codec registered in db.py's _init_connection
        # already encodes/decodes via json.dumps/json.loads, so pass the
        # dict itself here — passing a pre-dumped string would be
        # double-encoded into a JSON string value instead of an object.
        row = await conn.fetchrow(
            """
            INSERT INTO chat_messages (sender_id, receiver_id, content, metadata)
            VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)
            RETURNING id, sender_id, receiver_id, content, read, metadata, created_at
            """,
            bot_id, receiver_id, content, payload if payload else None,
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
    await _send(
        user_id,
        f"🎉 Nice work! You've completed your task: **{task_title}**.",
        notif_type="task_completed",
    )


async def send_meeting_invite(user_id: str, meeting_title: str, inviter_name: str,
                               date: str, time: str, meeting_id: Optional[str] = None) -> None:
    await _send(
        user_id,
        f"📅 You've been invited to **{meeting_title}** by {inviter_name}.\n"
        f"**{date} at {time}**",
        notif_type="meeting_invite",
        metadata={"meeting_id": meeting_id, "title": meeting_title, "date": date, "time": time},
    )


async def send_pr_review_completed(user_id: str, pr_title: str, repo_name: str,
                                    pr_number: int, pr_url: str, issue_count: int = 0) -> None:
    issue_note = f" — {issue_count} issue{'s' if issue_count != 1 else ''} found" if issue_count else " — no issues found"
    await _send(
        user_id,
        f"✅ Review complete for **{repo_name}#{pr_number}** — {pr_title}{issue_note}.",
        notif_type="pr_review_completed",
        metadata={"repo": repo_name, "pr_number": pr_number, "pr_url": pr_url},
    )


async def send_added_to_team(user_id: str, team_name: str, added_by_name: str,
                              team_id: Optional[str] = None) -> None:
    await _send(
        user_id,
        f"👥 {added_by_name} added you to the team **{team_name}**.",
        notif_type="added_to_team",
        metadata={"team_id": team_id, "team_name": team_name},
    )
