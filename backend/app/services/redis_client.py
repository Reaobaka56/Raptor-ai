import os
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Single shared connection pool for the process. Reused by session_store,
# rate_limit, and anything else that needs Redis, instead of each module
# opening its own client.
_redis = redis.from_url(REDIS_URL, decode_responses=True)


def get_redis() -> redis.Redis:
    return _redis
