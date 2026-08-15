import time
from datetime import datetime, timezone
from fastapi import Request
from fastapi.staticfiles import StaticFiles
import sys, os

from .state import app, START_TIME
from .services.db import init_pool

# Register routers
from .auth_router import router as auth_router
from .memory_router import router as memory_router
from .router.webhook import router as webhook_router
from .analysis import router as analysis_router
from .scan_router import router as scan_router
from .reviews_router import router as reviews_router
from .telemetry_router import router as telemetry_router
from .user_router import router as user_router
from .blog_router import router as blog_router
from .team_router import router as team_router
from .repo_router import router as repo_router
from .chat_router import router as chat_router
from .calendar_router import router as calendar_router
from .sandbox_router import router as sandbox_router
from .provider_keys_router import router as provider_keys_router
from .agent_router import router as agent_router
from .task_router import router as task_router

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(blog_router)
app.include_router(team_router)
app.include_router(repo_router)
app.include_router(chat_router)
app.include_router(calendar_router)
app.include_router(sandbox_router)
app.include_router(provider_keys_router)
app.include_router(agent_router)
app.include_router(task_router)
app.include_router(memory_router, prefix="/api")
app.include_router(webhook_router)
app.include_router(analysis_router, prefix="/debug")
app.include_router(scan_router)
app.include_router(reviews_router)
app.include_router(telemetry_router)

# Serve static files — create directory if it does not exist
static_dir = os.path.join(
    sys._MEIPASS if getattr(sys, 'frozen', False) else os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
)
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.on_event("startup")
async def _startup():
    # Warm the asyncpg pool at boot instead of lazily on first request, so
    # the first real request doesn't pay pool-creation latency and so pool
    # errors surface in startup logs rather than as a 503 on someone's login.
    await init_pool()


@app.get("/health", tags=["Telemetry"])
def health_check(request: Request = None):
    return {
        "status": "operational",
        "uptime_sec": int(time.time() - START_TIME),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

