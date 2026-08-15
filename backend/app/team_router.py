"""
Team router — create teams, manage members, send/accept invitations.

Role hierarchy enforced server-side:
  owner  → full control including team deletion
  admin  → manage members, send invites
  member → read-only team access
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from .auth_dependencies import get_required_github_session, get_current_user as _get_db_user
from .services.user_service import get_user_by_username
from .services.db import get_conn, release_conn
from .services.team_service import (
    create_team, get_team, list_user_teams,
    list_members, get_member_role, add_member, remove_member,
    create_invitation, get_invitation, accept_invitation,
    ensure_join_token, join_team_by_token, AlreadyTeamMemberError,
)

router = APIRouter(prefix="/api/teams", tags=["Teams"])


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _require_team_role(team_id: str, user_id: str, min_role: str) -> str:
    """Returns the user's actual role if >= min_role, else raises 403."""
    hierarchy = {"owner": 3, "admin": 2, "member": 1}
    role = await get_member_role(team_id, user_id)
    if not role or hierarchy.get(role, 0) < hierarchy.get(min_role, 0):
        raise HTTPException(status_code=403, detail=f"Requires {min_role} role or above")
    return role


# ── Request schemas ────────────────────────────────────────────────────────────

class TeamCreate(BaseModel):
    name: str


class InviteRequest(BaseModel):
    invitee_email: Optional[str] = None
    invitee_github: Optional[str] = None
    role: str = "member"


class AddMemberRequest(BaseModel):
    username: str
    role: str = "member"

class JoinTokenRequest(BaseModel):
    token: str


# ── Team CRUD ──────────────────────────────────────────────────────────────────

