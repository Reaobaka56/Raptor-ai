"""
Chat router — real DB-backed user-to-user messaging.
Messages are persisted in chat_messages table.
"""
import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from .auth_dependencies import get_required_github_session, get_current_user
from .services.user_service import get_user_by_username, get_user_by_id
from .services.team_service import users_share_team
from .services.bot_service import BOT_USERNAME, get_bot_user_id
from .services.db import get_conn, release_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["Chat"])


# ── DB helpers ─────────────────────────────────────────────────────────────────

async def _get_user_id(session: Dict[str, Any]) -> str:
    user = await get_current_user(session)
    return user["id"]


async def _conversation_exists(user_a: str, user_b: str) -> bool:
    conn = await get_conn()
    if not conn:
        return False
    try:
        row = await conn.fetchrow(
            """
            SELECT 1 FROM chat_messages
            WHERE (sender_id = $1::uuid AND receiver_id = $2::uuid)
               OR (sender_id = $2::uuid AND receiver_id = $1::uuid)
            LIMIT 1
            """,
            user_a, user_b,
        )
        return row is not None
    except Exception:
        logger.exception("_conversation_exists failed")
        return False
    finally:
        await release_conn(conn)


def _row(row) -> Dict[str, Any]:
    d = dict(row)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif hasattr(v, "hex") and not isinstance(v, (str, bytes, bytearray, int)):
            d[k] = str(v)
    return d


# ── Request schemas ────────────────────────────────────────────────────────────

