"""Blog service — CRUD for blog_posts table."""
import logging
import re
from typing import Optional, List, Dict, Any

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)


def _slugify(title: str) -> str:
    slug = title.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:120]


def _row_to_dict(cur, row) -> Dict[str, Any]:
    cols = [d[0] for d in cur.description]
    post = dict(zip(cols, row))
    post["id"] = str(post["id"])
    post["author_id"] = str(post["author_id"]) if post.get("author_id") else None
    for ts in ("created_at", "updated_at", "published_at"):
        if post.get(ts):
            post[ts] = post[ts].isoformat()
    return post


def list_posts(published_only: bool = True) -> List[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            if published_only:
                cur.execute(
                    """
                    SELECT p.*, u.username as author_username, u.avatar_url as author_avatar
                    FROM blog_posts p
                    LEFT JOIN users u ON u.id = p.author_id
                    WHERE p.published = TRUE
                    ORDER BY p.published_at DESC
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT p.*, u.username as author_username, u.avatar_url as author_avatar
                    FROM blog_posts p
                    LEFT JOIN users u ON u.id = p.author_id
                    ORDER BY p.created_at DESC
                    """
                )
            rows = cur.fetchall()
            return [_row_to_dict(cur, r) for r in rows]
    except Exception:
        logger.exception("[blog_service] list_posts failed")
        return []
    finally:
        release_conn(conn)


def get_post(slug: str, published_only: bool = True) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            query = """
                SELECT p.*, u.username as author_username, u.avatar_url as author_avatar
                FROM blog_posts p
                LEFT JOIN users u ON u.id = p.author_id
                WHERE p.slug = %s
            """
            params = [slug]
            if published_only:
                query += " AND p.published = TRUE"
            cur.execute(query, params)
            row = cur.fetchone()
            return _row_to_dict(cur, row) if row else None
    except Exception:
        logger.exception("[blog_service] get_post failed for slug %s", slug)
        return None
    finally:
        release_conn(conn)


def create_post(author_id: str, title: str, summary: Optional[str],
                content: str, category: str, featured_image: Optional[str],
                published: bool) -> Optional[Dict[str, Any]]:
    slug = _slugify(title)
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO blog_posts
                    (author_id, slug, title, summary, content, category, featured_image,
                     published, published_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                        CASE WHEN %s THEN now() ELSE NULL END)
                RETURNING *
                """,
                (author_id, slug, title, summary, content, category,
                 featured_image, published, published),
            )
            conn.commit()
            row = cur.fetchone()
            return _row_to_dict(cur, row) if row else None
    except Exception:
        logger.exception("[blog_service] create_post failed")
        try:
            conn.rollback()
        except Exception:
            pass
        return None
    finally:
        release_conn(conn)


def update_post(slug: str, **fields) -> Optional[Dict[str, Any]]:
    allowed = {"title", "summary", "content", "category", "featured_image", "published"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_post(slug, published_only=False)

    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            set_clauses = ", ".join(f"{k} = %s" for k in updates)
            set_clauses += ", updated_at = now()"
            # Auto-set published_at when publishing for the first time
            if updates.get("published"):
                set_clauses += ", published_at = COALESCE(published_at, now())"
            values = list(updates.values()) + [slug]
            cur.execute(
                f"""
                UPDATE blog_posts SET {set_clauses}
                WHERE slug = %s
                RETURNING *
                """,
                values,
            )
            conn.commit()
            row = cur.fetchone()
            return _row_to_dict(cur, row) if row else None
    except Exception:
        logger.exception("[blog_service] update_post failed for slug %s", slug)
        try:
            conn.rollback()
        except Exception:
            pass
        return None
    finally:
        release_conn(conn)


def delete_post(slug: str) -> bool:
    conn = get_conn()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM blog_posts WHERE slug = %s", (slug,))
            conn.commit()
            return cur.rowcount > 0
    except Exception:
        logger.exception("[blog_service] delete_post failed for slug %s", slug)
        try:
            conn.rollback()
        except Exception:
            pass
        return False
    finally:
        release_conn(conn)
