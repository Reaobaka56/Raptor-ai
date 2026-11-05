# Security

What is protected, how, and what is still open. Update this file when a control changes - it should
describe the code as it is, not as intended.

## Controls in place

| Area | Control | Where |
|---|---|---|
| **Tenant isolation** | Reviews carry `owner_user_id` + `repo_owner`; `/api/reviews`, `/api/stats`, fix-PR are authenticated and scoped (`review_scope_sql`). Agents/tasks/sandboxes are always queried by `owner_id`; assigned agent, parent and dependency task IDs are ownership-checked on write | `reviews_router.py`, `telemetry_router.py`, `task_service.py` |
| **Sessions** | Postgres-backed, TTL slides only when < half remains | `session_store.py`, `auth_dependencies.py` |
| **Secrets at rest** | BYOK keys Fernet-encrypted; `PROVIDER_KEYS_FERNET_KEY` is mandatory (no default, no reuse of other secrets) | `provider_key_service.py` |
| **Admin** | role comes from the DB (`is_admin`), not a hardcoded username | `user_service` |
| **Webhooks** | HMAC signature verification; duplicate-delivery de-duplication | `router/webhook.py` |
| **Rate limiting** | Redis sliding window (async), per-IP; admin bypass checked only when a request is over the limit | `rate_limit.py` |
| **Prompt injection (PR review)** | diff/title/context fenced with a per-request nonce and declared untrusted; findings on files not in the diff are dropped; inline comments restricted to real diff lines; the bot never auto-approves (`RAPTOR_AUTO_APPROVE`) | `ai_service.py`, `scan_service.py` |
| **Prompt injection (agents)** | tool output fenced as untrusted data; every action authorized against the agent's tools/permissions regardless of what the model says; denial counter aborts runs | `agent_runtime.py` |
| **Agent permissions** | tool allow-list, `allowed_paths`/`blocked_paths`, `can_commit`, change/command/step limits, human approval (`review` status) | `agent_runtime.authorize` |
| **Sandbox** | scrubbed env + rlimits (local) or locked-down container (docker); policy deny-lists; audit log; see [SANDBOX.md](SANDBOX.md) | `sandbox_executor.py` |
| **Uploads** | extension allow-list **and** magic-byte check; size caps; random server-side filenames | `blog_router.py`, `upload_validation.py` |
| **Cost abuse** | anonymous `/debug/solve` removed (auth required); platform-key agent runs capped per user/day | `analysis.py`, `task_router.py` |
| **Input validation** | agent/task payloads validated (tools, provider, priority, status, UUIDs, sizes) -> 400 | `agent_service.py`, `task_service.py` |
| **SQL** | parameterized queries throughout; dynamic column names only from fixed allow-lists | all services |

## Known gaps (do not assume these are covered)

1. **Local sandbox is not isolation.** Until `SANDBOX_BACKEND=docker` (or a managed sandbox) is
   deployed, a sandbox command runs as the API's OS user. Treat any user able to run commands as able to
   read the API host's filesystem. The docker backend is unit-tested but not yet exercised against a live daemon in CI.
2. **Policy deny-lists are heuristics** (regex on commands/paths) and bypassable; only isolation contains a malicious command.
3. **Webhook-triggered reviews are attributed by repo owner login.** An org repo with no Raptor user
   named like the org is not visible in the dashboard until team-based ownership is added.
4. **No job queue**: scans/agent runs are in-process and lost on restart.
5. **Rate limiting is per-IP**, so large NAT'd offices share a budget; there is no per-user limit yet.
6. **No per-team AI quota** beyond the agent platform-key daily cap.
7. **LLM output is advisory**: suggestions are posted as one-click GitHub suggestions above a confidence floor. A reviewer must still read them.
8. Security test coverage is growing (see `backend/tests/security/`) but not exhaustive; there is no automated dependency/SAST step beyond Dependabot.

## Reporting

Report vulnerabilities privately to the maintainers rather than opening a public issue.
