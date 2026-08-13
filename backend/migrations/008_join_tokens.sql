-- =============================================================================
-- Raptor AI — Team Join Tokens
-- =============================================================================
-- Adds the hashed join-token columns used by team_service.py's
-- join_team_by_token / ensure_join_token flow (previously patched in at
-- runtime via ensure_team_token_columns()).

ALTER TABLE teams ADD COLUMN IF NOT EXISTS join_token_hash TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS join_token_created_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_join_token_hash
    ON teams(join_token_hash)
    WHERE join_token_hash IS NOT NULL;