class SendMessage(BaseModel):
    content: str
    receiver_username: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(session: Dict[str, Any] = Depends(get_required_github_session)):
    """Return all unique conversations for the current user, with last message and unread count.

    Conversation history is never deleted just because a shared team ended —
    a past conversation stays visible here (and readable via get_messages)
    even if the two users no longer share a team; what's blocked is starting
    a *new* conversation with someone you don't share a team with (enforced
    in search_users and send_message below). Raptor Bot is always visible.
    """
    user_id = await _get_user_id(session)
    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        rows = await conn.fetch("""
            SELECT DISTINCT ON (partner_id)
                partner_id,
                partner_username,
                partner_avatar,
                last_message,
                last_at,
                unread_count
            FROM (
                SELECT
                    CASE WHEN m.sender_id = $1::uuid THEN m.receiver_id ELSE m.sender_id END AS partner_id,
                    CASE WHEN m.sender_id = $1::uuid THEN ru.username ELSE su.username END AS partner_username,
                    CASE WHEN m.sender_id = $1::uuid THEN ru.avatar_url ELSE su.avatar_url END AS partner_avatar,
                    m.content AS last_message,
                    m.created_at AS last_at,
                    COUNT(*) FILTER (WHERE m.receiver_id = $1::uuid AND NOT m.read) OVER (
                        PARTITION BY
                            CASE WHEN m.sender_id = $1::uuid THEN m.receiver_id ELSE m.sender_id END
                    ) AS unread_count
                FROM chat_messages m
                JOIN users su ON su.id = m.sender_id
                JOIN users ru ON ru.id = m.receiver_id
                WHERE m.sender_id = $1::uuid OR m.receiver_id = $1::uuid
                ORDER BY m.created_at DESC
            ) t
            ORDER BY partner_id, last_at DESC
        """, user_id)
        return [_row(r) for r in rows]
    except Exception as e:
        logger.exception("list_conversations failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await release_conn(conn)


@router.get("/messages/{username}")
async def get_messages(
    username: str,
    limit: int = Query(default=50, ge=1, le=200),
    before: Optional[str] = Query(default=None, description="ISO timestamp for pagination"),
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Return message thread between current user and another user.

    Server-side gate (not just hidden in the UI): allowed if the two users
    currently share a team, if the other user is Raptor Bot, or if a
    conversation already exists between them (so history from a team you've
    since left stays readable — it isn't deleted, just no longer growable;
    see send_message for where new messages are blocked).
    """
    user_id = await _get_user_id(session)

    other = await get_user_by_username(username)
    if not other:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")
    other_id = other["id"]

    bot_id = await get_bot_user_id()
    if other_id != bot_id and not await users_share_team(user_id, other_id):
        if not await _conversation_exists(user_id, other_id):
            raise HTTPException(status_code=403, detail="You don't share a team with this user")

    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        if before:
            rows = await conn.fetch("""
                SELECT m.*, su.username AS sender_username, su.avatar_url AS sender_avatar
                FROM chat_messages m
                JOIN users su ON su.id = m.sender_id
                WHERE (
                    (m.sender_id = $1::uuid AND m.receiver_id = $2::uuid)
                    OR
                    (m.sender_id = $2::uuid AND m.receiver_id = $1::uuid)
                )
                AND m.created_at < $3::timestamptz
                ORDER BY m.created_at DESC
                LIMIT $4
            """, user_id, other_id, before, limit)
        else:
            rows = await conn.fetch("""
                SELECT m.*, su.username AS sender_username, su.avatar_url AS sender_avatar
                FROM chat_messages m
                JOIN users su ON su.id = m.sender_id
                WHERE (
                    (m.sender_id = $1::uuid AND m.receiver_id = $2::uuid)
                    OR
                    (m.sender_id = $2::uuid AND m.receiver_id = $1::uuid)
                )
                ORDER BY m.created_at DESC
                LIMIT $3
            """, user_id, other_id, limit)

        messages = list(reversed([_row(r) for r in rows]))

        # Mark messages as read
        await conn.execute("""
            UPDATE chat_messages
            SET read = TRUE
            WHERE receiver_id = $1::uuid AND sender_id = $2::uuid AND NOT read
        """, user_id, other_id)

        return {
            "messages": messages,
            "other_user": {
                "id": other["id"],
                "username": other["username"],
                "avatar_url": other.get("avatar_url"),
                "name": other.get("name"),
            }
        }
    except Exception as e:
        logger.exception("get_messages failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await release_conn(conn)


@router.post("/messages", status_code=201)
async def send_message(
    body: SendMessage,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Send a message to another user."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    user_id = await _get_user_id(session)
    receiver = await get_user_by_username(body.receiver_username)
    if not receiver:
        raise HTTPException(status_code=404, detail=f"User '{body.receiver_username}' not found. They need to have logged into Raptor at least once.")

    if receiver["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot send a message to yourself")

    bot_id = await get_bot_user_id()
    if receiver["id"] != bot_id and not await users_share_team(user_id, receiver["id"]):
        raise HTTPException(status_code=403, detail="You can only message people who share a team with you")

    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        row = await conn.fetchrow("""
            INSERT INTO chat_messages (sender_id, receiver_id, content)
            VALUES ($1::uuid, $2::uuid, $3)
            RETURNING id, sender_id, receiver_id, content, read, created_at
        """, user_id, receiver["id"], body.content.strip())
        msg = _row(row)
        msg["sender_username"] = session["user"].get("username", "")
        msg["sender_avatar"] = session["user"].get("avatarUrl", "")
        return msg
    except Exception as e:
        logger.exception("send_message failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await release_conn(conn)


@router.get("/unread-count")
async def unread_count(session: Dict[str, Any] = Depends(get_required_github_session)):
    """Return total unread message count for the current user."""
    user_id = await _get_user_id(session)
    conn = await get_conn()
    if not conn:
        return {"count": 0}
    try:
        count = await conn.fetchval(
            "SELECT COUNT(*) FROM chat_messages WHERE receiver_id = $1::uuid AND NOT read",
            user_id,
        )
        return {"count": count}
    except Exception:
        return {"count": 0}
    finally:
        await release_conn(conn)


@router.get("/users/search")
async def search_users(
    q: str = Query(..., min_length=1, max_length=50),
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Search for users to start a conversation with.

    Server-side team gate: only returns users who share at least one team
    with the current user. Someone on none of the current user's teams
    (or on no teams at all) never appears here, regardless of what the
    frontend does — this is enforced in the SQL join below, not filtered
    client-side.
    """
    user_id = await _get_user_id(session)
    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        rows = await conn.fetch("""
            SELECT DISTINCT u.id, u.username, u.name, u.avatar_url
            FROM users u
            JOIN team_members tm_other ON tm_other.user_id = u.id
            JOIN team_members tm_me ON tm_me.team_id = tm_other.team_id
            WHERE (u.username ILIKE $1 OR u.name ILIKE $1)
              AND tm_me.user_id = $2::uuid
              AND u.id != $2::uuid
              AND u.account_status = 'active'
            LIMIT 10
        """, f"%{q}%", user_id)
        return [_row(r) for r in rows]
    except Exception as e:
        logger.exception("search_users failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await release_conn(conn)
