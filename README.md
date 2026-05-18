<div align="center">
  <img src="frontend/public/favicon.svg" alt="Raptor AI Logo" width="120" height="120" />
  <h1> Raptor AI — Autonomous Code Review Engine</h1>
  <p><b>Autonomous inline pull request reviews. Flawless, secure codebases.</b></p>
</div>

---

##  Introduction

**Raptor AI** is a next-generation autonomous static analysis and AI code review platform. Designed for modern engineering organizations, Raptor bridges the gap between traditional regex-bound linters and fully semantic AI agents. 

By integrating directly with your **GitHub Catalog** and utilizing **Google Gemini 1.5 Pro** for deep Abstract Syntax Tree (AST) evaluation, Raptor reads pull request diffs in real-time. It catches critical security vulnerabilities, database performance bottlenecks, and architectural leaks within seconds—providing exact inline diff fixes and opening automated pull requests before code ever reaches production.

---

##  Core Capabilities

###  Semantic Vulnerability Detection
Unlike standard static linters that produce overwhelming false positives based on keyword matching, Raptor understands semantic intent. It actively detects:
- **Authentication & Authorization Bypasses**: Unvalidated route parameters, broken object-level authorization (BOLA), and improper token checks.
- **Injection Vulnerabilities**: SQL injection, command injection, and Cross-Site Scripting (XSS) via unescaped string concatenation.
- **Sensitive Data Exposure**: Unmasked API keys, hardcoded credentials, and leaked PII in logger streams.

###  Database & Performance Profiling
Raptor analyzes query structures and async loop lifecycles across modern ORMs (Prisma, SQLAlchemy, Django ORM, GORM):
- **N+1 Query Detection**: Identifies database access patterns occurring within iterative loops and suggests batched query aggregations.
- **Memory & Resource Leaks**: Highlights unclosed database connections, dangling event listeners, and runaway recursive promises.

###  Autonomous Fix & Pull Request Generation
Raptor does not just report issues; it acts autonomously to resolve them:
- **AI Diff Suggestions**: Generates precise, production-ready replacement blocks formatted exactly to match your existing code style.
- **One-Click Automated Fix PRs**: Clicking "Create Fix PR" automatically creates a patch branch, commits the verified AST fixes, and opens a fully documented Pull Request directly on your GitHub repository.

###  Minimalist CLI-Inspired Design System
- Built on a **pure black** aesthetic (`#000000`) with high-contrast typography and clean borders (`border-white/10`).
- Eliminates visual clutter, popup modals, and ambient noise to provide developers with a lightning-fast, distraction-free review gateway.

---

##  System Architecture

```
React + Vite Frontend ↔ Python FastAPI REST API ↔ GitHub API & Webhooks ↔ Gemini 1.5 Pro
```

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts.
- **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic, Google Generative AI SDK (`gemini-1.5-pro`), Requests.
- **Database & Cache**: PostgreSQL / SQLite for persistent telemetry and review execution caching.

---

##  Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- GitHub Account & OAuth Client Credentials
- Google Gemini API Key

---

### 1. Repository Setup & Configuration

Clone the repository and configure your master `.env` file in the root directory:

```bash
git clone https://github.com/your-org/raptor.git
cd raptor
```

Create or edit your `.env` file with your active keys:

```env
# GitHub Credentials
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# AI Model Configuration
GEMINI_API_KEY=your_google_gemini_api_key
```

Configure your GitHub OAuth app callback URL as `<frontend-origin>/auth/github/callback` (for local development, `http://localhost:5173/auth/github/callback`). During `npm run dev` only, the frontend can also use `GITHUB_TOKEN` through a localhost-only development endpoint so local testing still works while production users continue to authenticate with their own OAuth sessions.

---

### 2. Running the Python FastAPI Backend

Navigate to the backend directory, install the Python dependencies, and start the ASGI server:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend API will run live at `http://localhost:8000`. You can inspect interactive OpenAPI documentation at `http://localhost:8000/docs`.

---

### 3. Running the React Frontend

Open a new terminal session, navigate to the frontend directory, install npm packages, and start the dev server:

```bash
cd frontend
npm install
npm run dev
```

The frontend application will run live at `http://localhost:5173`.

---

##  Gateway Workflows

1. **Connect GitHub Handshake**: Click **Login with GitHub** on the Gateway Dashboard to sync your account profile and active repositories.
2. **Execute AST Scan**: Click **Scan Repository** on any connected repository card to trigger live static AST parsing and Gemini AI vulnerability evaluation.
3. **Review Vulnerability Breakdown**: Inspect precise file locations, line numbers, severity badges (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), and AI diff suggestions.
4. **Generate Fix Pull Request**: Click **Create Fix PR** to automatically branch, commit the corrected diffs, and open a live pull request on GitHub!

---

##  API Reference

| HTTP Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/github/login` | Starts the GitHub OAuth login flow |
| `POST` | `/api/auth/github` | Exchanges a GitHub OAuth code for a per-user session and repository list |
| `GET` | `/api/repos` | Retrieves list of user repositories from GitHub REST API |
| `POST` | `/api/scan` | Executes Gemini 1.5 Pro AST scan on selected repository |
| `GET` | `/api/reviews` | Retrieves paginated scan execution reports |
| `GET` | `/api/reviews/{id}` | Fetches detailed vulnerability list and diff suggestions |
| `POST` | `/api/reviews/{id}/pull-request` | Creates automated fix PR directly on GitHub |
| `GET` | `/api/stats` | Fetches system telemetry and analytics metrics |

---

##  License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
