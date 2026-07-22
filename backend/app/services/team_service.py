"""Team service — teams, members, and invitation management."""
import logging
import re
import secrets
from typing import Optional, List, Dict, Any

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug)[:80]


def _row(cur, row) -> Dict[str, Any]:
    cols = [d[0] for d in cur.description]
    d = dict(zip(cols, row))
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif hasattr(v, "hex"):          # UUID
            d[k] = str(v)
    return d


# ── Teams ─────────────────────────────────────────────────────────────────────

def create_team(owner_id: str, name: str) -> Optional[Dict[str, Any]]:
    slug = _slugify(name)
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO teams (name, slug, owner_id)
                VALUES (%s, %s, %s)
                RETURNING id, name, slug, owner_id, created_at
                """,
                (name, slug, owner_id),
            )
            team_row = cur.fetchone()
            team = _row(cur, team_row)
            # Add owner as team member with 'owner' role
            cur.execute(
                """
                INSERT INTO team_members (team_id, user_id, role)
                VALUES (%s, %s, 'owner')
                ON CONFLICT (team_id, user_id) DO NOTHING
                """,
                (team["id"], owner_id),
            )
            conn.commit()
            return team
    except Exception:
        logger.exception("[team_service] create_team failed")
        try:
            conn.rollback()
        except Exception:
            pass
        return None
    finally:
        release_conn(conn)


def get_team(team_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, slug, owner_id, created_at FROM teams WHERE id = %s",
                (team_id,),
            )
            row = cur.fetchone()
            return _row(cur, row) if row else None
    except Exception:
        logger.exception("[team_service] get_team failed")
        return None
    finally:
        release_conn(conn)


def list_user_teams(user_id: str) -> List[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT t.id, t.name, t.slug, t.owner_id, t.created_at, tm.role
                FROM teams t
                JOIN team_members tm ON tm.team_id = t.id
                WHERE tm.user_id = %s
                ORDER BY t.created_at DESC
                """,
                (user_id,),
            )
            return [_row(cur, r) for r in cur.fetchall()]
    except Exception:
        logger.exception("[team_service] list_user_teams failed")
        return []
    finally:
        release_conn(conn)


# ── Members ────────────────────────────────────────────────────────────────────

def list_members(team_id: str) -> List[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id, u.username, u.name, u.avatar_url, tm.role, tm.joined_at
                FROM team_members tm
                JOIN users u ON u.id = tm.user_id
                WHERE tm.team_id = %s
                ORDER BY tm.joined_at ASC
                """,
                (team_id,),
            )
            return [_row(cur, r) for r in cur.fetchall()]
    except Exception:
        logger.exception("[team_service] list_members failed")
        return []
    finally:
        release_conn(conn)


def get_member_role(team_id: str, user_id: str) -> Optional[str]:
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role FROM team_members WHERE team_id = %s AND user_id = %s",
                (team_id, user_id),
            )
            row = cur.fetchone()
            return row[0] if row else None
    except Exception:
        return None
    finally:
        release_conn(conn)


def add_member(team_id: str, user_id: str, role: str = "member") -> bool:
    conn = get_conn()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO team_members (team_id, user_id, role)
                VALUES (%s, %s, %s)
                ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
                """,
                (team_id, user_id, role),
            )
            conn.commit()
            return True
    except Exception:
        logger.exception("[team_service] add_member failed")
        try:
            conn.rollback()
        except Exception:
            pass
        return False
    finally:
        release_conn(conn)


def remove_member(team_id: str, user_id: str) -> bool:
    conn = get_conn()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM team_members WHERE team_id = %s AND user_id = %s",
                (team_id, user_id),
            )
            conn.commit()
            return cur.rowcount > 0
    except Exception:
        logger.exception("[team_service] remove_member failed")
        try:
            conn.rollback()
        except Exception:
            pass
        return False
    finally:
        release_conn(conn)


# ── Invitations ────────────────────────────────────────────────────────────────

def create_invitation(team_id: str, invited_by: str,
                      invitee_email: Optional[str] = None,
                      invitee_github: Optional[str] = None,
                      role: str = "member") -> Optional[Dict[str, Any]]:
    token = secrets.token_urlsafe(32)
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO team_invitations
                    (team_id, invited_by, invite_token, invitee_email, invitee_github, role)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, team_id, invite_token, invitee_email, invitee_github,
                          role, status, expires_at, created_at
                """,
                (team_id, invited_by, token, invitee_email, invitee_github, role),
            )
            conn.commit()
            row = cur.fetchone()
            return _row(cur, row) if row else None
    except Exception:
        logger.exception("[team_service] create_invitation failed")
        try:
            conn.rollback()
        except Exception:
            pass
        return None
    finally:
        release_conn(conn)


def get_invitation(token: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT i.*, t.name as team_name, u.username as invited_by_username
                FROM team_invitations i
                JOIN teams t ON t.id = i.team_id
                JOIN users u ON u.id = i.invited_by
                WHERE i.invite_token = %s
                """,
                (token,),
            )
            row = cur.fetchone()
            return _row(cur, row) if row else None
    except Exception:
        logger.exception("[team_service] get_invitation failed")
        return None
    finally:
        release_conn(conn)


def accept_invitation(token: str, user_id: str) -> bool:
    """Accept an invite: add the user to the team and mark the invite accepted."""
    inv = get_invitation(token)
    if not inv:
        return False
    if inv["status"] != "pending":
        return False
    # Check expiry
    from datetime import datetime, timezone
    expires = datetime.fromisoformat(inv["expires_at"])
    if expires < datetime.now(timezone.utc):
        _expire_invitation(token)
        return False

    conn = get_conn()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO team_members (team_id, user_id, role)
                VALUES (%s, %s, %s)
                ON CONFLICT (team_id, user_id) DO NOTHING
                """,
                (inv["team_id"], user_id, inv["role"]),
            )
            cur.execute(
                "UPDATE team_invitations SET status = 'accepted' WHERE invite_token = %s",
                (token,),
            )
            conn.commit()
            return True
    except Exception:
        logger.exception("[team_service] accept_invitation failed")
        try:
            conn.rollback()
        except Exception:
            pass
        return False
    finally:
        release_conn(conn)


def _expire_invitation(token: str) -> None:
    conn = get_conn()
    if not conn:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE team_invitations SET status = 'expired' WHERE invite_token = %s",
                (token,),
            )
            conn.commit()
    except Exception:
        pass
    finally:
        release_conn(conn)
