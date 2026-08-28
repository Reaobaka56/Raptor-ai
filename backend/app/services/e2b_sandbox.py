"""
E2B-backed sandbox provider.

Runs sandbox sessions in real, isolated E2B cloud sandboxes (Firecracker
microVMs) instead of `subprocess` on the host. This is the real security
boundary the local-subprocess fallback in sandbox_service.py cannot provide:
process isolation, no host filesystem access, no host network by default.

Activated only when E2B_API_KEY is set. If it isn't, sandbox_service falls
back to the hardened local-subprocess path (see _safe_sandbox_env there) —
real risk reduction, but NOT a true isolation boundary. Set E2B_API_KEY in
production as soon as practical; get a key at https://e2b.dev.
"""
import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT_SECONDS = 300  # E2B sandbox lifetime if not overridden by tier limits


def is_enabled() -> bool:
    return bool(os.getenv("E2B_API_KEY"))


async def create_sandbox(session_id: str, timeout_seconds: int,
                          allow_internet_access: bool = True,
                          envs: Optional[Dict[str, str]] = None) -> str:
    """Create a fresh E2B sandbox and return its sandbox_id for later
    reconnection. Raises on failure — callers should treat this the same
    as any other session-start failure."""
    from e2b import AsyncSandbox

    sandbox = await AsyncSandbox.create(
        timeout=timeout_seconds or _DEFAULT_TIMEOUT_SECONDS,
        envs=envs or {},
        allow_internet_access=allow_internet_access,
        metadata={"raptor_session_id": session_id},
    )
    logger.info("[e2b_sandbox] created sandbox=%s for session=%s", sandbox.sandbox_id, session_id)
    return sandbox.sandbox_id


async def run_command(sandbox_id: str, command: str, cwd: str = "/home/user",
                       envs: Optional[Dict[str, str]] = None,
                       timeout: int = 30) -> Dict[str, Any]:
    """Run a command inside an existing E2B sandbox. Returns the same shape
    as the local-subprocess path (stdout/stderr/exit_code/blocked/duration_ms)
    so sandbox_service.execute_command can treat both providers identically."""
    from e2b import AsyncSandbox
    from e2b.exceptions import TimeoutException, NotFoundException

    import time
    start = time.time()
    try:
        sandbox = await AsyncSandbox.connect(sandbox_id)
        result = await sandbox.commands.run(
            command,
            cwd=cwd,
            envs=envs or {},
            timeout=timeout,
        )
        duration_ms = int((time.time() - start) * 1000)
        return {
            "stdout": (result.stdout or "")[:4096],
            "stderr": (result.stderr or "")[:2048],
            "exit_code": result.exit_code,
            "blocked": False,
            "duration_ms": duration_ms,
        }
    except TimeoutException:
        duration_ms = int((time.time() - start) * 1000)
        return {
            "stdout": "",
            "stderr": f"[RAPTOR SANDBOX] Command timed out after {timeout}s",
            "exit_code": 124,
            "blocked": False,
            "duration_ms": duration_ms,
        }
    except NotFoundException:
        # Sandbox expired/was killed — surface as an execution error rather
        # than crashing the request; the session's status should be synced
        # to 'error' by the caller when this happens.
        return {
            "stdout": "",
            "stderr": "[RAPTOR SANDBOX] Sandbox session is no longer available (expired or stopped)",
            "exit_code": 1,
            "blocked": False,
            "duration_ms": int((time.time() - start) * 1000),
            "sandbox_gone": True,
        }
    except Exception as e:
        logger.exception("[e2b_sandbox] run_command failed sandbox=%s", sandbox_id)
        return {
            "stdout": "",
            "stderr": str(e),
            "exit_code": 1,
            "blocked": False,
            "duration_ms": int((time.time() - start) * 1000),
        }


async def kill_sandbox(sandbox_id: str) -> bool:
    from e2b import AsyncSandbox
    try:
        sandbox = await AsyncSandbox.connect(sandbox_id)
        return await sandbox.kill()
    except Exception:
        logger.exception("[e2b_sandbox] kill_sandbox failed sandbox=%s", sandbox_id)
        return False
