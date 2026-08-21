"""
Blog router — public read + admin-only CRUD.

Admin guard: only the session whose username == 'reaobaka56' (or role == 'admin'
in the users table) may create / update / delete posts.
"""
import logging
import os
import uuid
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from .auth_dependencies import get_required_github_session, get_optional_github_session
from .services.user_service import is_admin, get_user_by_username
from .services.blog_service import (
    list_posts, get_post, create_post, update_post, delete_post
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/blog", tags=["Blog"])

# ── Media upload ──────────────────────────────────────────────────────────────
# Uses the same /static mount main.py already serves (backend/static/) rather
# than standing up a separate storage system. NOTE: on most Render plans this
# disk is ephemeral (wiped on redeploy) — fine for now, but if that becomes a
# problem the fix is swapping this for S3/Cloudinary without touching the
# blog_posts.media schema or the frontend.
_STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
_MEDIA_DIR = os.path.join(_STATIC_DIR, "blog-media")
_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
_VIDEO_EXTS = {".mp4", ".webm", ".mov"}
_MAX_IMAGE_BYTES = 8 * 1024 * 1024
_MAX_VIDEO_BYTES = 50 * 1024 * 1024


class MediaItem(BaseModel):
    url: str
    type: str  # 'image' | 'video'
    filename: str


class PostCreate(BaseModel):
    title: str
    summary: Optional[str] = None
    content: str = ""
    category: str = "Engineering"
    featured_image: Optional[str] = None
    published: bool = False
    media: List[MediaItem] = []


class PostUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    featured_image: Optional[str] = None
    published: Optional[bool] = None
    media: Optional[List[MediaItem]] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _require_admin(session: Dict[str, Any]) -> Dict[str, Any]:
    username = session.get("user", {}).get("username", "")
    if not await is_admin(username):
        raise HTTPException(status_code=403, detail="Admin access required")
    return session


async def _get_author_id(username: str) -> str:
    user = await get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="Author user record not found — log in first")
    return user["id"]


# ── Media endpoint (admin only) ────────────────────────────────────────────────

@router.post("/media")
async def upload_media(file: UploadFile = File(...),
                        session: Dict[str, Any] = Depends(get_required_github_session)):
    await _require_admin(session)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext in _IMAGE_EXTS:
        media_type, max_bytes = "image", _MAX_IMAGE_BYTES
    elif ext in _VIDEO_EXTS:
        media_type, max_bytes = "video", _MAX_VIDEO_BYTES
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: images (png/jpg/jpeg/gif/webp) and video (mp4/webm/mov).")

    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File too large — max {max_bytes // (1024*1024)}MB for {media_type}s")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    os.makedirs(_MEDIA_DIR, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(_MEDIA_DIR, safe_name)
    try:
        with open(dest_path, "wb") as f:
            f.write(contents)
    except Exception:
        logger.exception("[blog_router] failed to write uploaded media")
        raise HTTPException(status_code=500, detail="Failed to store uploaded file")

    return {"url": f"/static/blog-media/{safe_name}", "type": media_type, "filename": file.filename}


# ── Public endpoints ───────────────────────────────────────────────────────────

@router.get("")
async def get_posts(session: Optional[Dict[str, Any]] = Depends(get_optional_github_session)):
    """
    Public: returns published posts only.
    Admin sees all posts (including drafts).
    """
    username = (session or {}).get("user", {}).get("username", "")
    published_only = not await is_admin(username)
    return await list_posts(published_only=published_only)


@router.get("/{slug}")
async def get_single_post(slug: str,
                           session: Optional[Dict[str, Any]] = Depends(get_optional_github_session)):
    username = (session or {}).get("user", {}).get("username", "")
    published_only = not await is_admin(username)
    post = await get_post(slug, published_only=published_only)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create(body: PostCreate,
                  session: Dict[str, Any] = Depends(get_required_github_session)):
    await _require_admin(session)
    username = session["user"]["username"]
    author_id = await _get_author_id(username)
    post = await create_post(
        author_id=author_id,
        title=body.title,
        summary=body.summary,
        content=body.content,
        category=body.category,
        featured_image=body.featured_image,
        published=body.published,
        media=[m.model_dump() for m in body.media],
    )
    if not post:
        raise HTTPException(status_code=500, detail="Failed to create post")
    return post


@router.patch("/{slug}")
async def update(slug: str, body: PostUpdate,
                  session: Dict[str, Any] = Depends(get_required_github_session)):
    await _require_admin(session)
    fields = body.model_dump(exclude_none=True)
    if "media" in fields:
        fields["media"] = [m if isinstance(m, dict) else m for m in fields["media"]]
    post = await update_post(slug, **fields)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found or update failed")
    return post


@router.delete("/{slug}", status_code=204)
async def delete(slug: str,
                  session: Dict[str, Any] = Depends(get_required_github_session)):
    await _require_admin(session)
    if not await delete_post(slug):
        raise HTTPException(status_code=404, detail="Post not found")
