-- =============================================================================
-- Raptor AI — Users, Teams & Blog Schema Migration
-- Run once against your PostgreSQL instance
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. USERS
--    One record per GitHub account, upserted on every login.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id       BIGINT UNIQUE NOT NULL,         -- GitHub numeric user ID
    username        TEXT UNIQUE NOT NULL,            -- GitHub login handle
    name            TEXT,
    email           TEXT,
    avatar_url      TEXT,
    role            TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
    account_status  TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_github_id  ON users (github_id);
CREATE INDEX IF NOT EXISTS idx_users_username   ON users (username);

-- Seed admin account (update on conflict in case record already exists)
INSERT INTO users (github_id, username, role)
VALUES (0, 'reaobaka56', 'admin')
ON CONFLICT (username) DO UPDATE SET role = 'admin';

-- ---------------------------------------------------------------------------
-- 2. TEAMS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,               -- URL-safe lowercase name
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams (owner_id);

-- ---------------------------------------------------------------------------
-- 3. TEAM MEMBERS (join table with roles)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member',     -- 'owner' | 'admin' | 'member'
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);

-- ---------------------------------------------------------------------------
-- 4. TEAM INVITATIONS
--    Email or GitHub-username based, with expiry and secure token.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_invitations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    invited_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_token    TEXT UNIQUE NOT NULL,           -- secure random token in URL
    invitee_email   TEXT,                           -- email invite target
    invitee_github  TEXT,                           -- GitHub username invite target
    role            TEXT NOT NULL DEFAULT 'member',
    status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined' | 'expired'
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_team  ON team_invitations (team_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON team_invitations (invite_token);

-- ---------------------------------------------------------------------------
-- 5. BLOG POSTS
--    Admin-only creation; public read when published.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID NOT NULL REFERENCES users(id),
    slug            TEXT UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    summary         TEXT,
    content         TEXT NOT NULL DEFAULT '',
    featured_image  TEXT,                           -- URL to image
    category        TEXT NOT NULL DEFAULT 'Engineering',
    published       BOOLEAN NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug      ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts (published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author    ON blog_posts (author_id);

-- Seed the three existing blog posts (hardcoded in frontend) as real DB records
-- Author will be set to the admin user once the admin logs in and their UUID is known.
-- For now we insert them without an author_id using a DO block to avoid FK violation.
DO $$
DECLARE
    admin_uuid UUID;
BEGIN
    SELECT id INTO admin_uuid FROM users WHERE username = 'reaobaka56' LIMIT 1;
    IF admin_uuid IS NOT NULL THEN
        INSERT INTO blog_posts (author_id, slug, title, summary, category, published, published_at)
        VALUES
        (admin_uuid,
         'how-raptor-catches-complex-sql-injections',
         'How Raptor Catches Complex SQL Injections in ASTs',
         'Traditional static analysis linters produce high false-positive rates. Learn how Raptor combines AST parsing with LLM context to spot hidden SQL vulnerabilities across file boundaries.',
         'Engineering', TRUE, '2026-05-14 00:00:00+00'),
        (admin_uuid,
         'eliminating-n-plus-1-queries-prisma-typeorm',
         'Eliminating N+1 Queries in Prisma and TypeORM Automatically',
         'N+1 database queries silently destroy production API throughput. Here is how Raptor spots loop-based database calls during the Pull Request lifecycle and writes the batch fix for you.',
         'Performance', TRUE, '2026-04-28 00:00:00+00'),
        (admin_uuid,
         'evolution-of-autonomous-code-reviews',
         'The Evolution of Autonomous Code Reviews',
         'Why engineering teams are moving away from manual nitpicking and letting AI handle security guardrails and style guides directly inside GitHub.',
         'Productivity', TRUE, '2026-04-12 00:00:00+00')
        ON CONFLICT (slug) DO NOTHING;
    END IF;
END$$;
