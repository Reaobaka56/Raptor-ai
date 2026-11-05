"""Sandbox command executors.

Two interchangeable backends run a shell command against a session workspace:

* ``local``  - a child process of the API server with a scrubbed environment and
  POSIX rlimits. Hardening only; **not isolation**: the command still runs as
  the backend's OS user on the backend's filesystem and network.
* ``docker`` - ``docker run`` of a throw-away container: no network (by
  default), read-only root filesystem, all capabilities dropped, no-new-privileges,
  pid/memory/cpu caps, only the session workspace mounted, non-root user.

Selection (env):
    SANDBOX_BACKEND            local (default) | docker
    SANDBOX_REQUIRE_ISOLATION  1 -> refuse to run when the backend is ``local``
    SANDBOX_DOCKER_IMAGE       image for the docker backend (default python:3.12-slim)
    SANDBOX_DOCKER_NETWORK     none (default) | bridge
    SANDBOX_DOCKER_MEMORY      default 512m
    SANDBOX_DOCKER_CPUS        default 1
    SANDBOX_DOCKER_PIDS        default 128

Everything here is blocking and must be called from a worker thread
(``asyncio.to_thread``). See docs/SANDBOX.md for the threat model.
"""
import logging
import os
import signal
import subprocess
import uuid
from typing import Dict, List

logger = logging.getLogger(__name__)

# Only these host variables are ever visible to sandboxed commands. Everything
# else (DATABASE_URL, GEMINI_API_KEY, GITHUB_CLIENT_SECRET, encryption keys...)
# is dropped.
_SAFE_ENV_KEYS = ("PATH", "LANG", "LC_ALL", "TERM")

BACKENDS = ("local", "docker")


class SandboxIsolationUnavailable(RuntimeError):
    """Isolation is required but the configured backend cannot provide it."""


def backend_name() -> str:
    name = os.getenv("SANDBOX_BACKEND", "local").strip().lower()
    if name not in BACKENDS:
        logger.warning("[sandbox] unknown SANDBOX_BACKEND=%r, using 'local'", name)
        return "local"
    return name


def isolation_level() -> str:
    """'container' for the docker backend, 'process' for local. Surfaced in the
    API/UI so nobody mistakes hardening for isolation."""
    return "container" if backend_name() == "docker" else "process"


def sandbox_env(workspace: str, session_id: str) -> Dict[str, str]:
    env = {k: os.environ[k] for k in _SAFE_ENV_KEYS if k in os.environ}
    env.update({
        "HOME": workspace,
        "TMPDIR": workspace,
        "SANDBOX": "1",
        "RAPTOR_SANDBOX_ID": session_id,
    })
    return env


def _apply_rlimits() -> None:  # runs in the child between fork and exec
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (30, 30))
        resource.setrlimit(resource.RLIMIT_FSIZE, (50 * 1024 * 1024,) * 2)
        resource.setrlimit(resource.RLIMIT_NPROC, (64, 64))
        resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024,) * 2)
    except Exception:
        pass


def run_local(command: str, workspace: str, env: Dict[str, str], timeout: int):
    """Blocking subprocess run. On timeout the whole process group is killed,
    not just the shell."""
    proc = subprocess.Popen(
        command, shell=True, cwd=workspace, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        start_new_session=True, preexec_fn=_apply_rlimits,
    )
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except Exception:
            proc.kill()
        proc.communicate()
        raise
    return subprocess.CompletedProcess(command, proc.returncode, out, err)


def build_docker_argv(command: str, workspace: str, container_name: str) -> List[str]:
    """Pure function: the exact ``docker run`` argv for a command. Kept separate
    so the security-relevant flags are unit-tested without needing Docker."""
    network = os.getenv("SANDBOX_DOCKER_NETWORK", "none")
    if network not in ("none", "bridge"):
        network = "none"
    memory = os.getenv("SANDBOX_DOCKER_MEMORY", "512m")
    return [
        "docker", "run", "--rm",
        "--name", container_name,
        "--network", network,
        "--read-only",
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        "--pids-limit", os.getenv("SANDBOX_DOCKER_PIDS", "128"),
        "--memory", memory, "--memory-swap", memory,
        "--cpus", os.getenv("SANDBOX_DOCKER_CPUS", "1"),
        "--user", f"{os.getuid()}:{os.getgid()}",
        "-v", f"{workspace}:/workspace:rw",
        "-w", "/workspace",
        "-e", "HOME=/workspace", "-e", "SANDBOX=1",
        os.getenv("SANDBOX_DOCKER_IMAGE", "python:3.12-slim"),
        "sh", "-c", command,
    ]


def run_docker(command: str, workspace: str, session_id: str, timeout: int):
    name = f"raptor-sbx-{session_id[:8]}-{uuid.uuid4().hex[:8]}"
    argv = build_docker_argv(command, workspace, name)
    try:
        proc = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    except FileNotFoundError:
        raise SandboxIsolationUnavailable("SANDBOX_BACKEND=docker but the docker CLI is not installed")
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        # Killing the CLI client does NOT stop the container; kill it by name.
        subprocess.run(["docker", "kill", name], capture_output=True, timeout=15)
        proc.kill()
        proc.communicate()
        raise
    if proc.returncode == 125 and "Cannot connect to the Docker daemon" in (err or ""):
        raise SandboxIsolationUnavailable("Docker daemon is not reachable")
    return subprocess.CompletedProcess(command, proc.returncode, out, err)


def run_command_blocking(command: str, workspace: str, session_id: str, timeout: int):
    """Run `command` in the configured backend. Raises SandboxIsolationUnavailable
    when isolation is required (or docker is selected) and cannot be provided."""
    backend = backend_name()
    if backend == "docker":
        return run_docker(command, workspace, session_id, timeout)
    if os.getenv("SANDBOX_REQUIRE_ISOLATION", "").lower() in ("1", "true", "yes"):
        raise SandboxIsolationUnavailable(
            "SANDBOX_REQUIRE_ISOLATION is set but SANDBOX_BACKEND=local provides no container isolation"
        )
    return run_local(command, workspace, sandbox_env(workspace, session_id), timeout)
