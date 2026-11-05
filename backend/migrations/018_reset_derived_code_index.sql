-- The embedding client previously imported a package that is not installed, so
-- every stored code_chunks vector was a deterministic hash pseudo-embedding
-- (same dimension, no semantic meaning). Embeddings now come from Gemini
-- (gemini-embedding-001, 768-d). code_chunks / code_index_state are derived data
-- (rebuilt from GitHub), so clear them: is_repo_indexed() turns false and the
-- next scan re-indexes each repo with real embeddings.
-- NOT touched: convention_rules / review_embeddings (user-authored memory) -
-- their old vectors stay as-is until re-embedded; see docs/ARCHITECTURE.md.
DO $$
BEGIN
    IF to_regclass('public.code_chunks') IS NOT NULL THEN
        DELETE FROM code_chunks;
    END IF;
    IF to_regclass('public.code_index_state') IS NOT NULL THEN
        DELETE FROM code_index_state;
    END IF;
END$$;
