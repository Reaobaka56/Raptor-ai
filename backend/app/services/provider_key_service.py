"""Per-user provider API key storage with encrypted secrets."""
import base64, hashlib, os
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet
from .db import get_conn, release_conn, row_to_dict as _row

SUPPORTED_PROVIDERS = {"openai", "anthropic", "google", "gemini", "mistral", "groq"}

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

def list_keys(user_id: str) -> List[Dict[str, Any]]:
    conn=get_conn()
    if not conn: return []
    try:
        with conn.cursor() as cur:
            cur.execute("""
              SELECT id, provider, key_mask, created_at, updated_at
              FROM user_provider_keys WHERE user_id=%s::uuid ORDER BY provider
            """, (user_id,))
            return [_public(_row(cur,r)) for r in cur.fetchall()]
    finally: release_conn(conn)

def upsert_key(user_id: str, provider: str, api_key: str) -> Optional[Dict[str, Any]]:
    provider=provider.lower().strip()
    if provider not in SUPPORTED_PROVIDERS or not api_key.strip(): return None
    encrypted=_fernet().encrypt(api_key.strip().encode()).decode()
    conn=get_conn()
    if not conn: return None
    try:
        with conn.cursor() as cur:
            cur.execute("""
              INSERT INTO user_provider_keys(user_id, provider, encrypted_key, key_mask)
              VALUES (%s::uuid,%s,%s,%s)
              ON CONFLICT(user_id, provider) DO UPDATE
              SET encrypted_key=EXCLUDED.encrypted_key, key_mask=EXCLUDED.key_mask, updated_at=now()
              RETURNING id, provider, key_mask, created_at, updated_at
            """, (user_id,provider,encrypted,mask_key(api_key.strip())))
            conn.commit(); return _public(_row(cur,cur.fetchone()))
    except Exception:
        conn.rollback(); raise
    finally: release_conn(conn)

def delete_key(user_id: str, provider: str) -> bool:
    conn=get_conn()
    if not conn: return False
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_provider_keys WHERE user_id=%s::uuid AND provider=%s", (user_id, provider.lower()))
            conn.commit(); return cur.rowcount>0
    finally: release_conn(conn)

def get_decrypted_key(user_id: str, provider: str) -> Optional[str]:
    """Fetch and decrypt a user's stored API key for a provider, or None if not configured."""
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT encrypted_key FROM user_provider_keys WHERE user_id=%s::uuid AND provider=%s",
                (user_id, provider.lower().strip()),
            )
            row = cur.fetchone()
            if not row or not row[0]:
                return None
            try:
                return _fernet().decrypt(row[0].encode()).decode()
            except Exception:
                return None
    finally:
        release_conn(conn)


def key_configured(user_id: str, provider: str) -> bool:
    conn=get_conn()
    if not conn: return False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM user_provider_keys WHERE user_id=%s::uuid AND provider=%s", (user_id, provider.lower()))
            return cur.fetchone() is not None
    finally: release_conn(conn)
