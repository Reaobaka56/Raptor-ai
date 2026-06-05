# Add GitHub Webhook, Inline PR Comments, pgvector Memory Layer, and Related UI/Docs

## Goal
Transform Raptor into a fully‑automated code‑review service by automatically scanning PRs via GitHub webhooks, posting inline review comments, persisting team‑memory with pgvector, adding feedback UI, securing webhook signatures, and improving documentation and business assets.

## User Review Required
- **Critical items** (webhook, inline comments, pgvector) must be implemented before the product can act as an autonomous reviewer.
- Confirm the priority order and any required secrets (e.g., `GITHUB_WEBHOOK_SECRET`).

## Open Questions
1. Public URL for webhook endpoint (e.g., `https://api.raptor.dev/webhook/github`).
2. Value for `GITHUB_WEBHOOK_SECRET` (store in `.env`).
3. Desired pgvector schema – use a single `memory_entries` table with `repo`, `pr_number`, `rule_text`, `embedding VECTOR(1536)`.
4. UI preference for thumbs‑up/down feedback (inline on suggestion cards vs. modal).
5. Do you have branding assets (logo, demo GIF) for README screenshots?
6. Do you want a pricing page route (`/pricing`) now or later?
7. Have you created a GitHub Marketplace developer account for the listing?

## Proposed Changes
### 1️⃣ GitHub Webhook Handler (Critical)
- **Backend**: `backend/app/router/webhook.py`
  - `POST /webhook/github` verifies `X‑Hub‑Signature‑256` using `GITHUB_WEBHOOK_SECRET`.
  - Handles `pull_request` events (`opened`, `synchronize`, `reopened`).
  - Enqueues a background task that calls existing `/scan` endpoint.
  - Logs events to `webhook_logs` table (already in telemetry API).
- **Background**: Use FastAPI `BackgroundTasks` or Celery.

### 2️⃣ Inline PR Review Comments (Critical)
- **Backend**: Extend scan service to return `ReviewIssue` list with file/line/suggestion.
- Add endpoint `POST /reviews/{id}/github-comment` that uses GitHub REST API to create a review (`event: "COMMENT"`).
- Store comment IDs for later updates.
- **Frontend**: After scan completes, automatically call the new endpoint (or show a “Post to GitHub” button).

### 3️⃣ pgvector Memory Layer (Critical)
- **Database Migration**:
  ```sql
  CREATE TABLE memory_entries (
    id SERIAL PRIMARY KEY,
    repo TEXT NOT NULL,
    pr_number INT,
    rule_text TEXT,
    embedding VECTOR(1536),
    created_at TIMESTAMP DEFAULT now()
  );
  ```
- **Backend (`memory_service.py`)**:
  - Functions `add_entry`, `search_similar`.
  - Update `/memory/rules` endpoints to store embeddings when new convention rules are added.
- **Frontend**: New “Memory” tab showing most‑used rules and similarity search UI.

### 4️⃣ Feedback Loop UI (Important)
- Add thumbs‑up/down buttons to each suggestion card in `src/pages/ReviewDetail.tsx`.
- On click, call `memoryApi.submitFeedback` with `thumbs_up` flag.
- Display aggregate feedback stats on the dashboard (`memoryApi.getFeedbackStats`).

### 5️⃣ Webhook Signature Verification (Important)
- Implement HMAC‑SHA256 verification in webhook handler (step 1) and reject with `401` on mismatch.

### 6️⃣ Documentation & Assets (Important)
| File | Action |
|------|--------|
| `README.md` | Insert screenshots/GIF (placeholder image generated via `generate_image`). |
| `CONTRIBUTING.md` | Create contribution guide (linting, testing, PR process). |
| `frontend/src/pages/Pricing.tsx` (new) | Simple pricing page (Free, Professional). |
| `pricing.md` | Docs mirror of pricing page. |
| Delete `Shortcut.lnk` | Remove Windows shortcut from repo. |
| `docs/marketplace.md` | Draft marketplace description and badges. |

### 7️⃣ Tests (Important)
- Add `tests/test_webhook.py` for signature verification.
- Add `tests/test_memory.py` for pgvector insertion & similarity.
- Add `tests/test_github_comment.py` mocking GitHub review API.
- Use `pytest` + `httpx` test client; aim for ≥ 80 % coverage on new modules.

### 8️⃣ Business Assets (Optional)
- Add a simple wait‑list form link on landing page.
- Draft GitHub Marketplace listing (`docs/marketplace.md`).

## Verification Plan
1. **Automated Tests** – Run `pytest -q` and ensure coverage ≥ 80 %.
2. **Local Webhook Simulation** – Use `ngrok` to expose FastAPI, send a fake PR webhook via `curl` and verify:
   - Signature verification passes.
   - Scan job triggers automatically.
   - Inline comment appears on a test repo (personal repo with a test PR).
3. **Memory Layer** – Insert a rule, generate a mock embedding (random vector), query similar entries, and confirm results.
4. **Frontend Feedback** – Click thumbs up/down, ensure API records feedback and UI updates.
5. **Documentation Build** – Run `npm run build` and `uvicorn` to ensure no broken links.

---
*Please review the plan and answer the open questions or confirm you’d like me to proceed.*
### 9️⃣ Mobile Responsive UI Fixes (Important)
- Update `frontend/src/components/Navbar.tsx` (or relevant navbar component) to use a flexbox layout with a hamburger menu for screens < 768px.
- Add responsive CSS (using vanilla CSS or Tailwind if already in project) to stack Hero, Product Screenshot, Problem, Solution, Features, Testimonials, Pricing, FAQ, CTA, Footer vertically on mobile.
- Implement smooth scroll behavior for navigation links and a scroll‑to‑top button.
- Ensure all images use `max-width: 100%` and appropriate `srcset` for retina displays.
- Add micro‑animations on hover for buttons and cards to enhance premium feel.
- Update `Landing.tsx` to use a responsive grid (`grid-cols-1 md:grid-cols-2`) and test on common device widths.
- Verify with Chrome DevTools device toolbar and include screenshots in README.
