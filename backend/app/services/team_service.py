"""Team service — teams, members, and invitation management."""
import logging
import re
import secrets
from typing import Optional, List, Dict, Any

from .db import get_conn, release_conn, row_to_dict as _row

logger = logging.getLogger(__name__)


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug)[:80]


# ── Teams ─────────────────────────────────────────────────────────────────────

async def create_team(owner_id: str, name: str) -> Optional[Dict[str, Any]]:
    slug = _slugify(name)
    conn = await get_conn()
    if not conn:
        return None
    try:
        async with conn.transaction():
            team_row = await conn.fetchrow(
                """
                INSERT INTO teams (name, slug, owner_id)
                VALUES ($1, $2, $3)
                RETURNING id, name, slug, owner_id, created_at
                """,
                name, slug, owner_id,
            )
            team = _row(team_row)
            # Add owner as team member with 'owner' role
            await conn.execute(
                """
                INSERT INTO team_members (team_id, user_id, role)
                VALUES ($1, $2, 'owner')
                ON CONFLICT (team_id, user_id) DO NOTHING
                """,
                team["id"], owner_id,
            )
            return team
    except Exception:
        logger.exception("[team_service] create_team failed")
        return None
    finally:
        await release_conn(conn)


async def get_team(team_id: str) -> Optional[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            "SELECT id, name, slug, owner_id, join_token_hash, join_token_created_at, created_at "
            "FROM teams WHERE id::text = $1",
            team_id,
        )
        return _row(row) if row else None
    except Exception:
        logger.exception("[team_service] get_team failed")
        return None
    finally:
        await release_conn(conn)


async def delete_team(team_id: str) -> bool:
    conn = await get_conn()
    if not conn:
        return False
    try:
        result = await conn.execute("DELETE FROM teams WHERE id::text = $1", team_id)
        # asyncpg command tags look like "DELETE <n>"
        return result.split()[-1] != "0"
    except Exception:
        logger.exception("[team_service] delete_team failed")
        return False
    finally:
        await release_conn(conn)


