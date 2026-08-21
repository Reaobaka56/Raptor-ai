-- =============================================================================
-- Raptor AI — Team Tasks, Team Meetings, Raptor Bot, Blog Media
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. RAPTOR BOT — a real users row so it can send chat messages through the
--    existing chat_messages table like any other user. github_id -1 is a
--    reserved sentinel (real GitHub IDs are always positive).
-- ---------------------------------------------------------------------------
INSERT INTO users (github_id, username, name, role, account_status)
VALUES (-1, 'raptor-bot', 'Raptor', 'bot', 'active')
ON CONFLICT (github_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. TEAM TASKS — human-assignable to-dos scoped to a team. Deliberately a
--    separate table from agent_tasks: agent_tasks is the AI-agent execution
--    model (LLM prompts, tool permissions, sandbox runs); team_tasks is a
--    plain human to-do assigned to one or more team members.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    priority    INTEGER NOT NULL DEFAULT 2, -- 0 critical .. 3 low
    assign_mode TEXT NOT NULL DEFAULT 'individual', -- 'individual' | 'everyone'
    status      TEXT NOT NULL DEFAULT 'open', -- 'open' | 'done'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_tasks_team ON team_tasks (team_id, created_at DESC);

-- One row per assignee, whether the task was assigned to one person or to
-- everyone on the team — this lets each assignee independently complete
-- their own copy and keeps "who's done" queryable without parsing JSON.
CREATE TABLE IF NOT EXISTS team_task_assignees (
    task_id      UUID NOT NULL REFERENCES team_tasks(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_task_assignees_user ON team_task_assignees (user_id);

-- ---------------------------------------------------------------------------
-- 3. TEAM MEETINGS — shared entity with real attendee rows, replacing the
--    old per-user private JSONB `users.meetings` column (which had no way
--    to notify or restrict attendees). The JSONB column is left in place
--    (unused) rather than dropped, so no data is destroyed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meetings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    date        TEXT NOT NULL,   -- ISO date, kept as text to match existing frontend format
    time        TEXT NOT NULL,   -- e.g. "14:00"
    duration    INTEGER NOT NULL DEFAULT 30,
    type        TEXT NOT NULL DEFAULT 'meeting',
    link        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_team ON meetings (team_id, date);

CREATE TABLE IF NOT EXISTS meeting_attendees (
    meeting_id  UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'invited', -- 'invited' | 'accepted' | 'declined'
    PRIMARY KEY (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_attendees_user ON meeting_attendees (user_id);

-- ---------------------------------------------------------------------------
-- 4. BLOG MEDIA — image/video attachments per post.
-- ---------------------------------------------------------------------------
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 5. CONVENTION RULES — tag rules by what they're for, so the AI Memory UI
--    can explain *why* each one is remembered instead of showing one
--    undifferentiated list.
-- ---------------------------------------------------------------------------
ALTER TABLE convention_rules ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'coding';
-- category: 'coding' (conventions/patterns) | 'workflow' (how the team works)
--         | 'agent' (persistent instructions for agent execution)
