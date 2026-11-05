# Sandbox

Sandbox sessions give an agent (or user) a workspace directory and a way to run commands in it.
Code: `services/sandbox_service.py` (sessions, policy, audit log, file API) and
`services/sandbox_executor.py` (how a command actually runs).

## Isolation levels - be precise about which one you have

| Level | Backend | What it is | Use for |
|---|---|---|---|
| `process` | `SANDBOX_BACKEND=local` (default) | child process of the API server: scrubbed env, rlimits, process-group kill, concurrency cap | your own code, local dev. **Not a security boundary** |
| `container` | `SANDBOX_BACKEND=docker` | one throw-away container per command, locked down (below) | untrusted code, when the API host can reach a Docker daemon |

Set `SANDBOX_REQUIRE_ISOLATION=1` to make the `local` backend refuse to run at all (fail closed).
If `docker` is selected but unavailable, commands are **refused**, never silently run locally.

### What the `local` backend does

* Environment is rebuilt from scratch: only `PATH, LANG, LC_ALL, TERM` + `HOME/TMPDIR=<workspace>`.
  Server secrets (`DATABASE_URL`, API keys, OAuth/encryption secrets) are not visible to commands.
* rlimits: 30s CPU, 50 MB file size, 64 processes, 1 GB address space; wall-clock timeout kills the
  whole process group. At most `SANDBOX_MAX_CONCURRENT_EXECS` (8) run at once; commands run in a
  worker thread so the event loop is never blocked.
* **Not provided**: filesystem isolation (a command can read anything the API user can), network
  isolation, user separation.

### What the `docker` backend does (`build_docker_argv`)

`docker run --rm` with: `--network none` (or `bridge` via `SANDBOX_DOCKER_NETWORK`), `--read-only`
root fs + 64 MB `noexec` tmpfs, `--cap-drop ALL`, `no-new-privileges`, `--pids-limit`, `--memory`
(= `--memory-swap`), `--cpus`, run as the API's uid:gid (never root), and **only the session
workspace mounted** at `/workspace`. The Docker socket is never mounted. On timeout the container
is killed by name (killing the CLI client alone would not stop it).

| Env | Default |
|---|---|
| `SANDBOX_BACKEND` | `local` |
| `SANDBOX_REQUIRE_ISOLATION` | off |
| `SANDBOX_DOCKER_IMAGE` | `python:3.12-slim` (use an image with your toolchains; none of node/cargo/go are in the default) |
| `SANDBOX_DOCKER_NETWORK` | `none` |
| `SANDBOX_DOCKER_MEMORY` / `_CPUS` / `_PIDS` | `512m` / `1` / `128` |
| `SANDBOX_MAX_CONCURRENT_EXECS` | `8` |

### Deploying the docker backend

Render web services cannot run Docker. Options: (a) run the API on a VM/host with Docker (the API
user then effectively controls the Docker daemon - keep that host single-purpose); (b) move
execution to a managed sandbox (E2B, Modal) by adding a third backend in `sandbox_executor.py`
(`run_command_blocking` is the only seam). **The docker backend has been unit-tested for its flags
and fail-closed behaviour but has not been run against a live daemon in CI** - smoke-test it on
the target host (`SANDBOX_BACKEND=docker`, run a session, try `cat /etc/shadow`, `curl example.com`,
and a fork bomb) before relying on it.

## Policy layer (both backends)

Applied before execution in `execute_command` / the file API, independent of isolation:
blocked path patterns (`.env`, keys, `.ssh`, `.aws`, tokens/credentials), dangerous commands
(`rm -rf /`, `dd if=`, curl|sh ...), blocked commands (`shutdown`, `mount` ...), blocked network
domains (cloud metadata endpoints). These are **heuristics** - a regex deny-list is bypassable;
isolation, not policy, is the security boundary. Every command, denial and secret-access attempt is
written to the sandbox audit log (`GET /api/sandbox/sessions/{id}/events`).

## Rules for changing sandbox code

* Never build a shell string from user input; if unavoidable use `shlex.quote` (see
  `agent_runtime.authorize` for the pattern). Workspace file access resolves with `realpath` and
  must stay inside the workspace (`_resolve_in_workspace`).
* Don't weaken `build_docker_argv`; its security flags are pinned by `tests/unit/test_sandbox_executor.py`.
* Update this file and `.agents/skills/sandbox-safety/SKILL.md` whenever the real isolation level changes.
