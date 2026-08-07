"""
Sandbox router — REST API for agent sandbox sessions.
"""
import logging
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, HttpUrl, field_validator

from .auth_dependencies import get_required_github_session
from .services.user_service import get_user_by_username
from .services import sandbox_service
from .services.provider_key_service import SUPPORTED_PROVIDERS, key_configured

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sandbox", tags=["Sandbox"])

ADMIN_USERNAME = "reaobaka56"

FREE_TIER_LIMITS = {
    "max_sessions_per_day": 3,
    "max_session_minutes": 30,
    "max_memory_mb": 256,
}
PREMIUM_TIER_LIMITS = {
    "max_sessions_per_day": 999,
    "max_session_minutes": 240,
    "max_memory_mb": 2048,
}


def _get_user(session: Dict[str, Any]) -> Dict[str, Any]:
    username = session.get("user", {}).get("username", "")
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User record not found")
    return user


def _tier_limits(username: str) -> dict:
    if username.lower() == ADMIN_USERNAME.lower():
        return PREMIUM_TIER_LIMITS
    return FREE_TIER_LIMITS


# ── Request schemas ────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    name: str = "New Session"
    agent_type: str = "custom"
    repo_url: Optional[str] = None
    provider: Optional[str] = None
    provider_key_source: str = "platform"
    policy: dict = {}
    resource_limits: dict = {}
    agent_id: Optional[str] = None
    environment_vars: dict = {}
    api_key_refs: list = []
    network_policy: dict = {"allow": True}
    filesystem_permissions: dict = {}
    tool_permissions: list = []

    @field_validator("repo_url")
    @classmethod
    def validate_repo_url(cls, value: Optional[str]) -> Optional[str]:
        if not value or not value.strip():
            return None
        value = value.strip()
        if not re.match(r"^https://(www\.)?github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$", value):
            raise ValueError("Repository URL must be a GitHub repository URL like https://github.com/username/repository")
        return value.rstrip("/")


class ExecuteRequest(BaseModel):
    command: str
    timeout: int = 30


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/sessions")
def list_sessions(session: Dict[str, Any] = Depends(get_required_github_session)):
    user = _get_user(session)
    return sandbox_service.list_sessions(user["id"])


@router.post("/sessions", status_code=201)
def create_session(
    body: CreateSessionRequest,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    limits = _tier_limits(user["username"])

    provider = body.provider.lower() if body.provider else None
    provider_key_source = body.provider_key_source if body.provider_key_source in ("platform", "user") else "platform"
    if provider and provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unsupported provider")
    if provider_key_source == "user" and (not provider or not key_configured(user["id"], provider)):
        raise HTTPException(status_code=400, detail="Add a personal API key for this provider before using it in Sandbox")

    # Merge policy with tier limits
    policy = {
        "allow_network": True,
        "blocked_domains": ["169.254.169.254", "metadata.google.internal"],
        "blocked_paths": [".env", ".ssh", ".aws", "*.pem", "*.key"],
        "max_file_size_mb": 10,
        "max_session_minutes": limits["max_session_minutes"],
        **body.policy,
    }
    resource_limits = {
        "max_memory_mb": limits["max_memory_mb"],
        "max_cpu_percent": 80,
        "max_disk_mb": 1024,
        "max_processes": 20,
        **body.resource_limits,
    }

    try:
        return sandbox_service.create_session(
            owner_id=user["id"],
            name=body.name,
            repo_url=body.repo_url,
            agent_type=body.agent_type,
            policy=policy,
            resource_limits=resource_limits,
            provider=provider,
            provider_key_source=provider_key_source,
            agent_id=body.agent_id,
            environment_vars=body.environment_vars,
            api_key_refs=body.api_key_refs,
            network_policy=body.network_policy,
            filesystem_permissions=body.filesystem_permissions,
            tool_permissions=body.tool_permissions,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}")
def get_session(
    session_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    s = sandbox_service.get_session(session_id, user["id"])
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


@router.delete("/sessions/{session_id}", status_code=204)
def stop_session(
    session_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    if not sandbox_service.stop_session(session_id, user["id"]):
        raise HTTPException(status_code=404, detail="Session not found")


@router.post("/sessions/{session_id}/pause", status_code=200)
def pause_session(
    session_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    if not sandbox_service.pause_session(session_id, user["id"]):
        raise HTTPException(status_code=404, detail="Session not found or not running")
    return {"status": "paused"}


@router.post("/sessions/{session_id}/resume", status_code=200)
def resume_session(
    session_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    if not sandbox_service.resume_session(session_id, user["id"]):
        raise HTTPException(status_code=404, detail="Session not found or not paused")
    return {"status": "running"}


@router.post("/sessions/{session_id}/execute")
def execute(
    session_id: str,
    body: ExecuteRequest,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    limits = _tier_limits(user["username"])
    timeout = min(body.timeout, 60)  # cap at 60s for free, more for premium

    try:
        return sandbox_service.execute_command(
            session_id=session_id,
            owner_id=user["id"],
            command=body.command,
            timeout=timeout,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/events")
def get_events(
    session_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    return sandbox_service.get_events(session_id, user["id"], limit=limit)


@router.get("/sessions/{session_id}/stats")
def get_stats(
    session_id: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    user = _get_user(session)
    return sandbox_service.get_session_stats(session_id, user["id"])
