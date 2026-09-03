-- =============================================================================
-- Raptor AI — OAuth state table (Postgres-backed, replaces Redis oauth state)
-- =============================================================================
-- auth_router.py was still calling get_redis() to store/verify the GitHub
-- OAuth `state` value, left over from before the 010_sessions migration
-- moved session storage off Redis. No Redis service is provisioned on
-- Render, so /api/auth/github/login has been hard-failing with a 503
-- (redis.exceptions.ConnectionError: Connection refused on localhost:6379).
-- This moves OAuth state into the same Postgres DB sessions already use,
-- removing the last Redis dependency from the login path.

CREATE TABLE IF NOT EXISTS oauth_state (
    state       TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_state_expires_at ON oauth_state(expires_at);
