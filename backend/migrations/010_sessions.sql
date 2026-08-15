-- =============================================================================
-- Raptor AI — Sessions table (Postgres-backed, replaces Redis session store)
-- =============================================================================
-- Redis was made a hard requirement for login in the rate-limit/session-state
-- migration (fail closed on save_session/get_session errors instead of
-- degraded per-instance state). That's the right failure mode, but it means
-- login is now coupled to Redis being provisioned and reachable, which isn't
-- guaranteed on every environment. Sessions move to Postgres — same DB
-- sign-in already depends on for the users table — so there's one fewer
-- external dependency in the login path. Redis stays in use for rate
-- limiting (fails open) and the webhook log (non-critical).

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    data        JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
