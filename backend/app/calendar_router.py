"""
Calendar router — persist meetings in the users table via a JSONB column.
Simple approach: store each user's meetings as a JSON blob keyed by user ID.
No separate meetings table needed — meetings are personal and low-volume.
"""
import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth_dependencies import get_required_github_session
from .services.user_service import get_user_by_username
from .services.db import get_conn, release_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/calendar", tags=["Calendar"])


def _get_user_id(session: Dict[str, Any]) -> str:
    username = session.get("user", {}).get("username", "")
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user["id"]


class Meeting(BaseModel):
    id: str
    title: str
    date: str
    time: str
    duration: int
    type: str
    attendees: List[str] = []
    link: Optional[str] = None


def _ensure_meetings_column():
    """Add meetings JSONB column to users if it doesn't exist yet."""
    conn = get_conn()
    if not conn:
        return
    try:
        with conn.cursor() as cur:
            cur.execute("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS meetings JSONB NOT NULL DEFAULT '[]'::jsonb
            """)
            conn.commit()
    except Exception:
        try: conn.rollback()
        except: pass
    finally:
        release_conn(conn)


# Ensure column exists on module load
try:
    _ensure_meetings_column()
except Exception:
    pass


@router.get("/meetings")
def get_meetings(session: Dict[str, Any] = Depends(get_required_github_session)):
    _ensure_meetings_column()
    user_id = _get_user_id(session)
    conn = get_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT meetings FROM users WHERE id = %s::uuid", (user_id,))
            row = cur.fetchone()
            if not row:
                return []
            return row[0] if row[0] else []
    except Exception:
        logger.exception("get_meetings failed")
        return []
    finally:
        release_conn(conn)


@router.put("/meetings")
def save_meetings(
    meetings: List[Meeting],
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Replace the user's entire meetings list (client is source of truth)."""
    _ensure_meetings_column()
    user_id = _get_user_id(session)
    conn = get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET meetings = %s::jsonb WHERE id = %s::uuid",
                (json.dumps([m.dict() for m in meetings]), user_id),
            )
            conn.commit()
            return {"saved": len(meetings)}
    except Exception:
        logger.exception("save_meetings failed")
        try: conn.rollback()
        except: pass
        raise HTTPException(status_code=500, detail="Failed to save meetings")
    finally:
        release_conn(conn)


@router.post("/meetings", status_code=201)
def add_meeting(
    meeting: Meeting,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    _ensure_meetings_column()
    user_id = _get_user_id(session)
    conn = get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE users
                SET meetings = meetings || %s::jsonb
                WHERE id = %s::uuid
                """,
                (json.dumps([meeting.dict()]), user_id),
            )
            conn.commit()
            return meeting
    except Exception:
        logger.exception("add_meeting failed")
        try: conn.rollback()
        except: pass
        raise HTTPException(status_code=500, detail="Failed to add meeting")
    finally:
        release_conn(conn)


@router.delete("/meetings/{meeting_id}", status_code=204)
def delete_meeting(
    meeting_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    _ensure_meetings_column()
    user_id = _get_user_id(session)
    conn = get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        with conn.cursor() as cur:
            # Remove the meeting with matching id from the JSONB array
            cur.execute(
                """
                UPDATE users
                SET meetings = COALESCE((
                    SELECT jsonb_agg(m)
                    FROM jsonb_array_elements(meetings) AS m
                    WHERE m->>'id' != %s
                ), '[]'::jsonb)
                WHERE id = %s::uuid
                """,
                (meeting_id, user_id),
            )
            conn.commit()
    except Exception:
        logger.exception("delete_meeting failed")
        try: conn.rollback()
        except: pass
        raise HTTPException(status_code=500, detail="Failed to delete meeting")
    finally:
        release_conn(conn)
