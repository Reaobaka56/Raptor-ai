# Raptor AI

Raptor is an AI-powered GitHub PR code review SaaS. React/TypeScript/Vite frontend on Vercel,
FastAPI/Python backend on Render, PostgreSQL + pgvector for embeddings/retrieval.

Any coding agent (Claude Code, Codex, Cursor, etc.) working in this repo should read this file
first. It's the source of truth for conventions that aren't obvious from the code alone.

## Project structure

Backend (`backend/`):
```
backend/
├── app/
│   ├── *_router.py     # FastAPI route modules, one per resource, flat (no routers/ subdir)
│   ├── router/webhook.py  # exception: GitHub webhook handler lives in its own subdir
│   ├── models.py        # pydantic models, single file
│   ├── auth_dependencies.py
│   ├── main.py           # app + router registration
│   └── services/         # business logic, db pool (services/db.py), redis singleton,
│                          # session store, migration runner (services/migrations.py)
├── migrations/            # numbered SQL migrations, applied on startup by
│                            # app/services/migrations.py
└── scripts/run_migrations.py  # standalone CLI entrypoint for the same runner —
                                 # for manual/CI use outside the app process
```

Frontend (`frontend/src/`):

Current state: `pages/` is flat — one `.tsx` file per page (e.g. `pages/Calendar.tsx`,
`pages/Dashboard.tsx`), no per-page subfolders yet. `components/` holds shared pieces used by
2+ pages (e.g. `Layout.tsx`, `ProtectedRoute.tsx`).

Target convention for **new** pages/components, and for refactoring existing ones as they're
touched — don't mass-migrate the whole tree in one pass just to match this:
```
src/
├── pages/
│   └── Dashboard/
│       ├── Dashboard.tsx
│       ├── Dashboard.test.tsx     # co-located tests
│       ├── index.ts               # barrel export
│       ├── components/            # used only inside Dashboard
│       │   └── ReviewCard/
│       │       ├── ReviewCard.tsx
│       │       ├── index.ts
│       │       └── constants.ts
│       ├── hooks/                 # hooks used only in Dashboard
│       └── utils/
└── components/                    # used in 2+ pages (last resort, not first)
```

Rules:
1. One folder per component: `ComponentName/ComponentName.tsx` + `index.ts` barrel export.
2. Co-locate by usage — nest under the parent that uses it. Promote to a shared `components/`
   only when 2+ unrelated pages need it, and promote to the *highest shared parent*, not straight
   to root.
3. One component per file. No multi-component files.
4. Co-locate hooks/utils/constants/tests next to the file that uses them, not in a global
   `utils/` dumping ground.

## Database

Numbered SQL migrations in `backend/migrations/`, applied by the startup migration runner —
never hand-run SQL against production. Follow `.agents/skills/db-migrations/SKILL.md` before
writing or renumbering a migration. Never edit an already-applied migration file; add a new one.

## Sandbox / agent execution

The sandbox currently shells out via bare `subprocess.run()` — no real container isolation yet.
Treat anything that touches the sandbox as untrusted-input-adjacent. Read
`.agents/skills/sandbox-safety/SKILL.md` before adding new sandbox endpoints.

## PR review flow

Core product loop: GitHub webhook → fetch diff → chunk/embed via pgvector → LLM review → post
comments back via GitHub API. See `.agents/skills/pr-review-flow/SKILL.md` for the exact path
through routers/services when touching this flow — it's the part that must not silently break.

## Known open issues (check before "fixing" these as if new)

- LLM/GitHub API calls are still sync HTTP clients, not async — on the list, not yet done.
- Sandbox has no real container isolation (see above).
- `memory_router.py`'s `get_required_github_session()` call outside `Depends()` — already
  patched, checked into `app/memory_router.py`. Don't re-flag it as new.

## Releases

Frontend deploys to Vercel on merge to main. Backend deploys to Render on merge to main. No
canary/staging split yet — see `.github/workflows/deploy-preview.yml` for the PR-preview setup
that's meant to catch issues before they hit either of those.

## Further reading

- `.agents/skills/`: db-migrations, pr-review-flow, sandbox-safety, ticket-format, decide.
  Read the matching SKILL.md when a task fits its description.
- `.agents/skills/decide/SKILL.md`: invoke deliberately before any architecture-shaped change
  (sandbox isolation, migration strategy, provider abstraction) — walks decisions one at a
  time instead of an agent building the whole thing in one unreviewed pass.
- `.github/workflows/triage-issue.yml`: auto-triages new GitHub issues via Claude Code.
  Read-only tools, no shell, no GitHub token on the analysis step — issue bodies are
  untrusted input.
- `DESIGN_PATTERNS.md`: structural/layout conventions for new UI. No color tokens in here —
  those live in the existing Tailwind config, don't invent new ones ad hoc.
