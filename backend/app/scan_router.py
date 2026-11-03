from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from .models import ScanRequest, Review
from .auth_dependencies import get_required_github_session, get_current_user

router = APIRouter(prefix="/api", tags=["Scanning"])


@router.post("/scan", response_model=Review)
async def scan_repository(
    req: ScanRequest,
    session: Optional[dict] = Depends(get_required_github_session),
):
    try:
        from .services.scan_service import run_scan
        github_token = session["access_token"] if session else None
        user = await get_current_user(session) if session else None
        review = await run_scan(
            req.repo, github_token=github_token,
            owner_user_id=user["id"] if user else None,
        )
        return review
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Repository scan failed: {exc}") from exc
