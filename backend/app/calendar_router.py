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

from .auth_dependencies import get_required_github_session, get_current_user
from .services.db import get_conn, release_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/calendar", tags=["Calendar"])


async def _get_user_id(session: Dict[str, Any]) -> str:
    user = await get_current_user(session)
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


_meetings_column_ready = False


async def _ensure_meetings_column():
    """Add meetings JSONB column to users if it doesn't exist yet. Runs at
    most once per process (was previously a module-import-time side effect,
    which can't work now that get_conn() is async — there's no event loop
    yet at import time — so it's lazily run on first request instead)."""
    global _meetings_column_ready
    if _meetings_column_ready:
        return
    conn = await get_conn()
    if not conn:
        return
    try:
        await conn.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS meetings JSONB NOT NULL DEFAULT '[]'::jsonb
        """)
        _meetings_column_ready = True
    except Exception:
        logger.exception("_ensure_meetings_column failed")
    finally:
        await release_conn(conn)


@router.get("/meetings")
async def get_meetings(session: Dict[str, Any] = Depends(get_required_github_session)):
    await _ensure_meetings_column()
    user_id = await _get_user_id(session)
    conn = await get_conn()
    if not conn:
        return []
    try:
        row = await conn.fetchrow("SELECT meetings FROM users WHERE id = $1::uuid", user_id)
        if not row:
            return []
        return row["meetings"] if row["meetings"] else []
    except Exception:
        logger.exception("get_meetings failed")
        return []
    finally:
        await release_conn(conn)


@router.put("/meetings")
async def save_meetings(
    meetings: List[Meeting],
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Replace the user's entire meetings list (client is source of truth)."""
    await _ensure_meetings_column()
    user_id = await _get_user_id(session)
    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        await conn.execute(
            "UPDATE users SET meetings = $1::jsonb WHERE id = $2::uuid",
            json.dumps([m.dict() for m in meetings]), user_id,
        )
        return {"saved": len(meetings)}
    except Exception:
        logger.exception("save_meetings failed")
        raise HTTPException(status_code=500, detail="Failed to save meetings")
    finally:
        await release_conn(conn)


@router.post("/meetings", status_code=201)
async def add_meeting(
    meeting: Meeting,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    await _ensure_meetings_column()
    user_id = await _get_user_id(session)
    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        result = await conn.execute(
            """
            UPDATE users
            SET meetings = meetings || $1::jsonb
            WHERE id = $2::uuid
            """,
            json.dumps([meeting.dict()]), user_id,
        )
        if result.split()[-1] == "0":
            # No matching user row — don't report success on a no-op write.
            raise HTTPException(status_code=404, detail="User record not found — log in again")
        return meeting
    except HTTPException:
        raise
    except Exception:
        logger.exception("add_meeting failed")
        raise HTTPException(status_code=500, detail="Failed to add meeting")
    finally:
        await release_conn(conn)


@router.delete("/meetings/{meeting_id}", status_code=204)
async def delete_meeting(
    meeting_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    await _ensure_meetings_column()
    user_id = await _get_user_id(session)
    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        # Remove the meeting with matching id from the JSONB array
        await conn.execute(
            """
            UPDATE users
            SET meetings = COALESCE((
                SELECT jsonb_agg(m)
                FROM jsonb_array_elements(meetings) AS m
                WHERE m->>'id' != $1
            ), '[]'::jsonb)
            WHERE id = $2::uuid
            """,
            meeting_id, user_id,
        )
    except Exception:
        logger.exception("delete_meeting failed")
        raise HTTPException(status_code=500, detail="Failed to delete meeting")
    finally:
        await release_conn(conn)
