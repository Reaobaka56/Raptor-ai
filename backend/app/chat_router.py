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
from .services.db import get_conn, release_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["Chat"])


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _get_user_id(session: Dict[str, Any]) -> str:
    return get_current_user(session)["id"]


def _row(cur, row) -> Dict[str, Any]:
    cols = [d[0] for d in cur.description]
    d = dict(zip(cols, row))
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif hasattr(v, "hex"):
            d[k] = str(v)
    return d


# ── Request schemas ────────────────────────────────────────────────────────────

class SendMessage(BaseModel):
    content: str
    receiver_username: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/conversations")
def list_conversations(session: Dict[str, Any] = Depends(get_required_github_session)):
    """Return all unique conversations for the current user, with last message and unread count."""
    user_id = _get_user_id(session)
    conn = get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT ON (partner_id)
                    partner_id,
                    partner_username,
                    partner_avatar,
                    last_message,
                    last_at,
                    unread_count
                FROM (
                    SELECT
                        CASE WHEN m.sender_id = %s::uuid THEN m.receiver_id ELSE m.sender_id END AS partner_id,
                        CASE WHEN m.sender_id = %s::uuid THEN ru.username ELSE su.username END AS partner_username,
                        CASE WHEN m.sender_id = %s::uuid THEN ru.avatar_url ELSE su.avatar_url END AS partner_avatar,
                        m.content AS last_message,
                        m.created_at AS last_at,
                        COUNT(*) FILTER (WHERE m.receiver_id = %s::uuid AND NOT m.read) OVER (
                            PARTITION BY
                                CASE WHEN m.sender_id = %s::uuid THEN m.receiver_id ELSE m.sender_id END
                        ) AS unread_count
                    FROM chat_messages m
                    JOIN users su ON su.id = m.sender_id
                    JOIN users ru ON ru.id = m.receiver_id
                    WHERE m.sender_id = %s::uuid OR m.receiver_id = %s::uuid
                    ORDER BY m.created_at DESC
                ) t
                ORDER BY partner_id, last_at DESC
            """, (user_id,) * 7)
            rows = cur.fetchall()
            return [_row(cur, r) for r in rows]
    except Exception as e:
        logger.exception("list_conversations failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)


@router.get("/messages/{username}")
def get_messages(
    username: str,
    limit: int = Query(default=50, ge=1, le=200),
    before: Optional[str] = Query(default=None, description="ISO timestamp for pagination"),
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Return message thread between current user and another user."""
    user_id = _get_user_id(session)

    other = get_user_by_username(username)
    if not other:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")
    other_id = other["id"]

    conn = get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        with conn.cursor() as cur:
            if before:
                cur.execute("""
                    SELECT m.*, su.username AS sender_username, su.avatar_url AS sender_avatar
                    FROM chat_messages m
                    JOIN users su ON su.id = m.sender_id
                    WHERE (
                        (m.sender_id = %s::uuid AND m.receiver_id = %s::uuid)
                        OR
                        (m.sender_id = %s::uuid AND m.receiver_id = %s::uuid)
                    )
                    AND m.created_at < %s::timestamptz
                    ORDER BY m.created_at DESC
                    LIMIT %s
                """, (user_id, other_id, other_id, user_id, before, limit))
            else:
                cur.execute("""
                    SELECT m.*, su.username AS sender_username, su.avatar_url AS sender_avatar
                    FROM chat_messages m
                    JOIN users su ON su.id = m.sender_id
                    WHERE (
                        (m.sender_id = %s::uuid AND m.receiver_id = %s::uuid)
                        OR
                        (m.sender_id = %s::uuid AND m.receiver_id = %s::uuid)
                    )
                    ORDER BY m.created_at DESC
                    LIMIT %s
                """, (user_id, other_id, other_id, user_id, limit))

            rows = cur.fetchall()
            messages = list(reversed([_row(cur, r) for r in rows]))

            # Mark messages as read
            cur.execute("""
                UPDATE chat_messages
                SET read = TRUE
                WHERE receiver_id = %s::uuid AND sender_id = %s::uuid AND NOT read
            """, (user_id, other_id))
            conn.commit()

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
        release_conn(conn)


@router.post("/messages", status_code=201)
def send_message(
    body: SendMessage,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Send a message to another user."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    user_id = _get_user_id(session)
    receiver = get_user_by_username(body.receiver_username)
    if not receiver:
        raise HTTPException(status_code=404, detail=f"User '{body.receiver_username}' not found. They need to have logged into Raptor at least once.")

    if receiver["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot send a message to yourself")

    conn = get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO chat_messages (sender_id, receiver_id, content)
                VALUES (%s::uuid, %s::uuid, %s)
                RETURNING id, sender_id, receiver_id, content, read, created_at
            """, (user_id, receiver["id"], body.content.strip()))
            conn.commit()
            row = cur.fetchone()
            msg = _row(cur, row)
            msg["sender_username"] = session["user"].get("username", "")
            msg["sender_avatar"] = session["user"].get("avatarUrl", "")
            return msg
    except Exception as e:
        logger.exception("send_message failed")
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)


@router.get("/unread-count")
def unread_count(session: Dict[str, Any] = Depends(get_required_github_session)):
    """Return total unread message count for the current user."""
    user_id = _get_user_id(session)
    conn = get_conn()
    if not conn:
        return {"count": 0}
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM chat_messages WHERE receiver_id = %s::uuid AND NOT read",
                (user_id,)
            )
            count = cur.fetchone()[0]
            return {"count": count}
    except Exception:
        return {"count": 0}
    finally:
        release_conn(conn)


@router.get("/users/search")
def search_users(
    q: str = Query(..., min_length=1, max_length=50),
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Search for users to start a conversation with."""
    current_username = session.get("user", {}).get("username", "")
    conn = get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, username, name, avatar_url
                FROM users
                WHERE (username ILIKE %s OR name ILIKE %s)
                  AND username != %s
                  AND account_status = 'active'
                LIMIT 10
            """, (f"%{q}%", f"%{q}%", current_username))
            rows = cur.fetchall()
            return [_row(cur, r) for r in rows]
    except Exception as e:
        logger.exception("search_users failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_conn(conn)
