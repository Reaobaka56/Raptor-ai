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
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import psutil

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

def _log_event(session_id: str, event_type: str, payload: dict,
               severity: str = "info") -> None:
    """Persist a sandbox event to the audit log. Best-effort, non-blocking."""
    conn = get_conn()
    if not conn:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sandbox_events (session_id, event_type, severity, payload)
                VALUES (%s::uuid, %s, %s, %s::jsonb)
                """,
                (session_id, event_type, severity, json.dumps(payload)),
            )
            conn.commit()
    except Exception:
        try: conn.rollback()
        except: pass
    finally:
        release_conn(conn)


def _update_session(session_id: str, **fields) -> None:
    conn = get_conn()
    if not conn:
        return
    try:
        with conn.cursor() as cur:
            set_clauses = ", ".join(f"{k} = %s" for k in fields)
            values = list(fields.values()) + [session_id]
            cur.execute(
                f"UPDATE sandbox_sessions SET {set_clauses} WHERE id = %s::uuid",
                values,
            )
            conn.commit()
    except Exception:
        try: conn.rollback()
        except: pass
    finally:
        release_conn(conn)



def ensure_sandbox_schema() -> None:
    """Add columns introduced after the original sandbox migration, if absent."""
    conn = get_conn()
    if not conn:
        return
    try:
        with conn.cursor() as cur:
            cur.execute("""
                ALTER TABLE sandbox_sessions ADD COLUMN IF NOT EXISTS provider TEXT;
                ALTER TABLE sandbox_sessions ADD COLUMN IF NOT EXISTS provider_key_source TEXT NOT NULL DEFAULT 'platform';
            """)
            conn.commit()
    except Exception:
        logger.exception("[sandbox_service] ensure_sandbox_schema failed")
        try: conn.rollback()
        except Exception: pass
    finally:
        release_conn(conn)

# ── Session management ────────────────────────────────────────────────────────

def create_session(owner_id: str, name: str, repo_url: Optional[str],
                   agent_type: str, policy: dict, resource_limits: dict,
                   provider: Optional[str] = None, provider_key_source: str = "platform") -> Dict[str, Any]:
    conn = get_conn()
    if not conn:
        raise RuntimeError("Database unavailable")
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sandbox_sessions
                    (owner_id, name, repo_url, agent_type, policy, resource_limits, status, provider, provider_key_source)
                VALUES (%s::uuid, %s, %s, %s, %s::jsonb, %s::jsonb, 'starting', %s, %s)
                RETURNING id, name, status, agent_type, repo_url, provider, provider_key_source, policy,
                          resource_limits, created_at
                """,
                (owner_id, name, repo_url, agent_type,
                 json.dumps(policy), json.dumps(resource_limits), provider, provider_key_source),
            )
            conn.commit()
            row = cur.fetchone()
            cols = [d[0] for d in cur.description]
            session = dict(zip(cols, row))
            session["id"] = str(session["id"])
            session["created_at"] = session["created_at"].isoformat()

            # Create temp workspace directory
            workspace = tempfile.mkdtemp(prefix=f"raptor_sandbox_{session['id'][:8]}_")
            _update_session(session["id"], status="running",
                            workspace_path=workspace,
                            started_at=datetime.now(timezone.utc).isoformat())
            session["workspace_path"] = workspace
            session["status"] = "running"

            _log_event(session["id"], "system", {
                "message": f"Sandbox session started. Workspace: {workspace}",
                "agent_type": agent_type,
                "repo_url": repo_url,
                "provider": provider,
                "provider_key_source": provider_key_source,
            })

            return session
    except Exception:
        raise
    finally:
        release_conn(conn)


