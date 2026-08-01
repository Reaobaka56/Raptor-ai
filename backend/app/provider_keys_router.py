"""Provider API key management endpoints. Secrets are never returned."""
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from .auth_dependencies import get_required_github_session
from .services.user_service import get_user_by_username
from .services.provider_key_service import SUPPORTED_PROVIDERS, list_keys, upsert_key, delete_key

router = APIRouter(prefix="/api/provider-keys", tags=["Provider Keys"])

def _user(session: Dict[str, Any]) -> Dict[str, Any]:
    username=session.get("user",{}).get("username","")
    user=get_user_by_username(username)
    if not user: raise HTTPException(status_code=404, detail="User record not found")
    return user

class KeyRequest(BaseModel):
    provider: str
    api_key: str = Field(min_length=8, max_length=4096)

@router.get("/providers")
def providers(): return {"providers": sorted(SUPPORTED_PROVIDERS)}

@router.get("")
def my_keys(session: Dict[str, Any] = Depends(get_required_github_session)):
    return list_keys(_user(session)["id"])

@router.put("", status_code=200)
def save_key(body: KeyRequest, session: Dict[str, Any] = Depends(get_required_github_session)):
    rec=upsert_key(_user(session)["id"], body.provider, body.api_key)
    if not rec: raise HTTPException(status_code=400, detail="Unsupported provider or invalid key")
    return rec

@router.delete("/{provider}", status_code=204)
def remove_key(provider: str, session: Dict[str, Any] = Depends(get_required_github_session)):
    delete_key(_user(session)["id"], provider)
