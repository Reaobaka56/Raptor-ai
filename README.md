<div align="center">
  <img src="frontend/public/favicon.svg" alt="Raptor AI Logo" width="120" height="120" />
  <h1>Raptor AI — Code Review Platform </h1>
  <p><b>Autonomous inline pull request reviews. Flawless, secure codebases.</b></p>
</div>

---

## Introduction

**Raptor AI** is a next-generation autonomous static analysis and AI code review agent. Designed for modern engineering organizations, Raptor bridges the gap between traditional regex-bound linters and fully semantic AI agents.

By integrating directly with your **GitHub repositories** and utilizing **Google Gemini** for deep Abstract Syntax Tree (AST) evaluation, Raptor reads pull request diffs in real-time. It catches critical security vulnerabilities, database performance bottlenecks, and architectural leaks within seconds — providing exact inline diff fixes and opening automated pull requests before code ever reaches production.

---

## Core Capabilities

### Semantic Vulnerability Detection
- **Authentication & Authorization Bypasses**: Unvalidated route parameters, broken object-level authorization (BOLA), and improper token checks.
- **Injection Vulnerabilities**: SQL injection, command injection, and Cross-Site Scripting (XSS).
- **Sensitive Data Exposure**: Unmasked API keys, hardcoded credentials, and leaked PII in logger streams.

### Database & Performance Profiling
- **N+1 Query Detection**: Identifies database access patterns occurring within iterative loops.
- **Memory & Resource Leaks**: Highlights unclosed database connections and dangling event listeners.

### Autonomous Fix & Pull Request Generation
- **AI Diff Suggestions**: Generates precise, production-ready replacement blocks.
- **One-Click Automated Fix PRs**: Automatically creates a patch branch, commits fixes, and opens a Pull Request.

### Team Memory Layer
- Stores accepted and rejected review suggestions per repository using pgvector.
- Gets smarter the more your team uses it — suppressing false positives specific to your codebase.

### Secure Agent Sandbox Environments
- **Isolated Execution**: Provision, execute commands, monitor, and teardown containerized sessions.
- **Policy Enforcement**: Blocks access to metadata endpoints and private config paths (`.env`, `.ssh`, `.aws`, `.pem`).
- **Audit Logs**: Full execution history for auditing agent activities.

### BYOK — Bring Your Own Key
- Connect your own **OpenAI**, **Anthropic**, **Gemini**, **Groq**, or **Mistral** API keys.
- Keys encrypted at rest with AES-256; never stored in plaintext.
- Per-agent model selection — route different agents to different providers.

### Team Collaboration
- Role-based team access (`owner`, `admin`, `member`) with join-token invite flow.
- Real-time direct messaging with unread counters.
- Meeting scheduler persisted in PostgreSQL.
- GitHub repository file browser with commit history and diff viewer.

---

## System Architecture

```
React + Vite Frontend ↔ Python FastAPI REST API ↔ GitHub API & Webhooks ↔ AI Providers
```

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic
- **Database**: PostgreSQL with pgvector · Redis (sessions)
- **AI**: Google Gemini (default) · OpenAI · Anthropic · Groq · Mistral (BYOK)

---

## Quick Start (Local)

### Prerequisites
- Python 3.10+, Node.js 18+
- GitHub OAuth App credentials
- Google Gemini API key (or any BYOK provider key)
- PostgreSQL + Redis

### 1. Clone & Configure

```bash
git clone https://github.com/Reaobaka56/Raptor-ai.git
cd Raptor-ai
cp .env.example .env
```

