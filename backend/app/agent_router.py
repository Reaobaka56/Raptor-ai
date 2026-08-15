"""
Agent router — REST API for AI agents.
"""
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException

from .auth_dependencies import get_required_github_session, get_current_user as _get_user
from .services.user_service import get_user_by_username
from .services import agent_service
from .services.provider_key_service import upsert_key, SUPPORTED_PROVIDERS

router = APIRouter(prefix="/api/agents", tags=["Agents"])


@router.get("/templates")
async def get_templates(session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_user(session)
    return await agent_service.get_agent_templates(owner_id=user["id"])


@router.post("/templates", status_code=201)
async def create_template(
    data: dict,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = await _get_user(session)
    if not (data.get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Template name is required")
    return await agent_service.create_custom_template(user["id"], data)


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = await _get_user(session)
    if not await agent_service.delete_custom_template(template_id, user["id"]):
        raise HTTPException(status_code=404, detail="Template not found")


@router.post("", status_code=201)
async def create_agent(
    data: dict,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = await _get_user(session)
    # Optional inline API key: if the caller included one alongside the
    # provider, save it via the single canonical provider-keys path instead
    # of duplicating key-storage logic here.
    api_key = (data.pop("api_key", None) or "").strip()
    provider = (data.get("provider") or "").lower().strip()
    if api_key:
        if provider not in SUPPORTED_PROVIDERS:
            raise HTTPException(status_code=400, detail="Unsupported provider for API key")
        if not await upsert_key(user["id"], provider, api_key):
            raise HTTPException(status_code=400, detail="Failed to save API key")
    return await agent_service.create_agent(user["id"], data)


@router.get("")
async def list_agents(session: Dict[str, Any] = Depends(get_required_github_session)):
    user = await _get_user(session)
    return await agent_service.list_agents(user["id"])


@router.get("/{agent_id}")
async def get_agent(
    agent_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = await _get_user(session)
    agent = await agent_service.get_agent(agent_id, user["id"])
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.patch("/{agent_id}")
async def update_agent(
    agent_id: str,
    data: dict,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = await _get_user(session)
    agent = await agent_service.update_agent(agent_id, user["id"], data)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(
    agent_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = await _get_user(session)
    if not await agent_service.delete_agent(agent_id, user["id"]):
        raise HTTPException(status_code=404, detail="Agent not found")


@router.get("/{agent_id}/activity")
async def get_activity(
    agent_id: str,
    limit: int = 100,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = await _get_user(session)
    return await agent_service.get_activity_log(user["id"], agent_id, limit)


@router.post("/{agent_id}/status")
async def update_status(
    agent_id: str,
    data: dict,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = await _get_user(session)
    status = data.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="Missing status")
    try:
        agent = await agent_service.update_agent_status(agent_id, user["id"], status)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        return agent
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
