"""
Calendar router — team meetings backed by real `meetings` /
`meeting_attendees` tables (see migration 011).

Previously meetings were a private JSONB blob on each user's own row, which
meant there was no way for one user's created meeting to actually notify or
even appear for the attendees they picked. This version makes meetings a
shared entity scoped to a team, restricts attendees server-side to that
team's membership, and fires a Raptor Bot chat notification to each invited
attendee.
"""
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth_dependencies import get_required_github_session, get_current_user
from .services.db import get_conn, release_conn, row_to_dict as _row
from .services.team_service import list_members, is_team_member
from .services.bot_service import send_meeting_invite

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/calendar", tags=["Calendar"])


async def _get_user(session: Dict[str, Any]) -> Dict[str, Any]:
    return await get_current_user(session)


class MeetingCreate(BaseModel):
    team_id: str
    title: str
    date: str
    time: str
    duration: int = 30
    type: str = "meeting"
    link: Optional[str] = None
    attendee_usernames: List[str] = []


@router.get("/meetings")
async def get_meetings(session: Dict[str, Any] = Depends(get_required_github_session)):
    """Meetings the current user created or was invited to, across all their teams."""
    user = await _get_user(session)
    conn = await get_conn()
    if not conn:
        return []
    try:
        rows = await conn.fetch(
            """
            SELECT m.id, m.team_id, m.created_by, m.title, m.date, m.time, m.duration,
                   m.type, m.link, m.created_at,
                   t.name AS team_name, cu.username AS created_by_username,
                   COALESCE(
                       json_agg(
                           json_build_object('username', au.username, 'status', ma2.status)
                       ) FILTER (WHERE au.username IS NOT NULL), '[]'
                   ) AS attendees
            FROM meetings m
            JOIN teams t ON t.id = m.team_id
            JOIN users cu ON cu.id = m.created_by
            LEFT JOIN meeting_attendees ma2 ON ma2.meeting_id = m.id
            LEFT JOIN users au ON au.id = ma2.user_id
            WHERE m.id IN (
                SELECT meeting_id FROM meeting_attendees WHERE user_id = $1::uuid
                UNION
                SELECT id FROM meetings WHERE created_by = $1::uuid
            )
            GROUP BY m.id, t.name, cu.username
            ORDER BY m.date ASC, m.time ASC
            """,
            user["id"],
        )
        return [_row(r) for r in rows]
    except Exception:
        logger.exception("get_meetings failed")
        return []
    finally:
        await release_conn(conn)


@router.post("/meetings", status_code=201)
async def create_meeting(body: MeetingCreate, session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_user(session)

    if not await is_team_member(body.team_id, user["id"]):
        raise HTTPException(status_code=403, detail="You're not a member of this team")

    # Server-side attendee restriction: resolve requested usernames against
    # the team's real membership. Anyone not on the team is silently
    # dropped rather than trusted from the client — a malicious client
    # can't smuggle in a user ID from another team by editing the request.
    members = await list_members(body.team_id)
    member_by_username = {m["username"]: m for m in members}
    valid_attendees = [member_by_username[u] for u in body.attendee_usernames if u in member_by_username]

    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                INSERT INTO meetings (team_id, created_by, title, date, time, duration, type, link)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8)
                RETURNING id, team_id, created_by, title, date, time, duration, type, link, created_at
                """,
                body.team_id, user["id"], body.title, body.date, body.time,
                body.duration, body.type, body.link,
            )
            meeting = _row(row)
            for member in valid_attendees:
                await conn.execute(
                    """INSERT INTO meeting_attendees (meeting_id, user_id)
                       VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING""",
                    meeting["id"], member["id"],
                )
    except Exception:
        logger.exception("create_meeting failed")
        raise HTTPException(status_code=500, detail="Failed to create meeting")
    finally:
        await release_conn(conn)

    inviter_name = user.get("name") or user["username"]
    for member in valid_attendees:
        if member["id"] == user["id"]:
            continue
        try:
            await send_meeting_invite(member["id"], body.title, inviter_name, body.date, body.time)
        except Exception:
            logger.exception("failed to send meeting-invite bot notification to %s", member["username"])

    meeting["attendees"] = [{"username": m["username"], "status": "invited"} for m in valid_attendees]
    return meeting


@router.delete("/meetings/{meeting_id}", status_code=204)
async def delete_meeting(meeting_id: str, session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_user(session)
    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        row = await conn.fetchrow("SELECT created_by FROM meetings WHERE id::text = $1", meeting_id)
        if not row:
            raise HTTPException(status_code=404, detail="Meeting not found")
        if str(row["created_by"]) != user["id"]:
            raise HTTPException(status_code=403, detail="Only the meeting creator can delete it")
        await conn.execute("DELETE FROM meetings WHERE id::text = $1", meeting_id)
    except HTTPException:
        raise
    except Exception:
        logger.exception("delete_meeting failed")
        raise HTTPException(status_code=500, detail="Failed to delete meeting")
    finally:
        await release_conn(conn)
