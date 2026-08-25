-- =============================================================================
-- Repo-wide code index for cross-file review context
-- Stores chunked + embedded file contents per repo so PR reviews can retrieve
-- semantically related code elsewhere in the repo, not just the diff itself.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS code_chunks (
    id              SERIAL PRIMARY KEY,
    repo            TEXT NOT NULL,               -- owner/repo
    file_path       TEXT NOT NULL,
    chunk_index     INTEGER NOT NULL DEFAULT 0,   -- position within the file
    content         TEXT NOT NULL,
    content_hash    TEXT NOT NULL,                -- sha256 of content, for cheap re-index skip
    embedding       vector(768) NOT NULL,
    indexed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_chunks_vec
    ON code_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_code_chunks_repo
    ON code_chunks (repo);

-- One row per (repo, file_path, chunk_index) — re-indexing a file replaces its chunks.
CREATE UNIQUE INDEX IF NOT EXISTS idx_code_chunks_repo_file_chunk
    ON code_chunks (repo, file_path, chunk_index);

-- Tracks the last commit SHA indexed per repo so we know when a re-index is needed.
CREATE TABLE IF NOT EXISTS code_index_state (
    repo            TEXT PRIMARY KEY,
    last_indexed_sha TEXT,
    file_count      INTEGER NOT NULL DEFAULT 0,
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
