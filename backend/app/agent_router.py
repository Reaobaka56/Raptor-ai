"""
Agent router — REST API for AI agents.
"""
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException

from .auth_dependencies import get_required_github_session
from .services.user_service import get_user_by_username
from .services import agent_service

router = APIRouter(prefix="/api/agents", tags=["Agents"])


def _get_user(session: Dict[str, Any]) -> Dict[str, Any]:
    username = session.get("user", {}).get("username", "")
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/templates")
def get_templates():
    return agent_service.get_agent_templates()


@router.post("", status_code=201)
def create_agent(
    data: dict,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    return agent_service.create_agent(user["id"], data)


@router.get("")
def list_agents(session: Dict[str, Any] = Depends(get_required_github_session)):
    user = _get_user(session)
    return agent_service.list_agents(user["id"])


@router.get("/{agent_id}")
def get_agent(
    agent_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    agent = agent_service.get_agent(agent_id, user["id"])
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.patch("/{agent_id}")
def update_agent(
    agent_id: str,
    data: dict,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    agent = agent_service.update_agent(agent_id, user["id"], data)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.delete("/{agent_id}", status_code=204)
def delete_agent(
    agent_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    if not agent_service.delete_agent(agent_id, user["id"]):
        raise HTTPException(status_code=404, detail="Agent not found")


@router.get("/{agent_id}/activity")
def get_activity(
    agent_id: str,
    limit: int = 100,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    return agent_service.get_activity_log(user["id"], agent_id, limit)


@router.post("/{agent_id}/status")
def update_status(
    agent_id: str,
    data: dict,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    status = data.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="Missing status")
    try:
        agent = agent_service.update_agent_status(agent_id, user["id"], status)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        return agent
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
