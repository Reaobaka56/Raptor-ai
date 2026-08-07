"""
Task router — REST API for agent tasks.
"""
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from .auth_dependencies import get_required_github_session
from .services.user_service import get_user_by_username
from .services import task_service

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


def _get_user(session: Dict[str, Any]) -> Dict[str, Any]:
    username = session.get("user", {}).get("username", "")
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("", status_code=201)
def create_task(
    data: dict,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    return task_service.create_task(user["id"], data)


@router.get("")
def list_tasks(
    status: Optional[str] = None,
    agent_id: Optional[str] = None,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    return task_service.list_tasks(user["id"], status, agent_id)


@router.get("/{task_id}")
def get_task(
    task_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    task = task_service.get_task(task_id, user["id"])
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}")
def update_task(
    task_id: str,
    data: dict,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    task = task_service.update_task(task_id, user["id"], data)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    if not task_service.delete_task(task_id, user["id"]):
        raise HTTPException(status_code=404, detail="Task not found")