Fill in `.env`:

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GEMINI_API_KEY=your_google_gemini_api_key
DATABASE_URL=postgresql://user:password@localhost:5432/raptor
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-random-32-char-secret
```

### 2. Run Migrations

```bash
psql $DATABASE_URL < backend/migrations/003_users_teams_blog.sql
psql $DATABASE_URL < backend/migrations/004_chat_messages.sql
psql $DATABASE_URL < backend/migrations/005_sandbox.sql
psql $DATABASE_URL < backend/migrations/006_api_keys.sql
psql $DATABASE_URL < backend/migrations/007_join_tokens.sql
```

### 3. Start Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

---

## Deployment — Render (Current Production)

Raptor runs on [Render](https://render.com) with a PostgreSQL database and Redis instance.

| Service | Type | Config |
|---|---|---|
| `raptor-ai` | Web Service (Docker) | Builds from `/backend` |
| `raptor-ai-db` | PostgreSQL | Standard plan |
| `raptor-redis` | Key Value (Redis) | Starter plan |

Set environment variables in Render → Service → Environment:

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=
GEMINI_API_KEY=
DATABASE_URL=          # Use Internal Connection String from Render PostgreSQL
REDIS_URL=             # Use Internal Key Value URL from Render Redis
SECRET_KEY=            # Random 32-char string
BASE_URL=https://your-service.onrender.com
```

