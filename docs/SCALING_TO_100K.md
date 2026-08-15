# Scaling to 100,000 Users

Current state: a single Docker web service on Render, in-process rate limiting, and a host-level
subprocess sandbox — solid MVP infrastructure, not yet built for concurrent scale. This is a
phased plan to get there.

## Phase 1 — Fix what breaks first (blocking)

These aren't optional at 100k users — the app will fall over or leak without them.

- [ ] **1. Shared, Redis-backed rate limiting**
  `InMemoryRateLimitMiddleware` counts requests per-process. Once you run more than one backend
  instance, limits become inconsistent across replicas. Move counters to Redis (`INCR` + `TTL`)
  so every instance enforces the same limit.

- [ ] **2. Stateless backend instances**
  `state.py` currently holds webhook logs and mock data as in-process Python lists, and the auth
  layer silently falls back to an in-memory session dict if Redis errors. Any of this that's live
  must move fully into Redis/Postgres so any instance can serve any request.

- [ ] **3. Async DB + AI calls**
  The DB layer mixes sync `psycopg2` with async `asyncpg`, and `ai_service.py` calls Gemini and
  fetches diffs synchronously. Blocking calls inside async route handlers stall the whole worker
  under concurrent load — convert to `asyncpg` and async HTTP clients throughout.

- [ ] **4. Contain the sandbox**
  Sandbox sessions run via `subprocess.run()` directly on the host with only policy checks, no
  real isolation. At 100k users this is both a scaling and security problem — one runaway or
  hostile session can degrade the whole host. Move to per-session containers or a managed sandbox
  provider (E2B, Modal, Firecracker).

## Phase 2 — Scale the architecture

Once the app is safely multi-instance, restructure so heavy work doesn't sit on the request path.

- [ ] **5. Horizontal autoscaling**
  `render.yaml` currently declares a single web service with no instance count or autoscaling
  rule. Run 3+ stateless replicas behind a load balancer, autoscaling on CPU/latency.

- [ ] **6. Background job queue**
  PR analysis, embedding generation, and sandbox execution are slow and bursty. Move them off the
  request/response cycle onto a queue (Celery/RQ/Arq + Redis or SQS); the API returns a job id
  immediately and the frontend polls or gets a websocket/webhook update.

- [ ] **7. Database read scaling**
  Add a Postgres read replica once review/analytics reads outweigh writes, and extend the
  existing Redis usage to cache repo metadata and dashboard aggregates instead of hitting
  Postgres on every dashboard load.

- [ ] **8. Index the vector search**
  pgvector similarity search for team memory has no ivfflat/hnsw index yet — it will degrade
  linearly as rows grow. Add the index before it becomes a slow endpoint.

- [ ] **9. Versioned migrations**
  Nine hand-applied SQL files with no rollback path won't hold up with a bigger team touching
  schema. Move to Alembic (or equivalent) with a tracked migrations table.

## Phase 3 — Operate at scale

Once traffic is real, these determine whether you can see problems before users do.

- [ ] **10. Observability**
  Request IDs are already logged (`state.py`), which is a good start — extend this with
  structured logging shipped to a real backend (Datadog/Grafana/CloudWatch), plus error tracking
  (Sentry) and latency/error-rate dashboards per route.

- [ ] **11. Cost control on AI calls**
  Gemini calls are billed per request; at 100k users, uncached/unthrottled analysis calls are the
  single biggest variable cost. Cache repeated diffs, dedupe re-analysis triggers, and set hard
  per-user/per-team quotas on top of the existing rate limiter.

- [ ] **12. CDN for the frontend**
  Serve the built Vite frontend through a CDN (Vercel already does this if deployed there) so
  static asset load doesn't compete with API traffic.

- [ ] **13. Tighten the internal-auth boundary**
  `get_required_github_session` treats a valid internal token and a valid user session as
  interchangeable. At scale, with more endpoints and more contributors, this ambiguity is exactly
  the kind of thing that turns into a privilege-confusion bug — replace it with an explicit
  `is_internal_request` flag.
