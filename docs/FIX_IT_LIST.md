# Fix-It List

Security, scaling & UI issues found in a review of the codebase, ranked by priority.

- [ ] **1. Isolate the sandbox properly** — `CRITICAL`
  It currently runs arbitrary commands via `subprocess.run()` directly on the host with only
  policy checks (blocked paths/commands), no real containment. This is the biggest security risk
  in the app — replace with real containers (Docker-per-session, gVisor/Firecracker) or a managed
  sandbox provider (E2B, Modal) before any untrusted user runs code through it.

- [ ] **2. Move rate limiting into Redis** — `HIGH`
  `InMemoryRateLimitMiddleware` keeps counters in process memory. The moment you run more than one
  backend instance, each has its own limits — a user can multiply their real limit just by landing
  on different instances. Swap to Redis `INCR`+`TTL` so limits are shared.

- [ ] **3. Fix the sync/async DB mismatch** — `HIGH`
  `requirements.txt` has both `psycopg2-binary` (sync) and `asyncpg` (async); `db.py` uses a
  synchronous `ThreadedConnectionPool` inside async route handlers. Blocking DB calls in an async
  app cap your real concurrency hard. Pick `asyncpg` everywhere, or explicitly offload sync calls
  to a threadpool.

- [ ] **4. Make AI provider calls async** — `HIGH`
  `ai_service.py` uses the sync `genai.Client` and `requests.get()` for diff fetching. A slow
  Gemini call currently blocks a whole worker. Move to async HTTP clients, and put PR analysis /
  embedding generation on a job queue (Celery/RQ/Arq) instead of inline in the request.

- [ ] **5. Remove in-memory app state** — `MEDIUM`
  `state.py` holds `LIVE_WEBHOOK_LOGS`, `MOCK_REPOSITORIES`, `MOCK_REVIEWS` as plain Python
  lists/dicts, and `auth_dependencies.py` silently falls back to an in-memory session dict if
  Redis errors. Any of this that's live (not just demo data) needs to move fully into
  Redis/Postgres, and the silent fallback should fail loudly instead of drifting per-instance.

- [ ] **6. Add real migration tooling** — `MEDIUM`
  Nine hand-numbered SQL files applied by a bash loop, no rollback path, no protection against
  concurrent schema edits. Adopt Alembic (or equivalent) with a versioned migrations table.

- [ ] **7. Tighten the internal-auth trust boundary** — `MEDIUM`
  `get_required_github_session` treats a valid internal API token and a valid user session as
  interchangeable, returning `None` as a stand-in for "no user" either way. Any future endpoint
  that assumes session implies identity is a privilege-confusion bug waiting to happen — use an
  explicit `is_internal_request` flag instead.

- [ ] **8. Add an index to the pgvector memory table** — `LOW`
  Team-memory similarity search will degrade linearly as rows grow without an ivfflat/hnsw index —
  cheap to add now, painful to retrofit under load.

- [ ] **9. Unify the app's visual language with the landing page** — `UI`
  `Layout.tsx`/`Dashboard.tsx` use flat `bg-black`/`border-white/10` boxes while `Landing.tsx` has
  a real claymorphism system (gradients, soft shadows, custom T-Rex mark) already defined in
  `index.css`. Bring the clay-card/clay-nav tokens into the app shell so the product doesn't feel
  like two different apps.

- [ ] **10. Make issue severity visually loud** — `UI`
  `StatCard`/`SeverityBar` currently differentiate critical vs. low issues with only a small
  colored dot. For a security tool, severity should be readable at a glance — tint the whole card,
  not just a badge.
