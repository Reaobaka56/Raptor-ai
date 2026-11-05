# Backend tests

See [`docs/TESTING.md`](../../docs/TESTING.md) for the full guide.

    pytest                    # unit + security (integration skipped)
    TEST_DATABASE_URL=postgresql://... pytest -m integration

Layout: `unit/` (pure logic) - `security/` (abuse cases) - `integration/` (real Postgres).
`conftest.py` provides `client`, a `TestClient` created without a `with` block so the FastAPI
startup lifespan (DB pool, migrations) never runs.
