import os
import json
from typing import Optional, Dict, Any

import redis

SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "3600"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

_redis = redis.from_url(REDIS_URL, decode_responses=True)


def save_session(token: str, session: Dict[str, Any]) -> None:
    """Save session as JSON with TTL."""
    _redis.setex(f"session:{token}", SESSION_TTL_SECONDS, json.dumps(session, default=str))


def get_session(token: str) -> Optional[Dict[str, Any]]:
    data = _redis.get(f"session:{token}")
    if not data:
        return None
    try:
        return json.loads(data)
    except Exception:
        return None


def delete_session(token: str) -> None:
    _redis.delete(f"session:{token}")


def refresh_session(token: str) -> None:
    _redis.expire(f"session:{token}", SESSION_TTL_SECONDS)
