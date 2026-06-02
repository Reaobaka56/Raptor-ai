# Raptor Python AI Code Review Backend

This is the high-performance Python FastAPI backend for **Raptor** — the autonomous AI code review platform.

## Features
- **FastAPI Core**: Asynchronous API endpoints with automatic OpenAPI documentation.
- **Gemini 2.5 Pro Integration**: Uses Google Generative AI for deep AST analysis and inline diff generation.
- **GitHub Webhook Ingestion**: Background task processing for Pull Request events (`opened`, `synchronize`).
- **Telemetry & Stats**: Live metrics calculation for dashboard visualization.

## Getting Started

### 1. Install Dependencies
Make sure you have Python 3.10+ installed.

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment
Set your Gemini API key for live model analysis. If it is not set, scans still use the actual GitHub diff, but only deterministic local security rules run:

```bash
export GEMINI_API_KEY="your_api_key_here"
export GEMINI_MODEL="gemini-2.5-pro"
export GITHUB_TOKEN="optional_pat_for_authenticated_scans"
export VITE_GITHUB_REDIRECT_URI="https://raptor-agent.vercel.app/api/auth/github/callback"
export RATE_LIMIT_GLOBAL_MAX=300
export RATE_LIMIT_GLOBAL_WINDOW_SECONDS=900
export RATE_LIMIT_SCAN_MAX=10
export RATE_LIMIT_SCAN_WINDOW_SECONDS=3600
```

### 3. Run Server
Start the Uvicorn ASGI server:

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. You can view interactive OpenAPI Swagger documentation at `http://localhost:8000/docs`.

GitHub OAuth login uses `/api/auth/github/callback` by default, which must match the callback URL registered on the GitHub OAuth App/GitHub App (for example, `https://raptor-agent.vercel.app/api/auth/github/callback`).

Repository scans use authenticated GitHub requests when a user is connected, when `GITHUB_TOKEN`/`GITHUB_PAT` is configured, or when the GitHub App can issue an installation token. This avoids the low unauthenticated GitHub API quota that can leave Total Reviews at zero because scans fail before a review is stored.

Rate limiting is enabled for every backend route. Responses include `X-RateLimit-*` headers, and expensive routes such as scans, debug solves, onboarding generation, similar-review search, and remediation PR creation have stricter route-specific limits.

## API Endpoints

- `GET /health` — Telemetry health check
- `GET /api/reviews` — Get all paginated reviews
- `GET /api/reviews/{id}` — Get single PR review details and AST breakdown
- `GET /api/stats` — Telemetry statistics for analytics charts
- `POST /api/scan` — Fetch the latest open PR (or a supplied GitHub PR URL) and analyze its real diff with Gemini
- `POST /api/reviews/{id}/pull-request` — Create a real remediation PR through the installed GitHub App