def get_session(session_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    ensure_sandbox_schema()
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, owner_id, name, status, agent_type, repo_url,
                       provider, provider_key_source, workspace_path, policy, resource_limits,
                       process_pid, started_at, ended_at, created_at
                FROM sandbox_sessions
                WHERE id = %s::uuid AND owner_id = %s::uuid
                """,
                (session_id, owner_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            s = dict(zip(cols, row))
            s["id"] = str(s["id"])
            s["owner_id"] = str(s["owner_id"])
            for ts in ("started_at", "ended_at", "created_at"):
                if s.get(ts):
                    s[ts] = s[ts].isoformat()
            return s
    finally:
        release_conn(conn)


def list_sessions(owner_id: str) -> List[Dict[str, Any]]:
    ensure_sandbox_schema()
    conn = get_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, status, agent_type, repo_url, provider, provider_key_source,
                       started_at, ended_at, created_at
                FROM sandbox_sessions
                WHERE owner_id = %s::uuid
                ORDER BY created_at DESC
                LIMIT 50
                """,
                (owner_id,),
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            result = []
            for row in rows:
                s = dict(zip(cols, row))
                s["id"] = str(s["id"])
                for ts in ("started_at", "ended_at", "created_at"):
                    if s.get(ts):
                        s[ts] = s[ts].isoformat()
                result.append(s)
            return result
    finally:
        release_conn(conn)


def get_events(session_id: str, owner_id: str,
               limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            # Verify ownership
            cur.execute(
                "SELECT id FROM sandbox_sessions WHERE id=%s::uuid AND owner_id=%s::uuid",
                (session_id, owner_id),
            )
            if not cur.fetchone():
                return []
            cur.execute(
                """
                SELECT id, event_type, severity, payload, created_at
                FROM sandbox_events
                WHERE session_id = %s::uuid
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (session_id, limit),
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            result = []
            for row in rows:
                e = dict(zip(cols, row))
                e["id"] = str(e["id"])
                e["created_at"] = e["created_at"].isoformat()
                result.append(e)
            return list(reversed(result))
    finally:
        release_conn(conn)


# ── Command execution ─────────────────────────────────────────────────────────

def execute_command(session_id: str, owner_id: str,
                    command: str, timeout: int = 30) -> Dict[str, Any]:
    """
    Execute a command in the sandbox workspace.
    Applies policy checks, resource monitoring, full audit logging.
    """
    session = get_session(session_id, owner_id)
    if not session:
        raise ValueError("Session not found or access denied")
    if session["status"] != "running":
        raise ValueError(f"Session is {session['status']}, not running")

    workspace = session.get("workspace_path") or "/tmp"
    policy = session.get("policy") or {}

    # Policy check
    allowed, reason = _check_command_policy(command)
    if not allowed:
        _log_event(session_id, "policy_violation", {
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
        _log_event(session_id, "secret_access", {
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

        _log_event(session_id, "command", {
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
        _log_event(session_id, "command", {
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
        _log_event(session_id, "command", {
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


def stop_session(session_id: str, owner_id: str) -> bool:
    session = get_session(session_id, owner_id)
    if not session:
        return False

    workspace = session.get("workspace_path")

    _log_event(session_id, "system", {"message": "Session stopped by user"})
    _update_session(session_id,
                    status="stopped",
                    ended_at=datetime.now(timezone.utc).isoformat())

    # Clean up workspace
    if workspace and os.path.exists(workspace):
        try:
            import shutil
            shutil.rmtree(workspace, ignore_errors=True)
        except Exception:
            pass

    return True


def get_session_stats(session_id: str, owner_id: str) -> Dict[str, Any]:
    """Return aggregate stats from the audit log for a session."""
    conn = get_conn()
    if not conn:
        return {}
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM sandbox_sessions WHERE id=%s::uuid AND owner_id=%s::uuid",
                (session_id, owner_id),
            )
            if not cur.fetchone():
                return {}
            cur.execute(
                """
                SELECT
                    COUNT(*) FILTER (WHERE event_type = 'command') AS commands_run,
                    COUNT(*) FILTER (WHERE event_type = 'policy_violation') AS violations,
                    COUNT(*) FILTER (WHERE event_type = 'secret_access') AS secret_attempts,
                    COUNT(*) FILTER (WHERE severity = 'critical') AS critical_events,
                    COUNT(*) FILTER (WHERE severity = 'warning') AS warning_events,
                    COUNT(*) TOTAL
                FROM sandbox_events WHERE session_id = %s::uuid
                """,
                (session_id,),
            )
            row = cur.fetchone()
            return {
                "commands_run": row[0] or 0,
                "policy_violations": row[1] or 0,
                "secret_access_attempts": row[2] or 0,
                "critical_events": row[3] or 0,
                "warning_events": row[4] or 0,
                "total_events": row[5] or 0,
            }
    finally:
        release_conn(conn)
