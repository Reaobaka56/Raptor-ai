-- =============================================================================
-- Feedback-driven suppression of repeat false positives
-- Adds an embedding of the issue's title+description to each feedback row so
-- future scans can check new findings against past thumbs-down feedback in
-- the same repo and suppress (or down-weight) near-duplicate false positives.
-- =============================================================================

ALTER TABLE review_feedback
    ADD COLUMN IF NOT EXISTS repo TEXT,
    ADD COLUMN IF NOT EXISTS issue_title TEXT,
    ADD COLUMN IF NOT EXISTS issue_description TEXT,
    ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE INDEX IF NOT EXISTS idx_review_feedback_vec
    ON review_feedback USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
    WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_feedback_repo
    ON review_feedback (repo);
