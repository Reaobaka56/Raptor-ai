import os
import redis
import redis.asyncio as aioredis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Sync client: kept for non-request code paths only. Do NOT call it from async
# handlers/middleware - it blocks the event loop. Use get_async_redis().
_redis = redis.from_url(REDIS_URL, decode_responses=True)
_async_redis = aioredis.from_url(
    REDIS_URL, decode_responses=True,
    socket_connect_timeout=1.0, socket_timeout=1.0,   # fail fast, never hang a request
    max_connections=int(os.getenv("REDIS_MAX_CONNECTIONS", "50")),
)


def get_redis() -> redis.Redis:
    return _redis


def get_async_redis() -> aioredis.Redis:
    return _async_redis