@router.get("")
async def my_teams(session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_db_user(session)
    return await list_user_teams(user["id"])


@router.post("", status_code=201)
async def new_team(body: TeamCreate,
                    session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_db_user(session)
    team = await create_team(owner_id=user["id"], name=body.name)
    if not team:
        raise HTTPException(status_code=500, detail="Failed to create team")
    token = await ensure_join_token(team["id"])
    return {**team, "join_token": token}


@router.post("/join", status_code=201)
async def join_by_token(body: JoinTokenRequest, session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_db_user(session)
    try:
        team = await join_team_by_token(user["id"], body.token)
    except AlreadyTeamMemberError:
        raise HTTPException(status_code=400, detail="You are already a member of this team")
    if not team:
        raise HTTPException(status_code=400, detail="Team token is invalid or expired")
    return team


@router.get("/{team_id}")
async def team_detail(team_id: str,
                       session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_db_user(session)
    await _require_team_role(team_id, user["id"], "member")
    team = await get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    role = await get_member_role(team_id, user["id"])
    result = {**team, "members": await list_members(team_id)}
    if role == "owner":
        result["join_token_configured"] = bool(team.get("join_token_hash"))
    return result


@router.post("/{team_id}/join-token/regenerate")
async def regenerate_join_token(team_id: str, session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_db_user(session)
    await _require_team_role(team_id, user["id"], "owner")
    token = await ensure_join_token(team_id)
    if not token:
        raise HTTPException(status_code=500, detail="Failed to regenerate team token")
    return {"join_token": token}


# ── Members ────────────────────────────────────────────────────────────────────

@router.get("/{team_id}/members")
async def members(team_id: str,
                   session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_db_user(session)
    await _require_team_role(team_id, user["id"], "member")
    return await list_members(team_id)


@router.post("/{team_id}/members", status_code=201)
async def add_by_username(team_id: str, body: AddMemberRequest,
                           session: Dict[str, Any] = Depends(get_required_github_session)):
    """Add an existing Raptor user directly (admin+ only)."""
    actor = await _get_db_user(session)
    await _require_team_role(team_id, actor["id"], "admin")

    target = await get_user_by_username(body.username)
    if not target:
        raise HTTPException(status_code=404,
                            detail=f"User '{body.username}' has not logged into Raptor yet")

    if not await add_member(team_id, target["id"], body.role):
        raise HTTPException(status_code=500, detail="Failed to add member")
    return {"added": body.username, "role": body.role}


@router.delete("/{team_id}/members/{username}", status_code=204)
async def kick_member(team_id: str, username: str,
                       session: Dict[str, Any] = Depends(get_required_github_session)):
    actor = await _get_db_user(session)
    actor_role = await _require_team_role(team_id, actor["id"], "admin")

    target = await get_user_by_username(username)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Owners can't be removed by admins
    target_role = await get_member_role(team_id, target["id"])
    if target_role == "owner" and actor_role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can remove another owner")

    if not await remove_member(team_id, target["id"]):
        raise HTTPException(status_code=404, detail="Member not found in this team")


# ── Invitations ────────────────────────────────────────────────────────────────

@router.post("/{team_id}/invitations", status_code=201)
async def invite(team_id: str, body: InviteRequest,
                  session: Dict[str, Any] = Depends(get_required_github_session)):
    actor = await _get_db_user(session)
    await _require_team_role(team_id, actor["id"], "admin")

    if not body.invitee_email and not body.invitee_github:
        raise HTTPException(status_code=400, detail="Provide invitee_email or invitee_github")

    inv = await create_invitation(
        team_id=team_id,
        invited_by=actor["id"],
        invitee_email=body.invitee_email,
        invitee_github=body.invitee_github,
        role=body.role,
    )
    if not inv:
        raise HTTPException(status_code=500, detail="Failed to create invitation")

    # TODO: send email via SendGrid/Resend when invitee_email is set
    # For now return the token so the frontend can construct the acceptance URL
    return inv


@router.get("/invitations/{token}")
async def view_invitation(token: str):
    """Public — anyone with the link can see the invite details before accepting."""
    inv = await get_invitation(token)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or expired")
    return inv


@router.delete("/{team_id}/leave", status_code=204)
async def leave_team(team_id: str,
                      session: Dict[str, Any] = Depends(get_required_github_session)):
    """Leave a team (non-owners only)."""
    actor = await _get_db_user(session)
    role = await get_member_role(team_id, actor["id"])
    if not role:
        raise HTTPException(status_code=404, detail="You are not a member of this team")
    if role == "owner":
        raise HTTPException(status_code=400, detail="Owners cannot leave — transfer ownership or delete the team")
    if not await remove_member(team_id, actor["id"]):
        raise HTTPException(status_code=500, detail="Failed to leave team")


@router.delete("/{team_id}", status_code=204)
async def delete_team(team_id: str,
                       session: Dict[str, Any] = Depends(get_required_github_session)):
    """Delete a team (owner only)."""
    actor = await _get_db_user(session)
    await _require_team_role(team_id, actor["id"], "owner")

    conn = await get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        await conn.execute("DELETE FROM teams WHERE id = $1", team_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete team")
    finally:
        await release_conn(conn)


@router.get("/{team_id}/join-token")
async def get_join_token_status(
    team_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Check if a join token is configured for this team (does not reveal the token)."""
    actor = await _get_db_user(session)
    await _require_team_role(team_id, actor["id"], "admin")

    conn = await get_conn()
    if not conn:
        return {"configured": False}
    try:
        row = await conn.fetchrow(
            "SELECT join_token_hash IS NOT NULL AS configured, join_token_created_at FROM teams WHERE id = $1::uuid",
            team_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Team not found")
        return {
            "configured": bool(row["configured"]),
            "created_at": row["join_token_created_at"].isoformat() if row["join_token_created_at"] else None
        }
    finally:
        await release_conn(conn)

@router.post("/invitations/{token}/accept")
async def accept(token: str,
                  session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_db_user(session)
    ok = await accept_invitation(token, user["id"])
    if not ok:
        raise HTTPException(status_code=400, detail="Invitation invalid, expired, or already used")
    return {"accepted": True}
