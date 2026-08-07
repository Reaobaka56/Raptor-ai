-- =============================================================================
-- Raptor AI — Multi-Agent System Schema
-- =============================================================================

-- ── Agents ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'custom',
    -- built-in roles: 'ui_ux', 'software_engineer', 'project_manager',
    -- 'qa_tester', 'security', 'devops', 'database', 'documentation',
    -- 'code_review', 'research', 'custom'
    description     TEXT,
    system_prompt   TEXT,
    model           TEXT NOT NULL DEFAULT 'gemini-2.5-pro',
    -- model identifier: 'gemini-2.5-pro', 'gpt-4o', 'claude-sonnet-4', etc.
    provider        TEXT NOT NULL DEFAULT 'google',
    -- 'google', 'openai', 'anthropic', 'local', 'custom'
    tools           JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- e.g. ["file_read", "file_write", "command_exec", "git_ops",
    --        "network", "install_deps", "run_tests", "lint", "build"]
    permissions     JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- e.g. {"can_commit": false, "can_push": false, "requires_approval": true,
    --        "max_file_changes": 20, "allowed_paths": ["src/"], "blocked_paths": [".env"]}
    status          TEXT NOT NULL DEFAULT 'idle',
    -- 'idle' | 'planning' | 'working' | 'waiting' | 'reviewing' | 'completed' | 'failed' | 'paused'
    sandbox_id      UUID REFERENCES sandbox_sessions(id) ON DELETE SET NULL,
    current_task_id UUID,  -- FK added after agent_tasks table is created
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- arbitrary config: temperature, max_tokens, context_window, etc.
    knowledge_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- references to knowledge_sources IDs
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents (role);

-- ── Agent Tasks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    priority        INTEGER NOT NULL DEFAULT 2,
    -- 0 = critical, 1 = high, 2 = medium, 3 = low
    status          TEXT NOT NULL DEFAULT 'backlog',
    -- 'backlog' | 'assigned' | 'in_progress' | 'review' | 'done' | 'failed' | 'blocked'
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    parent_task_id  UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    dependencies    JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- array of task UUIDs that must complete before this task can start
    input_context   TEXT,
    output          TEXT,
    logs            JSONB NOT NULL DEFAULT '[]'::jsonb,
    errors          JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_status   TEXT DEFAULT 'pending',
    -- 'pending' | 'approved' | 'rejected' | 'needs_changes'
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Now add the FK from agents.current_task_id → agent_tasks.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_agents_current_task'
    ) THEN
        ALTER TABLE agents
            ADD CONSTRAINT fk_agents_current_task
            FOREIGN KEY (current_task_id) REFERENCES agent_tasks(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_owner ON agent_tasks (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON agent_tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON agent_tasks (assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON agent_tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON agent_tasks (priority, status);

-- ── Agent Messages (inter-agent communication) ───────────────────────────────
CREATE TABLE IF NOT EXISTS agent_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_agent_id   UUID REFERENCES agents(id) ON DELETE SET NULL,
    to_agent_id     UUID REFERENCES agents(id) ON DELETE SET NULL,
    -- NULL from_agent_id = message from user/system
    -- NULL to_agent_id   = broadcast to all agents
    message_type    TEXT NOT NULL DEFAULT 'general',
    -- 'task_update' | 'request_info' | 'report_complete' | 'report_blocker'
    -- | 'request_review' | 'submit_changes' | 'feedback' | 'general' | 'system'
    content         TEXT NOT NULL,
    task_id         UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    read            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages (to_agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_from ON agent_messages (from_agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_task ON agent_messages (task_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_owner ON agent_messages (owner_id, created_at DESC);

-- ── Agent Activity Log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_activity_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
    activity_type   TEXT NOT NULL,
    -- 'status_change' | 'task_assigned' | 'task_completed' | 'file_modified'
    -- | 'command_run' | 'message_sent' | 'review_submitted' | 'error' | 'system'
    description     TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_owner ON agent_activity_log (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity_log (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON agent_activity_log (activity_type);

-- ── Sandbox enhancements ──────────────────────────────────────────────────────
-- Add new columns to sandbox_sessions if they don't exist

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sandbox_sessions' AND column_name = 'agent_id') THEN
        ALTER TABLE sandbox_sessions ADD COLUMN agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sandbox_sessions' AND column_name = 'environment_vars') THEN
        ALTER TABLE sandbox_sessions ADD COLUMN environment_vars JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sandbox_sessions' AND column_name = 'api_key_refs') THEN
        ALTER TABLE sandbox_sessions ADD COLUMN api_key_refs JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sandbox_sessions' AND column_name = 'network_policy') THEN
        ALTER TABLE sandbox_sessions ADD COLUMN network_policy JSONB NOT NULL DEFAULT '{"allow": true}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sandbox_sessions' AND column_name = 'filesystem_permissions') THEN
        ALTER TABLE sandbox_sessions ADD COLUMN filesystem_permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sandbox_sessions' AND column_name = 'tool_permissions') THEN
        ALTER TABLE sandbox_sessions ADD COLUMN tool_permissions JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sandbox_sessions' AND column_name = 'paused_at') THEN
        ALTER TABLE sandbox_sessions ADD COLUMN paused_at TIMESTAMPTZ;
    END IF;
END $$;

-- Allow 'paused' status in sandbox_sessions
-- (no CHECK constraint exists, status is just TEXT, so this is a no-op — documented for clarity)
