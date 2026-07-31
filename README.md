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

### Secure Agent Sandbox Environments
Raptor provides isolated runtime containers for executing agent workflows and safe CLI simulation:
- **Dynamic Container Lifecycles**: Provision, execute commands, monitor, and teardown containerized sessions.
- **Strict Policy Constraints**: Prevents data exfiltration by blocking access to local metadata endpoints and private configuration paths (e.g., `.env`, `.ssh`, `.aws`, `.pem`).
- **Tiered Resource Allocations**: Dynamic resource limits capping CPU usage, memory thresholds, disk storage, and max concurrent processes per user tier.
- **Audit Logs & Telemetry**: Full execution history and resource utilization streams for auditing agent activities.

### Team Collaboration & Organization Management
Raptor integrates essential developer workflow features directly into the platform:
- **Role-based Team Access**: Create teams, manage members with role hierarchies (`owner`, `admin`, `member`), and handle invite lifecycle flows.
- **Real-Time Direct Messaging**: DB-persisted user-to-user chat with unread counters and conversation thread histories.
- **Meeting Scheduler & Calendar**: Schedule and manage meetings, persisted directly via PostgreSQL JSONB data storage.
- **Technical Blog System**: Support for drafting and publishing engineering posts, complete with admin-guarded CRUD controls.
- **GitHub Repository File Browser**: Browse branches, file tree directories, decode code files, and inspect commit diffs natively in the UI.

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
  - `backend/app/sandbox_router.py` exposes agent sandbox session and execution controls.
  - `backend/app/repo_router.py` provides GitHub integration for browsing files, commits, and branches.
  - `backend/app/team_router.py` manages organization teams, member hierarchies, and invitations.
  - `backend/app/chat_router.py` powers database-persisted direct user messaging.
  - `backend/app/calendar_router.py` handles meeting coordination persisted via Postgres JSONB.
  - `backend/app/blog_router.py` allows public reading and admin CRUD of engineering blog posts.
  - `backend/app/user_router.py` retrieves logged-in profiles and manages admin status checks.
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
| `GET` | `/api/sandbox/sessions` | Lists active sandbox sessions |
| `POST` | `/api/sandbox/sessions` | Spawns a new secure sandbox container with policy constraints |
| `GET` | `/api/sandbox/sessions/{session_id}` | Retrieves sandbox session details and limits |
| `DELETE` | `/api/sandbox/sessions/{session_id}` | Stops and destroys the sandbox environment |
| `POST` | `/api/sandbox/sessions/{session_id}/execute` | Executes commands inside the sandbox |
| `GET` | `/api/sandbox/sessions/{session_id}/events` | Fetches terminal audit logs and outputs |
| `GET` | `/api/sandbox/sessions/{session_id}/stats` | Monitors CPU, memory, and disk usage |
| `GET` | `/api/repos/{owner}/{repo}/tree` | Retrieves repository file explorer tree |
| `GET` | `/api/repos/{owner}/{repo}/file` | Fetches base64 decoded file contents |
| `GET` | `/api/repos/{owner}/{repo}/commits` | Retrieves paginated commit list |
| `GET` | `/api/repos/{owner}/{repo}/branches` | Retrieves list of branches |
| `GET` | `/api/teams` | Lists all teams the current user belongs to |
| `POST` | `/api/teams` | Creates a new team (assigns creator as Owner) |
| `GET` | `/api/teams/{team_id}` | Retrieves team details and member list |
| `POST` | `/api/teams/{team_id}/members` | Adds a user to the team directly (Admin/Owner only) |
| `DELETE` | `/api/teams/{team_id}/members/{username}` | Kicks a member from the team (Admin/Owner only) |
| `POST` | `/api/teams/{team_id}/invitations` | Invites a member via email or GitHub username |
| `POST` | `/api/teams/invitations/{token}/accept` | Accepts an invitation and joins the team |
| `GET` | `/api/chat/conversations` | Lists user's direct message conversations |
| `GET` | `/api/chat/messages/{username}` | Fetches message thread with another user |
| `POST` | `/api/chat/messages` | Sends a direct message to a user |
| `GET` | `/api/chat/unread-count` | Checks total unread direct message count |
| `GET` | `/api/calendar/meetings` | Retrieves user's scheduled calendar meetings |
| `PUT` | `/api/calendar/meetings` | Saves/Updates user's meeting schedules |
| `GET` | `/api/blog` | Lists published blog posts (and drafts for Admin) |
| `POST` | `/api/blog` | Creates a new blog post (Admin only) |
| `PATCH` | `/api/blog/{slug}` | Modifies a blog post (Admin only) |
| `DELETE` | `/api/blog/{slug}` | Deletes a blog post (Admin only) |
| `GET` | `/api/users/me` | Retrieves profile of currently logged-in user |
| `GET` | `/api/users/me/is-admin` | Checks if current user has Admin privileges |

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
