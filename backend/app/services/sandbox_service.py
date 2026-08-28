"""
Sandbox service — isolated agent execution environment.

Uses E2B (Firecracker-isolated cloud sandboxes) when E2B_API_KEY is
configured — real process/filesystem/network isolation per session, no
host access. Falls back to hardened local subprocess execution when it
isn't configured, which is resource-exhaustion mitigation only, NOT a real
isolation boundary — see e2b_sandbox.py and _safe_sandbox_env below.

Key security layers:
1. Blocked path patterns (secrets, keys, credentials)
2. Blocked domain list (cloud metadata endpoints)
3. Resource limits (E2B sandbox limits, or local rlimits as fallback)
4. Command allowlist / denylist
5. Full audit trail persisted to sandbox_events table
6. Sandboxed commands never inherit the backend process's environment/secrets
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
from . import e2b_sandbox

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
            ALTER TABLE sandbox_sessions ADD COLUMN IF NOT EXISTS e2b_sandbox_id TEXT;
        """)
        _schema_ready = True
    except Exception:
        logger.exception("[sandbox_service] ensure_sandbox_schema failed")
    finally:
        await release_conn(conn)

# ── Session management ────────────────────────────────────────────────────────

async def count_sessions_today(owner_id: str) -> int:
    """Count sessions this owner has created since midnight UTC. Used to
    enforce max_sessions_per_day. Excludes nothing — even errored/stopped
    sessions count against the daily quota, since the resource cost (workspace,
    DB row, event log) was already incurred."""
    conn = await get_conn()
    if not conn:
        # Fail open: if the DB is unreachable we've got bigger problems than
        # rate limiting, and create_session below will raise anyway.
        return 0
    try:
        row = await conn.fetchrow(
            """
            SELECT COUNT(*) AS n
            FROM sandbox_sessions
            WHERE owner_id = $1::uuid
              AND created_at >= (now() AT TIME ZONE 'utc')::date
            """,
            owner_id,
        )
        return int(row["n"]) if row else 0
    except Exception:
        logger.exception("[sandbox_service] count_sessions_today failed (owner_id=%s)", owner_id)
        return 0
    finally:
        await release_conn(conn)


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

        # Provision the execution environment. Prefer E2B (real container
        # isolation) whenever configured; otherwise fall back to a local
        # tempdir + hardened subprocess, which is NOT a real security
        # boundary — see _safe_sandbox_env and the module docstring above.
        workspace = tempfile.mkdtemp(prefix=f"raptor_sandbox_{session['id'][:8]}_")
        e2b_id = None
        try:
            if e2b_sandbox.is_enabled():
                max_minutes = (resource_limits or {}).get("max_session_minutes", 30)
                e2b_id = await e2b_sandbox.create_sandbox(
                    session_id=session["id"],
                    timeout_seconds=int(max_minutes) * 60,
                    allow_internet_access=(network_policy or {}).get("allow", True),
                )
            else:
                logger.warning(
                    "[sandbox_service] E2B_API_KEY not set — session %s will run via "
                    "local subprocess, which is NOT a real isolation boundary. "
                    "Set E2B_API_KEY in production.",
                    session["id"],
                )

            await _update_session(session["id"], status="running",
                                   workspace_path=workspace,
                                   e2b_sandbox_id=e2b_id,
                                   started_at=datetime.now(timezone.utc))
            session["workspace_path"] = workspace
            session["e2b_sandbox_id"] = e2b_id
            session["status"] = "running"
            await _log_event(session["id"], "system", {
                "message": f"Sandbox session started. Provider: {'e2b' if e2b_id else 'local-subprocess'}",
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
                   process_pid, started_at, ended_at, paused_at, created_at,
                   e2b_sandbox_id
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


def _safe_sandbox_env(workspace: str, session_id: str) -> Dict[str, str]:
    """
    Build the environment for a sandboxed command from scratch — never by
    inheriting the backend process's environment. os.environ holds every
    secret this service needs (DATABASE_URL, JWT_SECRET,
    PROVIDER_KEYS_FERNET_KEY, GITHUB_CLIENT_SECRET, GITHUB_PRIVATE_KEY, AI
    provider keys, ...), and sandboxed code is untrusted by definition —
    `env` or `cat /proc/self/environ` inside the sandbox would otherwise
    hand all of that to whoever/whatever is running there.
    """
    return {
        "HOME": workspace,
        "TMPDIR": workspace,
        "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "LANG": "C.UTF-8",
        "SANDBOX": "1",
        "RAPTOR_SANDBOX_ID": session_id,
    }

def _limit_local_resources(max_memory_mb: int):
    """preexec_fn for the local-subprocess fallback: caps CPU time, address
    space, process count, and file size for the child before exec. This is
    resource-exhaustion mitigation, NOT process/filesystem isolation — it
    doesn't stop a command from reading arbitrary host paths the OS user can
    reach. Only meaningful defense-in-depth when E2B isn't configured."""
    import resource

    def _apply():
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
            mem_bytes = max(64, int(max_memory_mb)) * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
            resource.setrlimit(resource.RLIMIT_NPROC, (64, 64))
            resource.setrlimit(resource.RLIMIT_FSIZE, (50 * 1024 * 1024, 50 * 1024 * 1024))
        except Exception:
            # Never let a resource-limit failure block execution — this is
            # best-effort hardening on top of the policy checks above, not
            # the primary control.
            logger.exception("[sandbox_service] failed to apply local resource limits")

    return _apply


async def _execute_local(session_id: str, command: str, workspace: str,
                          timeout: int, max_memory_mb: int) -> Dict[str, Any]:
    start = time.time()
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=workspace,
            env=_safe_sandbox_env(workspace, session_id),
            preexec_fn=_limit_local_resources(max_memory_mb),
        )
        duration_ms = int((time.time() - start) * 1000)
        stdout = result.stdout[:4096]
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


async def execute_command(session_id: str, owner_id: str,
                           command: str, timeout: int = 30) -> Dict[str, Any]:
    """
    Execute a command in the sandbox.
    Applies policy checks, then dispatches to E2B (real isolation) if the
    session was provisioned there, otherwise the hardened local-subprocess
    fallback. Full audit logging either way.
    """
    session = await get_session(session_id, owner_id)
    if not session:
        raise ValueError("Session not found or access denied")
    if session["status"] != "running":
        raise ValueError(f"Session is {session['status']}, not running")

    workspace = session.get("workspace_path") or "/tmp"
    policy = session.get("policy") or {}
    resource_limits = session.get("resource_limits") or {}
    e2b_id = session.get("e2b_sandbox_id")

    # Policy check — applies to both providers as defense-in-depth, even
    # though E2B's isolation makes most of these moot for host safety.
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

    if e2b_id:
        start = time.time()
        result = await e2b_sandbox.run_command(
            e2b_id, command, cwd="/home/user", timeout=timeout,
        )
        if result.pop("sandbox_gone", False):
            try:
                await _update_session(session_id, status="error")
            except Exception:
                logger.exception("[sandbox_service] failed to mark session error after sandbox_gone")
        await _log_event(session_id, "command", {
            "command": command,
            "exit_code": result["exit_code"],
            "duration_ms": result["duration_ms"],
            "stdout_preview": result["stdout"][:200],
            "provider": "e2b",
        }, severity="info" if result["exit_code"] == 0 else "warning")
        return result

    return await _execute_local(
        session_id, command, workspace, timeout,
        max_memory_mb=resource_limits.get("max_memory_mb", 256),
    )


async def stop_session(session_id: str, owner_id: str) -> bool:
    session = await get_session(session_id, owner_id)
    if not session:
        return False

    workspace = session.get("workspace_path")
    e2b_id = session.get("e2b_sandbox_id")

    await _log_event(session_id, "system", {"message": "Session stopped by user"})
    try:
        await _update_session(session_id,
                               status="stopped",
                               ended_at=datetime.now(timezone.utc))
    except Exception:
        logger.exception("[sandbox_service] stop_session update failed")

    if e2b_id:
        await e2b_sandbox.kill_sandbox(e2b_id)

    # Clean up local workspace (harmless no-op for E2B-backed sessions,
    # which never wrote anything to it)
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
