# Sandbox Safety

Raptor's sandbox runs commands through `services/sandbox_executor.py` with one of two backends:

- `local` (default): a child process of the API server with a scrubbed environment, rlimits and
  a process-group timeout. **This is hardening, not isolation.**
- `docker`: a locked-down throw-away container per command (no network by default, read-only
  root, all caps dropped, non-root, only the workspace mounted). Unit-tested for its flags and
  fail-closed behaviour; not yet exercised against a live Docker daemon in CI.

`SANDBOX_REQUIRE_ISOLATION=1` makes `local` refuse to run. Full detail: `docs/SANDBOX.md`.

## What this means in practice

- With the `local` backend, a sandbox command has the API's OS privileges and filesystem/network
  reach (minus the secrets removed from its environment). Treat all sandbox input as untrusted.
- Never build a shell string from user-controlled values without `shlex.quote`; prefer argument
  lists. Agent tool actions are authorized in `agent_runtime.authorize` before they reach the sandbox.
- Policy deny-lists (paths/commands/domains) are heuristics, not a boundary. Isolation is the boundary.

## Before shipping sandbox-adjacent work

1. Ask: does this endpoint let a user-supplied value reach a shell command, file path, or
   subprocess argument? If yes, that's the injection surface — audit it explicitly.
2. Isolation changes are a dedicated project, not a side effect of a feature. Extend
   `sandbox_executor.run_command_blocking` (the single seam) and pin new security flags in
   `tests/unit/test_sandbox_executor.py`. Next steps on the roadmap: managed sandbox (E2B/Modal) or gVisor/Firecracker.
3. If you do touch isolation, update this file with what changed — this doc should always
   reflect the actual current isolation level, not the aspirational one.
