import os
import time
import logging
import contextvars
import uuid as _uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .rate_limit import RedisRateLimitMiddleware, build_rate_limit_rules

from dotenv import load_dotenv
load_dotenv()


# Application instance
app = FastAPI(
    title="Raptor AI Code Review Backend",
    description="Autonomous live GitHub integration and Gemini AST analysis engine",
    version="2.0.0",
)

configured_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]
allowed_origins = configured_origins or [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://raptor-ai.vercel.app",
    "https://raptor-ai.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "X-RateLimit-Window",
        "X-RateLimit-Policy",
        "Retry-After",
    ],
)

app.add_middleware(RedisRateLimitMiddleware, rules=build_rate_limit_rules())


# ---------- structured logging with request IDs ----------
request_id_var: "contextvars.ContextVar[str]" = contextvars.ContextVar("request_id", default="-")

class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.request_id = request_id_var.get()
        except Exception:
            record.request_id = "-"
        return True

handler = logging.StreamHandler()
fmt = logging.Formatter("%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s")
handler.setFormatter(fmt)
handler.addFilter(RequestIdFilter())
root = logging.getLogger()
root.setLevel(logging.INFO)
if not root.handlers:
    root.addHandler(handler)


@app.middleware("http")
async def add_request_id_middleware(request: Request, call_next):
    rid = request.headers.get("X-Request-Id") or _uuid.uuid4().hex
    request_id_var.set(rid)
    response = await call_next(request)
    response.headers["X-Request-Id"] = rid
    return response


# Routers are registered from main.py to avoid circular imports

# Export start time
START_TIME = time.time()


# Static demo/reference data — not written to at runtime, safe to keep
# in-process (unlike the webhook log below, this never drifts between
# instances because nothing ever mutates it).
AST_CACHE_STATS = {
    "TypeScript / JavaScript": {"version": "v5.4.2", "hits": 142, "total": 150},
    "Python": {"version": "v3.12.1", "hits": 98, "total": 106},
    "Go (Golang)": {"version": "v1.22.0", "hits": 204, "total": 210},
}

MOCK_REPOSITORIES = []

MOCK_REVIEWS = []


# ---------- webhook event log (Redis-backed, shared across instances) ----------
# Previously an in-process Python list (LIVE_WEBHOOK_LOGS), which meant each
# backend replica only ever saw the webhook events it personally handled.
# Bounded LPUSH/LTRIM list in Redis instead, so it's consistent regardless
# of which instance served the webhook or which instance later reads it.
import json as _json
from .services.redis_client import get_redis as _get_redis

WEBHOOK_LOG_KEY = "webhook_logs"
WEBHOOK_LOG_MAX = 200


def append_webhook_log(event_log) -> None:
    """Push a WebhookLogItem onto the shared, bounded Redis log."""
    payload = event_log.model_dump() if hasattr(event_log, "model_dump") else dict(event_log)
    r = _get_redis()
    r.lpush(WEBHOOK_LOG_KEY, _json.dumps(payload, default=str))
    r.ltrim(WEBHOOK_LOG_KEY, 0, WEBHOOK_LOG_MAX - 1)


def get_webhook_logs(limit: int = WEBHOOK_LOG_MAX) -> list:
    """Most-recent-first list of webhook event dicts."""
    r = _get_redis()
    raw = r.lrange(WEBHOOK_LOG_KEY, 0, limit - 1)
    return [_json.loads(item) for item in raw]
