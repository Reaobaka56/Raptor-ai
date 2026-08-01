-- BYOK and team join-token support
CREATE TABLE IF NOT EXISTS user_provider_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    key_mask TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_provider_keys_user ON user_provider_keys(user_id);

ALTER TABLE sandbox_sessions ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE sandbox_sessions ADD COLUMN IF NOT EXISTS provider_key_source TEXT NOT NULL DEFAULT 'platform';

ALTER TABLE teams ADD COLUMN IF NOT EXISTS join_token_hash TEXT UNIQUE;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS join_token_created_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_teams_join_token_hash ON teams(join_token_hash);
