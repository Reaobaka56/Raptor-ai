-- =============================================================================
-- Reviews table + pgvector HNSW indexes
-- =============================================================================

-- Reviews master table (use UUID primary keys)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_repo TEXT NOT NULL,
    pr_number INTEGER NOT NULL,
    pr_title TEXT,
    pr_url TEXT,
    fix_pr_number INTEGER,
    fix_pr_url TEXT,
    issues JSONB NOT NULL DEFAULT '[]',
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    review_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_github_repo ON reviews (github_repo);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews (created_at DESC);

-- Add HNSW indexes for vector similarity (if pgvector installed)
-- Also add HNSW on convention_rules and review_embeddings for faster ANN
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') THEN
        BEGIN
            EXECUTE 'DROP INDEX IF EXISTS idx_review_embeddings_vec';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
        BEGIN
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_review_embeddings_hnsw ON review_embeddings USING hnsw (embedding vector_cosine_ops)';
        EXCEPTION WHEN OTHERS THEN
            -- ignore
            NULL;
        END;
        BEGIN
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_convention_rules_hnsw ON convention_rules USING hnsw (embedding vector_cosine_ops)';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
END$$;
