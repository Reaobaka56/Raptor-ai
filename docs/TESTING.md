# Testing

```
backend/tests/
├── conftest.py            # `client` fixture (TestClient, no lifespan -> no DB needed)
├── unit/                  # pure logic: no DB, network, Docker or LLM
├── security/              # abuse cases: sandbox env leak, prompt injection, approval, fencing
└── integration/           # real Postgres (skipped unless TEST_DATABASE_URL is set)
    ├── conftest.py        #   `db` fixture: init pool, truncate tables
    └── helpers.py         #   _user(), _session()
frontend/src/**/*.test.tsx # vitest (npm test)
```

| Folder | Speed | Needs | Covers |
|---|---|---|---|
| `unit/` | ms | nothing | agent authorization + tool loop (fake LLM/backend), docker argv flags, diff parser, upload validation, health |
| `security/` | ms | nothing | sandbox env scrubbing/timeouts/loop-blocking, prompt fencing, no-auto-approve, inline-line filtering |
| `integration/` | seconds | Postgres 16 | jsonb codec, agent/task services, atomic claims, tenant isolation, end-to-end task runs through a real sandbox workspace, review persistence + stats scoping |

## Running

```bash
cd backend
pip install -r requirements.txt
pytest                                   # unit + security; integration tests are skipped
pytest tests/unit -q --no-cov            # one folder
pytest -k agent_runtime                  # by name
```

Integration tests need a database with the migrations applied. pgvector is only needed for
migrations 001/014 (the tests don't use vectors); with the `pgvector/pgvector:pg16` image you can
apply everything:

```bash
docker run -d --name raptor-pg -e POSTGRES_HOST_AUTH_METHOD=trust -p 5432:5432 pgvector/pgvector:pg16
export DATABASE_URL=postgresql://postgres@localhost:5432/postgres
python -m scripts.run_migrations
TEST_DATABASE_URL=$DATABASE_URL pytest -m integration
```

Integration tests **TRUNCATE** `users, agents, agent_tasks, reviews, sandbox_sessions ... CASCADE`:
never point `TEST_DATABASE_URL` at a real database.

## CI

`.github/workflows/tests.yml` runs the backend suite against a `pgvector/pgvector:pg16` service
(migrations applied via `scripts/run_migrations`) and the frontend tests on every PR and push to `main`.

## Writing tests

* Put a test where its *dependencies* say: no I/O -> `unit/`; an attack or bypass attempt ->
  `security/` (assert the attack **fails**, and name the test after the attack); needs the DB -> `integration/`
  with `pytestmark = pytest.mark.integration`.
* Tests are `async def` freely (`asyncio_mode = auto`).
* Fake the LLM by monkeypatching `task_router._call_provider` / `ai_service._generate_with_retry`;
  never call real providers.
* New agent tool or permission -> add allowed **and** denied cases (see `unit/test_agent_runtime.py`).
* New migration -> run it against a throw-away DB and confirm the startup runner logs it as applied.
* Bug fix -> add the regression test first; several real bugs in this repo (table name typo, jsonb
  double-encoding, diff parser metadata lines, missing `sandbox_id` in the agent lookup) were found only by integration tests.
