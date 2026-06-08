<div align="center">
  <img src="frontend/public/favicon.svg" alt="Raptor AI Logo" width="120" height="120" />
  <h1>Raptor AI — Autonomous Code Review Engine</h1>
  <p><b>Autonomous inline pull request reviews. Flawless, secure codebases.</b></p>
</div>

---

## Introduction

**Raptor AI** is a next-generation autonomous static analysis and AI code review agent. Designed for modern engineering organizations, Raptor bridges the gap between traditional regex-bound linters and fully semantic AI agents.

By integrating directly with your **GitHub repositories** and utilizing **Google Gemini** for deep Abstract Syntax Tree (AST) evaluation, Raptor reads pull request diffs in real-time. It catches critical security vulnerabilities, database performance bottlenecks, and architectural leaks within seconds — providing exact inline diff fixes and opening automated pull requests before code ever reaches production.

---

## Core Capabilities

### Semantic Vulnerability Detection
Unlike standard static linters that produce overwhelming false positives based on keyword matching, Raptor understands semantic intent. It actively detects:
- **Authentication & Authorization Bypasses**: Unvalidated route parameters, broken object-level authorization (BOLA), and improper token checks.
- **Injection Vulnerabilities**: SQL injection, command injection, and Cross-Site Scripting (XSS) via unescaped string concatenation.
- **Sensitive Data Exposure**: Unmasked API keys, hardcoded credentials, and leaked PII in logger streams.

### Database & Performance Profiling
Raptor analyzes query structures and async loop lifecycles across modern ORMs (Prisma, SQLAlchemy, Django ORM, GORM):
- **N+1 Query Detection**: Identifies database access patterns occurring within iterative loops and suggests batched query aggregations.
- **Memory & Resource Leaks**: Highlights unclosed database connections, dangling event listeners, and runaway recursive promises.

### Autonomous Fix & Pull Request Generation
Raptor does not just report issues — it acts autonomously to resolve them:
- **AI Diff Suggestions**: Generates precise, production-ready replacement blocks formatted to match your existing code style.
- **One-Click Automated Fix PRs**: Clicking "Create Fix PR" automatically creates a patch branch, commits the verified AST fixes, and opens a fully documented Pull Request directly on your GitHub repository.

### Team Memory Layer
Raptor learns your team's conventions over time:
- Stores accepted and rejected review suggestions per repository using pgvector.
- Retrieves relevant past decisions as context for every new PR review.
- Gets smarter the more your team uses it — suppressing false positives specific to your codebase.

### Minimalist CLI-Inspired Design
- Built on a **pure black** aesthetic (`#000000`) with high-contrast typography and clean borders.
- Eliminates visual clutter and popup modals for a lightning-fast, distraction-free review experience.

---

## System Architecture

```
React + Vite Frontend ↔ Python FastAPI REST API ↔ GitHub API & Webhooks ↔ Gemini AI
```

### Architecture Overview
Raptor is split into a lightweight frontend and a modular backend:

- **Frontend**
  - Hosts the user interface and GitHub OAuth flow.
  - Calls backend REST endpoints for scans, reviews, telemetry, and memory management.
  - Receives session tokens and persists the user session on the client.

- **Backend**
  - `backend/app/state.py` initializes the FastAPI app, CORS, middleware, request ID logging, and shared demo state.
  - `backend/app/main.py` registers routers and exposes the health endpoint.
  - `backend/app/auth_router.py` handles GitHub OAuth login and token exchange.
  - `backend/app/scan_router.py` runs repository scan jobs through the AI scan service.
  - `backend/app/reviews_router.py` exposes review retrieval and fix PR creation.
  - `backend/app/telemetry_router.py` serves analytics and review stats.
  - `backend/app/memory_router.py` provides the team memory layer, convention rules, feedback, and RAG search.
  - `backend/app/router/webhook.py` receives GitHub webhook events and schedules async scan jobs.
  - `backend/app/services/` contains the core logic for AI analysis, embeddings, GitHub integration, session storage, and database pooling.

- **Persistence**
  - Redis stores short-lived sessions with sliding TTL.
  - PostgreSQL persists review records, along with pgvector embeddings for semantic search and memory.

- **Security**
  - GitHub OAuth state is signed and validated in cookies.
  - Internal API routes allow bearer tokens and secure session access.
  - CORS origins are explicit and not regex-based.

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic, Google Generative AI SDK
- **Database**: PostgreSQL with pgvector for team memory and review caching

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- GitHub OAuth App credentials
- Google Gemini API key

### 1. Clone & Configure

```bash
git clone https://github.com/Reaobaka56/Raptor-ai.git
cd Raptor-ai
```

Create a `.env` file in the root directory:

```env
# GitHub Credentials
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# AI Model Configuration
GEMINI_API_KEY=your_google_gemini_api_key
```

Set your GitHub OAuth app callback URL to `<frontend-origin>/auth/github/callback`.
For local development: `http://localhost:5173/auth/github/callback`

### 2. Start the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API runs at `http://localhost:8000` — interactive docs available at `http://localhost:8000/docs`.

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

---

## Workflow

1. **Connect GitHub**: Click **Login with GitHub** to sync your account and repositories.
2. **Open a PR**: Raptor automatically triggers on pull request events via webhook.
3. **Review Results**: Inspect file locations, line numbers, and severity badges (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) with AI diff suggestions.
4. **Apply Fix**: Click **Create Fix PR** to automatically branch, commit the corrected diffs, and open a pull request on GitHub.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/github/login` | Starts the GitHub OAuth login flow |
| `POST` | `/api/auth/github` | Exchanges OAuth code for session and repository list |
| `GET` | `/api/repos` | Retrieves repositories from GitHub |
| `POST` | `/api/scan` | Runs AI AST scan on selected repository |
| `GET` | `/api/reviews` | Retrieves paginated scan reports |
| `GET` | `/api/reviews/{id}` | Fetches vulnerability details and diff suggestions |
| `POST` | `/api/reviews/{id}/pull-request` | Creates automated fix PR on GitHub |
| `GET` | `/api/stats` | Fetches telemetry and analytics |

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
