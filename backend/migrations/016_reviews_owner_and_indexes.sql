-- Reviews ownership (multi-tenant scoping) + vector index fix for code_chunks.

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS repo_owner TEXT;

-- Backfill repo_owner for any pre-existing rows.
UPDATE reviews SET repo_owner = lower(split_part(github_repo, '/', 1)) WHERE repo_owner IS NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_owner_user ON reviews (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_repo_owner ON reviews (repo_owner, created_at DESC);

-- ivfflat indexes built on empty tables have useless centroids and, combined
-- with a WHERE repo = $x filter, return too few rows. HNSW has neither problem.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        BEGIN
            EXECUTE 'DROP INDEX IF EXISTS idx_code_chunks_vec';
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_code_chunks_hnsw ON code_chunks USING hnsw (embedding vector_cosine_ops)';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
END$$;
