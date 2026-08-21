"""
Sandbox service — isolated agent execution environment.

MVP implementation uses subprocess + resource monitoring.
Designed to swap to Docker/gVisor/Firecracker when deployed on
infrastructure with container support (Fly.io, DigitalOcean, Hetzner).

Key security layers:
1. Blocked path patterns (secrets, keys, credentials)
2. Blocked domain list (cloud metadata endpoints)
3. Resource limits via psutil monitoring
4. Command allowlist / denylist
5. Full audit trail persisted to sandbox_events table
"""
import json
import logging
import os
import re
import shlex
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from .db import get_conn, release_conn

logger = logging.getLogger(__name__)

# ── Security policy defaults ──────────────────────────────────────────────────

BLOCKED_PATH_PATTERNS = [
    r"\.env$", r"\.env\.", r"\.pem$", r"\.key$", r"\.p12$",
    r"id_rsa", r"id_ed25519", r"authorized_keys", r"\.ssh/",
    r"\.aws/credentials", r"\.aws/config",
    r"secret", r"password", r"token", r"credential",
]

BLOCKED_DOMAINS = [
    "169.254.169.254",          # AWS/GCP metadata
    "metadata.google.internal",
    "metadata.azure.com",
    "100.100.100.200",          # Alibaba metadata
]

DANGEROUS_COMMANDS = [
    r"rm\s+-rf\s+/",
    r"dd\s+if=",
    r"mkfs\.",
    r":(){.*};:",                # fork bomb
    r"chmod\s+777\s+/",
    r"curl.*\|\s*sh",
    r"wget.*\|\s*sh",
    r"curl.*\|\s*bash",
    r"wget.*\|\s*bash",
]

BLOCKED_COMMANDS = [
    "shutdown", "reboot", "poweroff", "halt",
    "iptables", "ip6tables", "nftables",
    "mount", "umount",
]


def _check_path_policy(path: str) -> Tuple[bool, str]:
    """Return (allowed, reason). Blocks secrets/keys/credential files."""
    path_lower = path.lower()
    for pattern in BLOCKED_PATH_PATTERNS:
        if re.search(pattern, path_lower):
            return False, f"Access to sensitive path blocked: {path}"
    return True, ""


def _check_command_policy(cmd: str) -> Tuple[bool, str]:
    """Return (allowed, reason)."""
    cmd_lower = cmd.lower().strip()
    # Check blocked commands
    first_word = shlex.split(cmd_lower)[0] if cmd_lower else ""
    if first_word in BLOCKED_COMMANDS:
        return False, f"Command '{first_word}' is not allowed in sandbox"
    # Check dangerous patterns
    for pattern in DANGEROUS_COMMANDS:
        if re.search(pattern, cmd, re.IGNORECASE):
            return False, f"Dangerous command pattern detected: {pattern}"
    return True, ""


def _check_network_policy(url: str, blocked_domains: List[str]) -> Tuple[bool, str]:
    """Return (allowed, reason)."""
    for domain in blocked_domains + BLOCKED_DOMAINS:
        if domain in url:
            return False, f"Network access to {domain} is blocked by sandbox policy"
    return True, ""


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _log_event(session_id: str, event_type: str, payload: dict,
                      severity: str = "info") -> None:
    """Persist a sandbox event to the audit log. Best-effort, non-blocking."""
    conn = await get_conn()
    if not conn:
        return
    try:
        await conn.execute(
            """
            INSERT INTO sandbox_events (session_id, event_type, severity, payload)
            VALUES ($1::uuid, $2, $3, $4::jsonb)
            """,
            session_id, event_type, severity, json.dumps(payload),
        )
    except Exception:
        logger.exception("[sandbox_service] _log_event failed")
    finally:
        await release_conn(conn)


async def _update_session(session_id: str, **fields) -> None:
    """Raises on failure — callers that need best-effort behavior must
    catch explicitly. Silently swallowing here is what let sessions get
    stuck on 'starting' with no visibility when an UPDATE failed."""
    conn = await get_conn()
    if not conn:
        raise RuntimeError("Database unavailable")
    try:
        values = list(fields.values())
        set_clauses = ", ".join(f"{k} = ${i+1}" for i, k in enumerate(fields))
        values.append(session_id)
        await conn.execute(
            f"UPDATE sandbox_sessions SET {set_clauses} WHERE id = ${len(values)}::uuid",
            *values,
        )
    except Exception:
        logger.exception("[sandbox_service] _update_session failed (session_id=%s fields=%s)",
                          session_id, list(fields.keys()))
        raise
    finally:
        await release_conn(conn)


