"""Per-user provider API key storage with encrypted secrets."""
import base64, hashlib, os
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet
from .db import get_conn, release_conn, row_to_dict as _row

SUPPORTED_PROVIDERS = {
    "openai", "anthropic", "google", "gemini", "mistral", "groq",
    "deepseek", "xai", "cohere", "openrouter",
}

PROVIDER_LABELS = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "google": "Google",
    "gemini": "Gemini",
    "mistral": "Mistral",
    "groq": "Groq",
    "deepseek": "DeepSeek",
    "xai": "xAI (Grok)",
    "cohere": "Cohere",
    "openrouter": "OpenRouter",
}

def _fernet() -> Fernet:
    secret = os.getenv("PROVIDER_KEYS_FERNET_KEY") or os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET") or "raptor-local-dev-key"
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)

def mask_key(key: str) -> str:
    if len(key) <= 8: return "••••"
    return f"{key[:4]}••••••••{key[-4:]}"


def _public(record: Dict[str, Any]) -> Dict[str, Any]:
    record.pop("encrypted_key", None)
    return record

async def list_keys(user_id: str) -> List[Dict[str, Any]]:
    conn = await get_conn()
    if not conn: return []
    try:
        rows = await conn.fetch(
            """
              SELECT id, provider, key_mask, created_at, updated_at
              FROM user_provider_keys WHERE user_id=$1::uuid ORDER BY provider
            """, user_id,
        )
        return [_public(_row(r)) for r in rows]
    finally:
        await release_conn(conn)

async def upsert_key(user_id: str, provider: str, api_key: str) -> Optional[Dict[str, Any]]:
    provider = provider.lower().strip()
    if provider not in SUPPORTED_PROVIDERS or not api_key.strip(): return None
    encrypted = _fernet().encrypt(api_key.strip().encode()).decode()
    conn = await get_conn()
    if not conn: return None
    try:
        row = await conn.fetchrow(
            """
              INSERT INTO user_provider_keys(user_id, provider, encrypted_key, key_mask)
              VALUES ($1::uuid,$2,$3,$4)
              ON CONFLICT(user_id, provider) DO UPDATE
              SET encrypted_key=EXCLUDED.encrypted_key, key_mask=EXCLUDED.key_mask, updated_at=now()
              RETURNING id, provider, key_mask, created_at, updated_at
            """, user_id, provider, encrypted, mask_key(api_key.strip()),
        )
        return _public(_row(row))
    finally:
        await release_conn(conn)

async def delete_key(user_id: str, provider: str) -> bool:
    conn = await get_conn()
    if not conn: return False
    try:
        result = await conn.execute(
            "DELETE FROM user_provider_keys WHERE user_id=$1::uuid AND provider=$2",
            user_id, provider.lower(),
        )
        return result.split()[-1] != "0"
    finally:
        await release_conn(conn)

async def get_decrypted_key(user_id: str, provider: str) -> Optional[str]:
    """Fetch and decrypt a user's stored API key for a provider, or None if not configured."""
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            "SELECT encrypted_key FROM user_provider_keys WHERE user_id=$1::uuid AND provider=$2",
            user_id, provider.lower().strip(),
        )
        if not row or not row["encrypted_key"]:
            return None
        try:
            return _fernet().decrypt(row["encrypted_key"].encode()).decode()
        except Exception:
            return None
    finally:
        await release_conn(conn)


async def key_configured(user_id: str, provider: str) -> bool:
    conn = await get_conn()
    if not conn: return False
    try:
        row = await conn.fetchrow(
            "SELECT 1 FROM user_provider_keys WHERE user_id=$1::uuid AND provider=$2",
            user_id, provider.lower(),
        )
        return row is not None
    finally:
        await release_conn(conn)
