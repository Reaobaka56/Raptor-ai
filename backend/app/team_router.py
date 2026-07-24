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

from .auth_dependencies import get_required_github_session
from .services.user_service import get_user_by_username
from .services.team_service import (
    create_team, get_team, list_user_teams,
    list_members, get_member_role, add_member, remove_member,
    create_invitation, get_invitation, accept_invitation,
)

router = APIRouter(prefix="/api/teams", tags=["Teams"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_db_user(session: Dict[str, Any]) -> Dict[str, Any]:
    username = session.get("user", {}).get("username", "")
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User record not found — log in again")
    return user


def _require_team_role(team_id: str, user_id: str, min_role: str) -> str:
    """Returns the user's actual role if >= min_role, else raises 403."""
    hierarchy = {"owner": 3, "admin": 2, "member": 1}
    role = get_member_role(team_id, user_id)
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


# ── Team CRUD ──────────────────────────────────────────────────────────────────

@router.get("")
def my_teams(session: Dict[str, Any] = Depends(get_required_github_session)):
    user = _get_db_user(session)
    return list_user_teams(user["id"])


@router.post("", status_code=201)
def new_team(body: TeamCreate,
             session: Dict[str, Any] = Depends(get_required_github_session)):
    user = _get_db_user(session)
    team = create_team(owner_id=user["id"], name=body.name)
    if not team:
        raise HTTPException(status_code=500, detail="Failed to create team")
    return team


@router.get("/{team_id}")
def team_detail(team_id: str,
                session: Dict[str, Any] = Depends(get_required_github_session)):
    user = _get_db_user(session)
    _require_team_role(team_id, user["id"], "member")
    team = get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return {**team, "members": list_members(team_id)}


# ── Members ────────────────────────────────────────────────────────────────────

@router.get("/{team_id}/members")
def members(team_id: str,
            session: Dict[str, Any] = Depends(get_required_github_session)):
    user = _get_db_user(session)
    _require_team_role(team_id, user["id"], "member")
    return list_members(team_id)


@router.post("/{team_id}/members", status_code=201)
def add_by_username(team_id: str, body: AddMemberRequest,
                    session: Dict[str, Any] = Depends(get_required_github_session)):
    """Add an existing Raptor user directly (admin+ only)."""
    actor = _get_db_user(session)
    _require_team_role(team_id, actor["id"], "admin")

    target = get_user_by_username(body.username)
    if not target:
        raise HTTPException(status_code=404,
                            detail=f"User '{body.username}' has not logged into Raptor yet")

    if not add_member(team_id, target["id"], body.role):
        raise HTTPException(status_code=500, detail="Failed to add member")
    return {"added": body.username, "role": body.role}


@router.delete("/{team_id}/members/{username}", status_code=204)
def kick_member(team_id: str, username: str,
                session: Dict[str, Any] = Depends(get_required_github_session)):
    actor = _get_db_user(session)
    actor_role = _require_team_role(team_id, actor["id"], "admin")

    target = get_user_by_username(username)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Owners can't be removed by admins
    target_role = get_member_role(team_id, target["id"])
    if target_role == "owner" and actor_role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can remove another owner")

    if not remove_member(team_id, target["id"]):
        raise HTTPException(status_code=404, detail="Member not found in this team")


@router.delete("/{team_id}/leave", status_code=204)
def leave_team(team_id: str,
               session: Dict[str, Any] = Depends(get_required_github_session)):
    actor = _get_db_user(session)
    actor_role = get_member_role(team_id, actor["id"])
    
    if not actor_role:
        raise HTTPException(status_code=404, detail="You are not a member of this team")
        
    if actor_role == "owner":
        # Check if there are other owners before allowing to leave, or prevent entirely
        members = list_members(team_id)
        owners = [m for m in members if m["role"] == "owner"]
        if len(owners) <= 1:
            raise HTTPException(status_code=400, detail="You are the only owner. You must delete the team or promote someone else to owner first.")

    if not remove_member(team_id, actor["id"]):
        raise HTTPException(status_code=500, detail="Failed to leave team")

@router.delete("/{team_id}", status_code=204)
def delete_team(team_id: str,
                session: Dict[str, Any] = Depends(get_required_github_session)):
    actor = _get_db_user(session)
    _require_team_role(team_id, actor["id"], "owner")
    from .services.team_service import delete_team as db_delete_team
    if not db_delete_team(team_id):
        raise HTTPException(status_code=500, detail="Failed to delete team")


# ── Invitations ────────────────────────────────────────────────────────────────

@router.post("/{team_id}/invitations", status_code=201)
def invite(team_id: str, body: InviteRequest,
           session: Dict[str, Any] = Depends(get_required_github_session)):
    actor = _get_db_user(session)
    _require_team_role(team_id, actor["id"], "admin")

    if not body.invitee_email and not body.invitee_github:
        raise HTTPException(status_code=400, detail="Provide invitee_email or invitee_github")

    inv = create_invitation(
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
def view_invitation(token: str):
    """Public — anyone with the link can see the invite details before accepting."""
    inv = get_invitation(token)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or expired")
    return inv


@router.post("/invitations/{token}/accept")
def accept(token: str,
           session: Dict[str, Any] = Depends(get_required_github_session)):
    user = _get_db_user(session)
    ok = accept_invitation(token, user["id"])
    if not ok:
        raise HTTPException(status_code=400, detail="Invitation invalid, expired, or already used")
    return {"accepted": True}
