"""
Team task router — assign a to-do to one specific team member, or to
everyone on a team. Only members of the selected team can ever be assignees
(verified server-side, not just filtered in the picker).
"""
import logging
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth_dependencies import get_required_github_session, get_current_user
from .services import team_task_service
from .services.team_service import list_members, is_team_member, get_member_role
from .services.bot_service import send_task_completed

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/team-tasks", tags=["Team Tasks"])


async def _uid(session: Dict[str, Any]) -> str:
    user = await get_current_user(session)
    return user["id"]


class TaskCreate(BaseModel):
    team_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: int = Field(default=2, ge=0, le=3)
    assign_mode: Literal["individual", "everyone"] = "individual"
    assignee_username: Optional[str] = None  # required when assign_mode == "individual"


@router.post("", status_code=201)
async def create_task(body: TaskCreate, session: Dict[str, Any] = Depends(get_required_github_session)):
    user_id = await _uid(session)

    # Must be a member of the team to create a task for it.
    if not await is_team_member(body.team_id, user_id):
        raise HTTPException(status_code=403, detail="You're not a member of this team")

    members = await list_members(body.team_id)
    member_by_username = {m["username"]: m for m in members}

    if body.assign_mode == "everyone":
        assignee_ids = [m["id"] for m in members]
    else:
        if not body.assignee_username:
            raise HTTPException(status_code=400, detail="assignee_username is required for individual assignment")
        member = member_by_username.get(body.assignee_username)
        if not member:
            # Explicitly reject assignees outside the selected team, even if
            # the client somehow submitted a valid user ID for someone else.
            raise HTTPException(status_code=403, detail="That user is not a member of this team")
        assignee_ids = [member["id"]]

    task = await team_task_service.create_task(
        team_id=body.team_id, created_by=user_id, title=body.title.strip(),
        description=body.description, priority=body.priority,
        assign_mode=body.assign_mode, assignee_ids=assignee_ids,
    )
    if not task:
        raise HTTPException(status_code=500, detail="Failed to create task")
    return task


@router.get("/team/{team_id}")
async def list_for_team(team_id: str, session: Dict[str, Any] = Depends(get_required_github_session)):
    user_id = await _uid(session)
    if not await is_team_member(team_id, user_id):
        raise HTTPException(status_code=403, detail="You're not a member of this team")
    return await team_task_service.list_tasks_for_team(team_id)


@router.get("/mine")
async def list_mine(session: Dict[str, Any] = Depends(get_required_github_session)):
    user_id = await _uid(session)
    return await team_task_service.list_tasks_for_user(user_id)


@router.post("/{task_id}/complete")
async def complete_task(task_id: str, session: Dict[str, Any] = Depends(get_required_github_session)):
    user_id = await _uid(session)
    task = await team_task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    ok = await team_task_service.complete_for_user(task_id, user_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Task not assigned to you, or already complete")
    await send_task_completed(user_id, task["title"])
    return {"status": "completed"}


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, session: Dict[str, Any] = Depends(get_required_github_session)):
    user_id = await _uid(session)
    task = await team_task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    role = await get_member_role(task["team_id"], user_id)
    if task["created_by"] != user_id and role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only the creator or a team admin can delete this task")
    await team_task_service.delete_task(task_id)
