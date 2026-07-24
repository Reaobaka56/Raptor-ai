import time
from datetime import datetime, timezone
from fastapi import Request
from fastapi.staticfiles import StaticFiles
import sys, os

from .state import app, START_TIME

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

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(blog_router)
app.include_router(team_router)
app.include_router(repo_router)
app.include_router(memory_router, prefix="/api")
app.include_router(webhook_router)
app.include_router(analysis_router, prefix="/debug")
app.include_router(scan_router)
app.include_router(reviews_router)
app.include_router(telemetry_router)

# Serve static files (frontend) bundled with PyInstaller
static_dir = os.path.join(
    sys._MEIPASS if getattr(sys, 'frozen', False) else os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
)
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")



@app.get("/health", tags=["Telemetry"])
def health_check(request: Request = None):
    return {
        "status": "operational",
        "uptime_sec": int(time.time() - START_TIME),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