async def list_user_teams(user_id: str) -> List[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return []
    try:
        rows = await conn.fetch(
            """
            SELECT t.id, t.name, t.slug, t.owner_id, t.created_at, tm.role
            FROM teams t
            JOIN team_members tm ON tm.team_id = t.id
            WHERE tm.user_id::text = $1
            ORDER BY t.created_at DESC
            """,
            user_id,
        )
        return [_row(r) for r in rows]
    except Exception:
        logger.exception("[team_service] list_user_teams failed")
        return []
    finally:
        await release_conn(conn)


# ── Members ────────────────────────────────────────────────────────────────────

async def list_members(team_id: str) -> List[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return []
    try:
        rows = await conn.fetch(
            """
            SELECT u.id, u.username, u.name, u.avatar_url, tm.role, tm.joined_at
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id::text = $1
            ORDER BY tm.joined_at ASC
            """,
            team_id,
        )
        return [_row(r) for r in rows]
    except Exception:
        logger.exception("[team_service] list_members failed")
        return []
    finally:
        await release_conn(conn)


async def get_member_role(team_id: str, user_id: str) -> Optional[str]:
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            "SELECT role FROM team_members WHERE team_id::text = $1 AND user_id::text = $2",
            team_id, user_id,
        )
        return row["role"] if row else None
    except Exception:
        return None
    finally:
        await release_conn(conn)


async def add_member(team_id: str, user_id: str, role: str = "member") -> bool:
    conn = await get_conn()
    if not conn:
        return False
    try:
        await conn.execute(
            """
            INSERT INTO team_members (team_id, user_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
            """,
            team_id, user_id, role,
        )
        return True
    except Exception:
        logger.exception("[team_service] add_member failed")
        return False
    finally:
        await release_conn(conn)


async def remove_member(team_id: str, user_id: str) -> bool:
    conn = await get_conn()
    if not conn:
        return False
    try:
        result = await conn.execute(
            "DELETE FROM team_members WHERE team_id::text = $1 AND user_id::text = $2",
            team_id, user_id,
        )
        return result.split()[-1] != "0"
    except Exception:
        logger.exception("[team_service] remove_member failed")
        return False
    finally:
        await release_conn(conn)


# ── Invitations ────────────────────────────────────────────────────────────────

async def create_invitation(team_id: str, invited_by: str,
                             invitee_email: Optional[str] = None,
                             invitee_github: Optional[str] = None,
                             role: str = "member") -> Optional[Dict[str, Any]]:
    token = secrets.token_urlsafe(32)
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO team_invitations
                (team_id, invited_by, invite_token, invitee_email, invitee_github, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, team_id, invite_token, invitee_email, invitee_github,
                      role, status, expires_at, created_at
            """,
            team_id, invited_by, token, invitee_email, invitee_github, role,
        )
        return _row(row) if row else None
    except Exception:
        logger.exception("[team_service] create_invitation failed")
        return None
    finally:
        await release_conn(conn)


async def get_invitation(token: str) -> Optional[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            """
            SELECT i.*, t.name as team_name, u.username as invited_by_username
            FROM team_invitations i
            JOIN teams t ON t.id = i.team_id
            JOIN users u ON u.id = i.invited_by
            WHERE i.invite_token = $1
            """,
            token,
        )
        return _row(row) if row else None
    except Exception:
        logger.exception("[team_service] get_invitation failed")
        return None
    finally:
        await release_conn(conn)


async def accept_invitation(token: str, user_id: str) -> bool:
    """Accept an invite: add the user to the team and mark the invite accepted."""
    inv = await get_invitation(token)
    if not inv:
        return False
    if inv["status"] != "pending":
        return False
    # Check expiry
    from datetime import datetime, timezone
    expires = datetime.fromisoformat(inv["expires_at"])
    if expires < datetime.now(timezone.utc):
        await _expire_invitation(token)
        return False

    conn = await get_conn()
    if not conn:
        return False
    try:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO team_members (team_id, user_id, role)
                VALUES ($1, $2, $3)
                ON CONFLICT (team_id, user_id) DO NOTHING
                """,
                inv["team_id"], user_id, inv["role"],
            )
            await conn.execute(
                "UPDATE team_invitations SET status = 'accepted' WHERE invite_token = $1",
                token,
            )
        return True
    except Exception:
        logger.exception("[team_service] accept_invitation failed")
        return False
    finally:
        await release_conn(conn)


async def _expire_invitation(token: str) -> None:
    conn = await get_conn()
    if not conn:
        return
    try:
        await conn.execute(
            "UPDATE team_invitations SET status = 'expired' WHERE invite_token = $1",
            token,
        )
    except Exception:
        pass
    finally:
        await release_conn(conn)


# ── Join tokens ───────────────────────────────────────────────────────────────

def _hash_join_token(token: str) -> str:
    import hashlib
    return hashlib.sha256(token.upper().strip().encode()).hexdigest()


def generate_join_token() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    part = lambda: "".join(secrets.choice(alphabet) for _ in range(4))
    return f"TEAM-{part()}-{part()}"


async def ensure_join_token(team_id: str) -> Optional[str]:
    """Generate and return a new plaintext join token for leader display."""
    conn = await get_conn()
    if not conn:
        return None
    try:
        for _ in range(8):
            token = generate_join_token()
            try:
                row = await conn.fetchrow(
                    "UPDATE teams SET join_token_hash=$1, join_token_created_at=now() "
                    "WHERE id::text=$2 RETURNING id",
                    _hash_join_token(token), team_id,
                )
                if row:
                    return token
            except Exception:
                logger.exception("[team_service] ensure_join_token attempt failed")
        return None
    finally:
        await release_conn(conn)


class AlreadyTeamMemberError(Exception):
    """Raised when a user tries to join a team via token they're already a member of."""


async def join_team_by_token(user_id: str, token: str) -> Optional[Dict[str, Any]]:
    """Join a team by its plaintext join token. Raises AlreadyTeamMemberError if the
    user is already a member of the target team; returns None if the token is invalid."""
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            "SELECT id FROM teams WHERE join_token_hash=$1", _hash_join_token(token),
        )
        if not row:
            return None
        team_id = row["id"]

        async with conn.transaction():
            existing = await conn.fetchrow(
                "SELECT id FROM team_members WHERE team_id = $1 AND user_id::text = $2",
                team_id, user_id,
            )
            if existing:
                raise AlreadyTeamMemberError()

            await conn.execute(
                """
                INSERT INTO team_members(team_id, user_id, role)
                VALUES($1, $2, 'member')
                ON CONFLICT(team_id, user_id) DO NOTHING
                """,
                team_id, user_id,
            )
        return await get_team(str(team_id))
    except AlreadyTeamMemberError:
        raise
    except Exception:
        logger.exception("[team_service] join_team_by_token failed")
        return None
    finally:
        await release_conn(conn)
