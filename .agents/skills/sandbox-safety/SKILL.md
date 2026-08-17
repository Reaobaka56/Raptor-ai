# Sandbox Safety

Raptor's sandbox (agent attach/drop, custom agent templates) currently executes via bare
`subprocess.run()` — there is no real container isolation yet. This is a known gap, not a
surprise to rediscover.

## What this means in practice

- Anything that reaches the sandbox execution path is effectively running with the same
  privileges as the backend process. Treat all sandbox input as untrusted.
- Do not add an endpoint that passes user-controlled strings into a shell command without
  going through `shlex.quote` or an argument-list `subprocess.run(["cmd", arg1, arg2])` form —
  never `shell=True` with interpolated input.
- Do not assume filesystem writes from the sandbox are contained. There's no chroot/namespace
  isolation yet — a sandbox escape is a host escape.

## Before shipping sandbox-adjacent work

1. Ask: does this endpoint let a user-supplied value reach a shell command, file path, or
   subprocess argument? If yes, that's the injection surface — audit it explicitly.
2. Don't ship real container isolation as a side effect of an unrelated feature — it's a
   dedicated project (likely gVisor, Firecracker, or Docker-in-Docker with tight resource
   limits), not a quick patch. Flag it, don't quietly half-fix it.
3. If you do touch isolation, update this file with what changed — this doc should always
   reflect the actual current isolation level, not the aspirational one.
