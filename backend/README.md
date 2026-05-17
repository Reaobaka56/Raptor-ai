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
Set your Gemini API key (optional; if not set, high-fidelity mock analysis is automatically simulated):

```bash
export GEMINI_API_KEY="your_api_key_here"
```

### 3. Run Server
Start the Uvicorn ASGI server:

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. You can view interactive OpenAPI Swagger documentation at `http://localhost:8000/docs`.

## API Endpoints

- `GET /health` — Telemetry health check
- `GET /api/reviews` — Get all paginated reviews
- `GET /api/reviews/{id}` — Get single PR review details and AST breakdown
- `GET /api/stats` — Telemetry statistics for analytics charts
- `POST /api/webhook/github` — Webhook ingestion endpoint for GitHub App
