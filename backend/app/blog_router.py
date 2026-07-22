"""
Blog router — public read + admin-only CRUD.

Admin guard: only the session whose username == 'reaobaka56' (or role == 'admin'
in the users table) may create / update / delete posts.
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth_dependencies import get_required_github_session, get_optional_github_session
from .services.user_service import is_admin, get_user_by_username
from .services.blog_service import (
    list_posts, get_post, create_post, update_post, delete_post
)

router = APIRouter(prefix="/api/blog", tags=["Blog"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _require_admin(session: Dict[str, Any]) -> Dict[str, Any]:
    username = session.get("user", {}).get("username", "")
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Admin access required")
    return session


def _get_author_id(username: str) -> str:
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="Author user record not found — log in first")
    return user["id"]


# ── Request schemas ────────────────────────────────────────────────────────────

class PostCreate(BaseModel):
    title: str
    summary: Optional[str] = None
    content: str = ""
    category: str = "Engineering"
    featured_image: Optional[str] = None
    published: bool = False


class PostUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    featured_image: Optional[str] = None
    published: Optional[bool] = None


# ── Public endpoints ───────────────────────────────────────────────────────────

@router.get("")
def get_posts(session: Optional[Dict[str, Any]] = Depends(get_optional_github_session)):
    """
    Public: returns published posts only.
    Admin sees all posts (including drafts).
    """
    username = (session or {}).get("user", {}).get("username", "")
    published_only = not is_admin(username)
    return list_posts(published_only=published_only)


@router.get("/{slug}")
def get_single_post(slug: str,
                    session: Optional[Dict[str, Any]] = Depends(get_optional_github_session)):
    username = (session or {}).get("user", {}).get("username", "")
    published_only = not is_admin(username)
    post = get_post(slug, published_only=published_only)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create(body: PostCreate,
           session: Dict[str, Any] = Depends(get_required_github_session)):
    _require_admin(session)
    username = session["user"]["username"]
    author_id = _get_author_id(username)
    post = create_post(
        author_id=author_id,
        title=body.title,
        summary=body.summary,
        content=body.content,
        category=body.category,
        featured_image=body.featured_image,
        published=body.published,
    )
    if not post:
        raise HTTPException(status_code=500, detail="Failed to create post")
    return post


@router.patch("/{slug}")
def update(slug: str, body: PostUpdate,
           session: Dict[str, Any] = Depends(get_required_github_session)):
    _require_admin(session)
    post = update_post(slug, **body.model_dump(exclude_none=True))
    if not post:
        raise HTTPException(status_code=404, detail="Post not found or update failed")
    return post


@router.delete("/{slug}", status_code=204)
def delete(slug: str,
           session: Dict[str, Any] = Depends(get_required_github_session)):
    _require_admin(session)
    if not delete_post(slug):
        raise HTTPException(status_code=404, detail="Post not found")
