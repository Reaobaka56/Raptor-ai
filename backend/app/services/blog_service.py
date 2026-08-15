"""Blog service — CRUD for blog_posts table."""
import logging
import re
from typing import Optional, List, Dict, Any

from .db import get_conn, release_conn, row_to_dict as _row_to_dict

logger = logging.getLogger(__name__)


def _slugify(title: str) -> str:
    slug = title.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:120]


async def list_posts(published_only: bool = True) -> List[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return []
    try:
        if published_only:
            rows = await conn.fetch(
                """
                SELECT p.*, u.username as author_username, u.avatar_url as author_avatar
                FROM blog_posts p
                LEFT JOIN users u ON u.id = p.author_id
                WHERE p.published = TRUE
                ORDER BY p.published_at DESC
                """
            )
        else:
            rows = await conn.fetch(
                """
                SELECT p.*, u.username as author_username, u.avatar_url as author_avatar
                FROM blog_posts p
                LEFT JOIN users u ON u.id = p.author_id
                ORDER BY p.created_at DESC
                """
            )
        return [_row_to_dict(r) for r in rows]
    except Exception:
        logger.exception("[blog_service] list_posts failed")
        return []
    finally:
        await release_conn(conn)


async def get_post(slug: str, published_only: bool = True) -> Optional[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return None
    try:
        query = """
            SELECT p.*, u.username as author_username, u.avatar_url as author_avatar
            FROM blog_posts p
            LEFT JOIN users u ON u.id = p.author_id
            WHERE p.slug = $1
        """
        if published_only:
            query += " AND p.published = TRUE"
        row = await conn.fetchrow(query, slug)
        return _row_to_dict(row) if row else None
    except Exception:
        logger.exception("[blog_service] get_post failed for slug %s", slug)
        return None
    finally:
        await release_conn(conn)


async def create_post(author_id: str, title: str, summary: Optional[str],
                       content: str, category: str, featured_image: Optional[str],
                       published: bool) -> Optional[Dict[str, Any]]:
    slug = _slugify(title)
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO blog_posts
                (author_id, slug, title, summary, content, category, featured_image,
                 published, published_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                    CASE WHEN $8 THEN now() ELSE NULL END)
            RETURNING *
            """,
            author_id, slug, title, summary, content, category,
            featured_image, published,
        )
        return _row_to_dict(row) if row else None
    except Exception:
        logger.exception("[blog_service] create_post failed")
        return None
    finally:
        await release_conn(conn)


async def update_post(slug: str, **fields) -> Optional[Dict[str, Any]]:
    allowed = {"title", "summary", "content", "category", "featured_image", "published"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return await get_post(slug, published_only=False)

    conn = await get_conn()
    if not conn:
        return None
    try:
        values = list(updates.values())
        set_clauses = ", ".join(f"{k} = ${i+1}" for i, k in enumerate(updates))
        set_clauses += ", updated_at = now()"
        # Auto-set published_at when publishing for the first time
        if updates.get("published"):
            set_clauses += ", published_at = COALESCE(published_at, now())"
        values.append(slug)
        slug_idx = len(values)

        row = await conn.fetchrow(
            f"""
            UPDATE blog_posts SET {set_clauses}
            WHERE slug = ${slug_idx}
            RETURNING *
            """,
            *values,
        )
        return _row_to_dict(row) if row else None
    except Exception:
        logger.exception("[blog_service] update_post failed for slug %s", slug)
        return None
    finally:
        await release_conn(conn)


async def delete_post(slug: str) -> bool:
    conn = await get_conn()
    if not conn:
        return False
    try:
        result = await conn.execute("DELETE FROM blog_posts WHERE slug = $1", slug)
        return result.split()[-1] != "0"
    except Exception:
        logger.exception("[blog_service] delete_post failed for slug %s", slug)
        return False
    finally:
        await release_conn(conn)