Frontend deploys to [Vercel](https://vercel.com) from the `frontend/` directory with `framework: vite`.

---

## Deployment — AWS

### Architecture Overview

```
Route 53 → CloudFront → S3 (frontend)
                      → ALB → ECS Fargate (backend)
                                         → RDS PostgreSQL
                                         → ElastiCache Redis
```

### Prerequisites
- AWS CLI configured (`aws configure`)
- Docker installed
- ECR repository created

### 1. Push Backend Image to ECR

```bash
# Create ECR repository
aws ecr create-repository --repository-name raptor-ai --region us-east-1

# Get login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <your-account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and push
cd backend
docker build -t raptor-ai .
docker tag raptor-ai:latest <your-account-id>.dkr.ecr.us-east-1.amazonaws.com/raptor-ai:latest
docker push <your-account-id>.dkr.ecr.us-east-1.amazonaws.com/raptor-ai:latest
```

### 2. Database — RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier raptor-ai-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15 \
  --master-username raptor \
  --master-user-password <your-db-password> \
  --allocated-storage 20 \
  --no-publicly-accessible \
  --vpc-security-group-ids <your-sg-id> \
  --db-subnet-group-name <your-subnet-group>
```

Run migrations after RDS is available:

```bash
psql postgresql://raptor:<password>@<rds-endpoint>:5432/postgres \
  < backend/migrations/003_users_teams_blog.sql
# Repeat for 004, 005, 006, 007
```

### 3. Cache — ElastiCache Redis

```bash
aws elasticache create-replication-group \
  --replication-group-id raptor-redis \
  --replication-group-description "Raptor AI sessions" \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-clusters 1 \
  --security-group-ids <your-sg-id> \
  --subnet-group-name <your-subnet-group>
```

### 4. Backend — ECS Fargate

Create task definition (`task-definition.json`):

```json
{
  "family": "raptor-ai",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<account>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "raptor-ai",
      "image": "<account>.dkr.ecr.us-east-1.amazonaws.com/raptor-ai:latest",
      "portMappings": [{ "containerPort": 8000, "protocol": "tcp" }],
      "environment": [
        { "name": "DATABASE_URL", "value": "postgresql://raptor:<pass>@<rds-endpoint>:5432/postgres" },
        { "name": "REDIS_URL", "value": "redis://<elasticache-endpoint>:6379/0" },
        { "name": "GITHUB_CLIENT_ID", "value": "<your-value>" },
        { "name": "GITHUB_CLIENT_SECRET", "value": "<your-value>" },
        { "name": "GEMINI_API_KEY", "value": "<your-value>" },
        { "name": "SECRET_KEY", "value": "<random-32-char>" },
        { "name": "BASE_URL", "value": "https://api.yourdomain.com" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/raptor-ai",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

```bash
# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create cluster
aws ecs create-cluster --cluster-name raptor-ai

# Create service
aws ecs create-service \
  --cluster raptor-ai \
  --service-name raptor-api \
  --task-definition raptor-ai \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-id>],securityGroups=[<sg-id>],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=<target-group-arn>,containerName=raptor-ai,containerPort=8000"
```

### 5. Frontend — S3 + CloudFront

```bash
# Build frontend
cd frontend
VITE_API_URL=https://api.yourdomain.com npm run build

# Create S3 bucket
aws s3 mb s3://raptor-ai-frontend-<your-account-id>

# Upload build
aws s3 sync dist/ s3://raptor-ai-frontend-<your-account-id> \
  --delete \
  --cache-control "public,max-age=31536000,immutable"

# Upload index.html with no-cache (for SPA routing)
aws s3 cp dist/index.html s3://raptor-ai-frontend-<your-account-id>/index.html \
  --cache-control "no-cache,no-store,must-revalidate"

# Create CloudFront distribution (point to S3 bucket, add error page: 404 → /index.html → 200)
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json
```

### 6. GitHub Webhook

In your GitHub OAuth App / GitHub App settings, set the webhook URL to:
```
https://api.yourdomain.com/webhook/github
```

Set `GITHUB_WEBHOOK_SECRET` to the same value in your ECS environment.

### 7. CI/CD — GitHub Actions (Auto-deploy to ECS)

Create `.github/workflows/deploy-aws.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, push image
        run: |
          IMAGE_URI=${{ secrets.ECR_REGISTRY }}/raptor-ai:${{ github.sha }}
          docker build -t $IMAGE_URI backend/
          docker push $IMAGE_URI
          echo "IMAGE_URI=$IMAGE_URI" >> $GITHUB_ENV

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster raptor-ai \
            --service raptor-api \
            --force-new-deployment

      - name: Deploy frontend to S3
        run: |
          cd frontend
          npm ci
          VITE_API_URL=https://api.yourdomain.com npm run build
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} \
            --paths "/*"
```

Add these GitHub secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `ECR_REGISTRY`, `S3_BUCKET`, `CF_DISTRIBUTION_ID`.

### Estimated AWS Cost (us-east-1)

| Resource | Spec | Monthly est. |
|---|---|---|
| ECS Fargate | 0.5 vCPU / 1GB | ~$15 |
| RDS PostgreSQL | db.t3.micro | ~$15 |
| ElastiCache Redis | cache.t3.micro | ~$12 |
| S3 + CloudFront | Low traffic | ~$2 |
| ALB | 1 load balancer | ~$16 |
| **Total** | | **~$60/mo** |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/github/login` | Starts GitHub OAuth login |
| `POST` | `/api/auth/github` | Exchanges OAuth code for session |
| `GET` | `/api/repos` | Lists connected repositories |
| `POST` | `/api/scan` | Runs AI review on a repository |
| `GET` | `/api/reviews` | Lists paginated scan reports |
| `POST` | `/api/reviews/{id}/pull-request` | Creates automated fix PR |
| `GET` | `/api/stats` | Fetches analytics |
| `GET` | `/api/sandbox/sessions` | Lists sandbox sessions |
| `POST` | `/api/sandbox/sessions` | Creates a new sandbox |
| `POST` | `/api/sandbox/sessions/{id}/execute` | Runs a command in sandbox |
| `GET` | `/api/sandbox/sessions/{id}/events` | Gets audit log |
| `GET` | `/api/repos/{owner}/{repo}/tree` | File browser |
| `GET` | `/api/repos/{owner}/{repo}/commits` | Commit history |
| `GET` | `/api/teams` | Lists user's teams |
| `POST` | `/api/teams` | Creates a team |
| `POST` | `/api/teams/join` | Joins a team by token |
| `POST` | `/api/teams/{id}/join-token/regenerate` | Regenerates join token |
| `POST` | `/api/teams/{id}/invitations` | Sends an invite |
| `GET` | `/api/chat/conversations` | Lists conversations |
| `POST` | `/api/chat/messages` | Sends a direct message |
| `GET` | `/api/calendar/meetings` | Gets meetings |
| `POST` | `/api/calendar/meetings` | Creates a meeting |
| `GET` | `/api/blog` | Lists blog posts |
| `GET` | `/api/keys` | Lists BYOK API keys |
| `POST` | `/api/keys` | Adds a provider API key |
| `POST` | `/api/keys/{id}/test` | Tests a key validity |
| `GET` | `/api/users/me` | Gets current user profile |

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
