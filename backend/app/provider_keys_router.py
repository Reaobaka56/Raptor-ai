"""Provider API key management endpoints. Secrets are never returned."""
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from .auth_dependencies import get_required_github_session, get_current_user as _user
from .services.user_service import get_user_by_username
from .services.provider_key_service import (
    SUPPORTED_PROVIDERS,
    list_keys,
    upsert_key,
    delete_key,
    get_decrypted_key,
)

router = APIRouter(prefix="/api/provider-keys", tags=["Provider Keys"])

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


def _validate_key(provider: str, api_key: str) -> Dict[str, Any]:
    """Cheap validation call against the provider (list models)."""
    import requests
    try:
        if provider in ("openai",):
            resp = requests.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )
        elif provider == "groq":
            resp = requests.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )
        elif provider == "anthropic":
            resp = requests.get(
                "https://api.anthropic.com/v1/models",
                headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
                timeout=10,
            )
        elif provider in ("google", "gemini"):
            resp = requests.get(
                f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
                timeout=10,
            )
        elif provider == "mistral":
            resp = requests.get(
                "https://api.mistral.ai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )
        else:
            return {"ok": False, "error": "Unsupported provider"}

        if resp.status_code < 300:
            return {"ok": True}
        return {"ok": False, "error": f"Provider returned {resp.status_code}"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}


@router.post("/{provider}/test")
def test_key(provider: str, session: Dict[str, Any] = Depends(get_required_github_session)):
    provider = provider.lower().strip()
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unsupported provider")
    api_key = get_decrypted_key(_user(session)["id"], provider)
    if not api_key:
        return {"ok": False, "error": "No key configured for this provider"}
    return _validate_key(provider, api_key)
