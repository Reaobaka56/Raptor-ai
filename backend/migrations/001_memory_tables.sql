-- =============================================================================
-- Raptor Memory Layer — pgvector Schema Migration
-- Run once against your PostgreSQL instance (requires pgvector extension)
-- =============================================================================

-- Enable the pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- 1. Review Embeddings
--    Stores a vector embedding of each completed review (issues + summary)
--    so we can retrieve similar past decisions via cosine similarity.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_embeddings (
    id              SERIAL PRIMARY KEY,
    review_id       TEXT NOT NULL,
    repo            TEXT NOT NULL,
    pr_number       INTEGER NOT NULL,
    issue_titles    TEXT NOT NULL DEFAULT '',       -- concatenated issue titles for display
    summary         TEXT NOT NULL DEFAULT '',       -- review summary text
    embedding       vector(768) NOT NULL,           -- Gemini text-embedding-004 = 768 dims
    accepted        BOOLEAN DEFAULT NULL,           -- NULL = not yet rated
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast ANN lookup on the embedding column
CREATE INDEX IF NOT EXISTS idx_review_embeddings_vec
    ON review_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_review_embeddings_repo
    ON review_embeddings (repo);

-- -----------------------------------------------------------------------------
-- 2. Convention Rules
--    Plain-English team rules stored as embeddings so we can detect violations.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS convention_rules (
    id              SERIAL PRIMARY KEY,
    repo            TEXT NOT NULL DEFAULT '*',      -- '*' = global, or owner/repo
    org             TEXT NOT NULL DEFAULT '*',      -- org-level scoping
    rule_text       TEXT NOT NULL,
    embedding       vector(768) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convention_rules_repo
    ON convention_rules (repo);

-- -----------------------------------------------------------------------------
-- 3. Review Feedback
--    Thumbs up / down per issue to train suppression of false positives.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_feedback (
    id              SERIAL PRIMARY KEY,
    review_id       TEXT NOT NULL,
    issue_index     INTEGER NOT NULL DEFAULT 0,     -- index within the review's issues list
    thumbs_up       BOOLEAN NOT NULL,
    comment         TEXT DEFAULT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_feedback_review
    ON review_feedback (review_id);
