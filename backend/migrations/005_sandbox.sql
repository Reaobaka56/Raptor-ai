-- =============================================================================
-- Raptor AI — Agent Sandbox Schema
-- =============================================================================

CREATE TABLE IF NOT EXISTS sandbox_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL DEFAULT 'Untitled Session',
    status          TEXT NOT NULL DEFAULT 'starting',
    -- 'starting' | 'running' | 'stopped' | 'error' | 'timeout'
    agent_type      TEXT NOT NULL DEFAULT 'custom',
    -- 'cursor' | 'claude-code' | 'copilot' | 'codex' | 'custom'
    repo_url        TEXT,
    branch          TEXT,
    workspace_path  TEXT,
    policy          JSONB NOT NULL DEFAULT '{
        "allow_network": true,
        "blocked_domains": ["169.254.169.254", "metadata.google.internal"],
        "blocked_paths": [".env", ".ssh", ".aws", "*.pem", "*.key"],
        "max_file_size_mb": 10,
        "max_session_minutes": 60
    }'::jsonb,
    resource_limits JSONB NOT NULL DEFAULT '{
        "max_memory_mb": 512,
        "max_cpu_percent": 80,
        "max_disk_mb": 1024,
        "max_processes": 20
    }'::jsonb,
    process_pid     INTEGER,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_owner  ON sandbox_sessions (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sandbox_status ON sandbox_sessions (status);

-- Audit log — every command the agent ran
CREATE TABLE IF NOT EXISTS sandbox_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES sandbox_sessions(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL,
    -- 'command' | 'file_write' | 'file_read' | 'network_request'
    -- | 'secret_access' | 'policy_violation' | 'stdout' | 'stderr' | 'system'
    severity    TEXT NOT NULL DEFAULT 'info',
    -- 'info' | 'warning' | 'critical'
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- command events: {cmd, exit_code, duration_ms}
    -- file events:   {path, size_bytes, operation}
    -- network:       {url, method, blocked}
    -- secret_access: {path, blocked}
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_events_session ON sandbox_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sandbox_events_severity ON sandbox_events (session_id, severity);
