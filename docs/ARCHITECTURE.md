# Architecture

Raptor is an AI pull-request review SaaS. React/Vite frontend (Vercel) -> FastAPI backend
(Render) -> PostgreSQL + pgvector (Supabase) and Redis (rate limiting, dedupe, counters).
Gemini is the default LLM; users can bring their own keys for other providers.

```
Browser ──► Vercel (React/TS)
               │  REST + cookie session
               ▼
GitHub ──webhook──► FastAPI (Render, N workers)
                      │ routers ─► services ─► asyncpg pool ─► Postgres (+pgvector)
                      │                     └► redis.asyncio ─► Redis
                      ├► Gemini / OpenAI-compatible / Anthropic (via worker threads)
                      └► Sandbox executor ─► local process | Docker container
```

## Backend layout (`backend/app/`)

| Path | Responsibility |
|---|---|
| `main.py` | app factory, middleware, router registration, startup (pool + migrations) |
| `*_router.py` | one FastAPI router per resource (flat). `router/webhook.py` is the exception |
| `services/db.py` | asyncpg pool, jsonb codec (see *Data layer*) |
| `services/migrations.py` | startup migration runner (advisory-locked) |
| `services/session_store.py`, `auth_dependencies.py` | Postgres-backed sessions, `get_required_github_session` |
| `rate_limit.py` | Redis-backed sliding-window limiter middleware |
| `services/scan_service.py` | the PR review pipeline |
| `services/ai_service.py` | Gemini review prompt, output normalization/validation |
| `services/codebase_index_service.py`, `embedding_service.py` | repo indexing + pgvector retrieval |
| `services/agent_service.py`, `task_service.py`, `agent_runtime.py` | agents, tasks, tool loop - see [AGENT_SYSTEM.md](AGENT_SYSTEM.md) |
| `services/sandbox_service.py`, `sandbox_executor.py` | sandbox sessions and command execution - see [SANDBOX.md](SANDBOX.md) |
| `services/diff_utils.py`, `upload_validation.py` | unified-diff line mapping; magic-byte upload checks |

## The PR review flow

1. **Webhook** (`router/webhook.py`) verifies the signature, ignores irrelevant events, and
   de-duplicates on `repo:pr:head_sha` (Redis `SET NX`, 15 min; fail-open).
2. **Scan** (`scan_service.run_scan`) runs under a per-process semaphore (`MAX_CONCURRENT_SCANS`,
   default 4): fetch PR metadata and diff from GitHub.
3. **Context**: if the repo is indexed, retrieve semantically related chunks (pgvector). If not,
   `schedule_index` starts a deduped, concurrency-capped background index.
4. **LLM review** (`ai_service.analyze_pr`, in a worker thread, retried with backoff on 429/5xx).
   The diff/title/context are fenced as untrusted data. Findings for files not in the diff are dropped.
5. **Persist** the review (`reviews` table, with `owner_user_id` / `repo_owner` for tenant scoping).
6. **Post** one GitHub review: inline comments only on lines that exist in the diff
   (`diff_utils.parse_diff_lines`); other findings go in the review body. The bot **does not
   auto-approve** unless `RAPTOR_AUTO_APPROVE=1`.
7. **Memory**: store an embedding of the review for the team memory layer (best-effort).

Everything after step 1 runs in-process (FastAPI `BackgroundTasks`). There is no job queue yet:
work in flight is lost on restart. See [SCALING_TO_100K.md](SCALING_TO_100K.md).

## Data layer

* All DB access is `asyncpg` through the pool in `services/db.py` (`DB_POOL_MAX`, default 20 per
  process; acquire timeout `DB_ACQUIRE_TIMEOUT`, default 10s). Never hold a connection across an
  LLM/GitHub/embedding call - acquire, do the short query, release.
* **jsonb codec**: `json`/`jsonb` columns decode to Python objects. The encoder accepts either a
  Python object or a pre-serialized `json.dumps(...)` string. (Before migration 017 a
  pre-serialized string was double-encoded into a JSON *string*; the decoder also repairs any such
  legacy value on read.)
* Migrations: numbered SQL in `backend/migrations/`, applied at startup under
  `pg_advisory_lock(727274)` so concurrent instances serialize. Never edit an applied migration.
  See `.agents/skills/db-migrations/SKILL.md`.
* Vectors: 768-dim (`gemini-embedding-001` truncated + re-normalized). `code_chunks` uses HNSW.
  **Embedding history**: before this change the embedding client imported an uninstalled package
  and silently stored deterministic hash pseudo-vectors. Migration 018 clears the derived code
  index so repos re-index with real embeddings. User-authored memory (`convention_rules`,
  `review_embeddings`) was not rewritten: its old vectors are meaningless until re-embedded (follow-up).

## Concurrency model

* Async handlers must not block the event loop. Sync SDK/HTTP calls (`requests`, the Gemini
  client, embeddings, subprocesses) run via `asyncio.to_thread`, normally under a semaphore.
* Per-process caps (env): `MAX_CONCURRENT_SCANS` (4), `MAX_CONCURRENT_INDEXES` (2),
  `MAX_CONCURRENT_AGENT_RUNS` (8), `SANDBOX_MAX_CONCURRENT_EXECS` (8).
* Render runs `--workers ${WEB_CONCURRENCY:-2}`; caps and pools are **per worker**.

## Configuration (environment)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | - | Postgres (pgbouncer-safe; statement cache disabled) |
| `REDIS_URL` | `redis://localhost:6379/0` | rate limit, dedupe, platform-key quota |
| `GEMINI_API_KEY` | - | platform LLM + embeddings (without it, embeddings fall back to a deterministic hash - dev only) |
| `PROVIDER_KEYS_FERNET_KEY` | required | Fernet key for stored BYOK keys; there is no default |
| `DB_POOL_MAX` / `DB_ACQUIRE_TIMEOUT` / `DB_COMMAND_TIMEOUT` | 20 / 10 / 30 | pool tuning |
| `RAPTOR_AUTO_APPROVE` | off | let the bot APPROVE PRs with zero findings |
| `AGENT_*`, `SANDBOX_*` | see docs | [AGENT_SYSTEM.md](AGENT_SYSTEM.md), [SANDBOX.md](SANDBOX.md) |

## Deployment

Frontend and backend deploy on merge to `main` (Vercel / Render). The Render build runs
`scripts/run_migrations.py`; the app also runs pending migrations on startup. There is no staging
environment: use the PR preview workflow, and treat data-rewriting migrations (e.g. 017) with care.
