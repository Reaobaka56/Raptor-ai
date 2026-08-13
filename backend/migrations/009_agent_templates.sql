-- =============================================================================
-- Raptor AI — Custom Agent Templates
-- =============================================================================
-- Built-in templates remain hardcoded (see agent_service.AGENT_TEMPLATES).
-- This table holds user-created templates so people can save their own agent
-- configs (role, system prompt, tools, permissions) as reusable starting points.

CREATE TABLE IF NOT EXISTS agent_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'custom',
    description     TEXT,
    system_prompt   TEXT,
    tools           JSONB NOT NULL DEFAULT '[]'::jsonb,
    permissions     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_templates_owner ON agent_templates (owner_id, created_at DESC);

-- Index to support "which agents are attached to this sandbox" lookups —
-- agents.sandbox_id already exists (migration 006) but was never indexed
-- or written to; the drop-agent feature now uses it.
CREATE INDEX IF NOT EXISTS idx_agents_sandbox ON agents (sandbox_id);