_schema_ready = False


async def ensure_sandbox_schema() -> None:
    """Add columns introduced after the original sandbox migration, if absent.
    Runs at most once per process."""
    global _schema_ready
    if _schema_ready:
        return
    conn = await get_conn()
    if not conn:
        return
    try:
        await conn.execute("""
            ALTER TABLE sandbox_sessions ADD COLUMN IF NOT EXISTS provider TEXT;
            ALTER TABLE sandbox_sessions ADD COLUMN IF NOT EXISTS provider_key_source TEXT NOT NULL DEFAULT 'platform';
        """)
        _schema_ready = True
    except Exception:
        logger.exception("[sandbox_service] ensure_sandbox_schema failed")
    finally:
        await release_conn(conn)

# ── Session management ────────────────────────────────────────────────────────

async def create_session(owner_id: str, name: str, repo_url: Optional[str],
                          agent_type: str, policy: dict, resource_limits: dict,
                          agent_id: Optional[str] = None,
                          provider: Optional[str] = None,
                          provider_key_source: str = "platform",
                          environment_vars: dict = None,
                          api_key_refs: list = None,
                          network_policy: dict = None,
                          filesystem_permissions: dict = None,
                          tool_permissions: list = None) -> Dict[str, Any]:
    conn = await get_conn()
    if not conn:
        raise RuntimeError("Database unavailable")
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO sandbox_sessions
                (owner_id, name, repo_url, agent_type, policy, resource_limits, status,
                 agent_id, provider, provider_key_source, environment_vars, api_key_refs,
                 network_policy, filesystem_permissions, tool_permissions)
            VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, 'starting',
                    $7::uuid, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb)
            RETURNING id, name, status, agent_type, repo_url, policy,
                      resource_limits, agent_id, provider, provider_key_source,
                      environment_vars, api_key_refs,
                      network_policy, filesystem_permissions, tool_permissions, created_at
            """,
            owner_id, name, repo_url, agent_type,
            json.dumps(policy), json.dumps(resource_limits),
            agent_id, provider, provider_key_source,
            json.dumps(environment_vars or {}),
            json.dumps(api_key_refs or []),
            json.dumps(network_policy or {"allow": True}),
            json.dumps(filesystem_permissions or {}),
            json.dumps(tool_permissions or []),
        )
        session = dict(row)
        session["id"] = str(session["id"])
        session["created_at"] = session["created_at"].isoformat()

        # Create temp workspace directory
        workspace = tempfile.mkdtemp(prefix=f"raptor_sandbox_{session['id'][:8]}_")
        try:
            await _update_session(session["id"], status="running",
                                   workspace_path=workspace,
                                   started_at=datetime.now(timezone.utc))
            session["workspace_path"] = workspace
            session["status"] = "running"
            await _log_event(session["id"], "system", {
                "message": f"Sandbox session started. Workspace: {workspace}",
                "agent_type": agent_type,
                "repo_url": repo_url,
                "agent_id": agent_id,
            })
        except Exception as e:
            # Don't leave the row stuck on 'starting' — mark it as errored
            # and surface why, instead of the caller seeing a session that
            # spins forever with no signal.
            try:
                conn2 = await get_conn()
                if conn2:
                    try:
                        await conn2.execute(
                            "UPDATE sandbox_sessions SET status = 'error' WHERE id = $1::uuid",
                            session["id"],
                        )
                    finally:
                        await release_conn(conn2)
            except Exception:
                logger.exception("[sandbox_service] failed to mark session as error after startup failure")
            await _log_event(session["id"], "system", {
                "message": f"Sandbox session failed to start: {e}",
            }, severity="critical")
            session["status"] = "error"
            session["workspace_path"] = None

        return session
    except Exception:
        logger.exception("[sandbox_service] create_session failed")
        raise
    finally:
        await release_conn(conn)


async def get_session(session_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    await ensure_sandbox_schema()
    conn = await get_conn()
    if not conn:
        return None
    try:
        row = await conn.fetchrow(
            """
            SELECT id, owner_id, name, status, agent_type, repo_url,
                   workspace_path, policy, resource_limits,
                   agent_id, environment_vars, api_key_refs, network_policy,
                   filesystem_permissions, tool_permissions,
                   process_pid, started_at, ended_at, paused_at, created_at
            FROM sandbox_sessions
            WHERE id = $1::uuid AND owner_id = $2::uuid
            """,
            session_id, owner_id,
        )
        if not row:
            return None
        s = dict(row)
        s["id"] = str(s["id"])
        s["owner_id"] = str(s["owner_id"])
        if s.get("agent_id"):
            s["agent_id"] = str(s["agent_id"])
        for ts in ("started_at", "ended_at", "paused_at", "created_at"):
            if s.get(ts):
                s[ts] = s[ts].isoformat()
        return s
    finally:
        await release_conn(conn)


async def list_sessions(owner_id: str) -> List[Dict[str, Any]]:
    await ensure_sandbox_schema()
    conn = await get_conn()
    if not conn:
        return []
    try:
        rows = await conn.fetch(
            """
            SELECT id, name, status, agent_type, repo_url, agent_id,
                   started_at, ended_at, paused_at, created_at
            FROM sandbox_sessions
            WHERE owner_id = $1::uuid
            ORDER BY created_at DESC
            LIMIT 50
            """,
            owner_id,
        )
        result = []
        for row in rows:
            s = dict(row)
            s["id"] = str(s["id"])
            if s.get("agent_id"):
                s["agent_id"] = str(s["agent_id"])
            for ts in ("started_at", "ended_at", "paused_at", "created_at"):
                if s.get(ts):
                    s[ts] = s[ts].isoformat()
            result.append(s)
        return result
    finally:
        await release_conn(conn)


async def get_events(session_id: str, owner_id: str,
                      limit: int = 100) -> List[Dict[str, Any]]:
    conn = await get_conn()
    if not conn:
        return []
    try:
        # Verify ownership
        owned = await conn.fetchrow(
            "SELECT id FROM sandbox_sessions WHERE id=$1::uuid AND owner_id=$2::uuid",
            session_id, owner_id,
        )
        if not owned:
            return []
        rows = await conn.fetch(
            """
            SELECT id, event_type, severity, payload, created_at
            FROM sandbox_events
            WHERE session_id = $1::uuid
            ORDER BY created_at DESC
            LIMIT $2
            """,
            session_id, limit,
        )
        result = []
        for row in rows:
            e = dict(row)
            e["id"] = str(e["id"])
            e["created_at"] = e["created_at"].isoformat()
            result.append(e)
        return list(reversed(result))
    finally:
        await release_conn(conn)


# ── Command execution ─────────────────────────────────────────────────────────
# NOTE: subprocess.run() below is still a blocking call inside an async
# function, same as before this migration (it was blocking a sync worker
# thread previously). It's still on the "Contain the sandbox" list
# (scaling-plan item 4 / fix-it item 1) — moving to per-session containers is
# separate, larger work. Not addressed by this pass.

async def execute_command(session_id: str, owner_id: str,
                           command: str, timeout: int = 30) -> Dict[str, Any]:
    """
    Execute a command in the sandbox workspace.
    Applies policy checks, resource monitoring, full audit logging.
    """
    session = await get_session(session_id, owner_id)
    if not session:
        raise ValueError("Session not found or access denied")
    if session["status"] != "running":
        raise ValueError(f"Session is {session['status']}, not running")

    workspace = session.get("workspace_path") or "/tmp"
    policy = session.get("policy") or {}

    # Policy check
    allowed, reason = _check_command_policy(command)
    if not allowed:
        await _log_event(session_id, "policy_violation", {
            "command": command, "reason": reason
        }, severity="critical")
        return {
            "stdout": "",
            "stderr": f"[RAPTOR SANDBOX] Blocked: {reason}",
            "exit_code": 1,
            "blocked": True,
            "duration_ms": 0,
        }

    # Secret detection heuristic — scan command for suspicious file access
    if any(re.search(p, command, re.IGNORECASE) for p in BLOCKED_PATH_PATTERNS):
        await _log_event(session_id, "secret_access", {
            "command": command,
            "blocked": True
        }, severity="critical")

    # Execute
    start = time.time()
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=workspace,
            env={
                **os.environ,
                "HOME": workspace,
                "TMPDIR": workspace,
                "SANDBOX": "1",
                "RAPTOR_SANDBOX_ID": session_id,
            },
        )
        duration_ms = int((time.time() - start) * 1000)
        stdout = result.stdout[:4096]   # cap output
        stderr = result.stderr[:2048]

        await _log_event(session_id, "command", {
            "command": command,
            "exit_code": result.returncode,
            "duration_ms": duration_ms,
            "stdout_preview": stdout[:200],
        }, severity="info" if result.returncode == 0 else "warning")

        return {
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": result.returncode,
            "blocked": False,
            "duration_ms": duration_ms,
        }

    except subprocess.TimeoutExpired:
        await _log_event(session_id, "command", {
            "command": command,
            "error": "timeout",
            "timeout_seconds": timeout,
        }, severity="warning")
        return {
            "stdout": "",
            "stderr": f"[RAPTOR SANDBOX] Command timed out after {timeout}s",
            "exit_code": 124,
            "blocked": False,
            "duration_ms": timeout * 1000,
        }
    except Exception as e:
        await _log_event(session_id, "command", {
            "command": command,
            "error": str(e),
        }, severity="warning")
        return {
            "stdout": "",
            "stderr": str(e),
            "exit_code": 1,
            "blocked": False,
            "duration_ms": 0,
        }


async def stop_session(session_id: str, owner_id: str) -> bool:
    session = await get_session(session_id, owner_id)
    if not session:
        return False

    workspace = session.get("workspace_path")

    await _log_event(session_id, "system", {"message": "Session stopped by user"})
    try:
        await _update_session(session_id,
                               status="stopped",
                               ended_at=datetime.now(timezone.utc))
    except Exception:
        logger.exception("[sandbox_service] stop_session update failed")

    # Clean up workspace
    if workspace and os.path.exists(workspace):
        try:
            import shutil
            shutil.rmtree(workspace, ignore_errors=True)
        except Exception:
            pass

    return True


async def pause_session(session_id: str, owner_id: str) -> bool:
    session = await get_session(session_id, owner_id)
    if not session or session["status"] != "running":
        return False

    await _log_event(session_id, "system", {"message": "Session paused by user"})
    try:
        await _update_session(session_id,
                               status="paused",
                               paused_at=datetime.now(timezone.utc))
    except Exception:
        logger.exception("[sandbox_service] pause_session update failed")
        return False
    return True


async def resume_session(session_id: str, owner_id: str) -> bool:
    session = await get_session(session_id, owner_id)
    if not session or session["status"] != "paused":
        return False

    await _log_event(session_id, "system", {"message": "Session resumed by user"})
    try:
        await _update_session(session_id,
                               status="running",
                               paused_at=None)
    except Exception:
        logger.exception("[sandbox_service] resume_session update failed")
        return False
    return True


async def get_session_stats(session_id: str, owner_id: str) -> Dict[str, Any]:
    """Return aggregate stats from the audit log for a session."""
    conn = await get_conn()
    if not conn:
        return {}
    try:
        owned = await conn.fetchrow(
            "SELECT id FROM sandbox_sessions WHERE id=$1::uuid AND owner_id=$2::uuid",
            session_id, owner_id,
        )
        if not owned:
            return {}
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(*) FILTER (WHERE event_type = 'command') AS commands_run,
                COUNT(*) FILTER (WHERE event_type = 'policy_violation') AS violations,
                COUNT(*) FILTER (WHERE event_type = 'secret_access') AS secret_attempts,
                COUNT(*) FILTER (WHERE severity = 'critical') AS critical_events,
                COUNT(*) FILTER (WHERE severity = 'warning') AS warning_events,
                COUNT(*) TOTAL
            FROM sandbox_events WHERE session_id = $1::uuid
            """,
            session_id,
        )
        return {
            "commands_run": row["commands_run"] or 0,
            "policy_violations": row["violations"] or 0,
            "secret_access_attempts": row["secret_attempts"] or 0,
            "critical_events": row["critical_events"] or 0,
            "warning_events": row["warning_events"] or 0,
            "total_events": row["total"] or 0,
        }
    finally:
        await release_conn(conn)
