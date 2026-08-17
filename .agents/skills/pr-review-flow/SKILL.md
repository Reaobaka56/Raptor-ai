# PR Review Flow

This is Raptor's core product loop. Treat any change touching this path as high-risk — it's
the thing customers are paying for.

## The path

1. GitHub sends a webhook (PR opened/updated) → `app/router/webhook.py`.
2. Webhook handler validates the signature, enqueues/handles the diff fetch.
3. Diff is fetched via the GitHub API client, chunked, embedded, and upserted into the
   pgvector-backed table for retrieval context.
4. Relevant context (past review comments, related code, repo conventions) is retrieved via
   vector similarity search.
5. LLM call (via the BYOK provider abstraction) generates the review.
6. Review comments are posted back to the PR via the GitHub API.

## Rules when touching this flow

- Never change the webhook signature validation without testing against a real GitHub webhook
  payload — this is the auth boundary for the entire flow.
- Any change to the embedding/chunking step needs to preserve backward compatibility with
  already-embedded rows, or include a backfill migration — don't silently change vector
  dimensions or chunking strategy.
- The provider abstraction (BYOK, Fernet-encrypted keys) supports 10 providers now. New
  provider work goes through the same abstraction — don't special-case a provider inline in a
  router.
- If a step in this path fails, it should fail loudly (logged, ideally surfaced to the user via
  a review-failed state) — not silently drop the PR review. Silent failures here are the worst
  kind of bug for this product.

## When adding a new step to this flow

Write down where it sits in the 1–6 list above and update this file. This flow is the one place
in the repo where "just read the code" is the wrong way to onboard — the code alone doesn't tell
you why signature validation and embedding backward-compat matter.
