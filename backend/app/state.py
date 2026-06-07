import os
import time
import logging
import contextvars
import uuid as _uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .rate_limit import InMemoryRateLimitMiddleware, build_rate_limit_rules

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

app.add_middleware(InMemoryRateLimitMiddleware, rules=build_rate_limit_rules())


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
