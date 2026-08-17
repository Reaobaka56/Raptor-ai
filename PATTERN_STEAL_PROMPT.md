# Pattern-Steal Prompt (for Claude Code, run locally)

Use this when you want to pull engineering/tooling patterns from a reference repo into Raptor
without copying its branding, colors, or proprietary product code — just structure and practice.

## Prerequisites

Both repos checked out locally, e.g.:
```
~/code/raptor-ai/          # your repo, working tree clean
~/code/reference-repo/     # the repo you're stealing patterns from
```

## The prompt

```
I want to adapt engineering patterns from a reference repo into Raptor without copying its
branding, visual identity, or product-specific code.

Reference repo: ~/code/reference-repo
Target repo: ~/code/raptor-ai (this is the one you'll actually edit)

Raptor's stack: React/TypeScript/Vite frontend (Vercel), FastAPI/Python backend (Render),
PostgreSQL + pgvector.

Do this:

1. Read ~/code/reference-repo's root-level docs (README, any AGENTS.md/CLAUDE.md-style file,
   CONTRIBUTING.md) and list its CI/CD workflows, monorepo tooling, and any agent-tooling
   directories (.agents/, .claude/, skills folders) — just an inventory, don't change anything
   yet.

2. For each thing you find, classify it as one of:
   - STEAL AS-IS: generic engineering practice, no adaptation needed (e.g. a lint script)
   - ADAPT: same idea, needs rewriting for our stack (e.g. their Vercel+Turborepo preview
     deploy → our Vercel+Render preview deploy)
   - SKIP: specific to their product, their infra scale, or their visual identity

3. For anything in ADAPT, ground it in Raptor's actual code before writing anything — read
   the real file paths, the real migration runner, the real router structure. Do not invent
   file paths that don't exist in our repo.

4. Hard constraint: do not introduce any new color values, hex codes, or theme tokens from the
   reference repo. If a design pattern requires a color decision, stop and ask me instead of
   picking one.

5. Write your findings as a plan first — a plans/YYYYMMDD-steal-<topic>.md file per
   plans/README.md's format — before touching any other files. Wait for my go-ahead on the
   plan before implementing.

6. Once approved, implement only what's in the approved plan. Update AGENTS.md's "Further
   reading" list if you add new skills or docs so future agent sessions actually find them.
```

## Why this shape

- Forces an inventory-then-classify pass instead of an agent grabbing everything indiscriminately
  — you already have the scope-creep pattern flagged, this prompt is a guard against it.
- The plan-first step means you review before code changes land, not after.
- The explicit no-colors constraint is stated as a hard stop, not a preference, so the agent
  halts and asks rather than silently picking something close enough.

## Variant: point it at THIS conversation's output instead of a fresh repo

If you want Claude Code to pick up where this chat left off (rather than re-deriving from the
reference repo), skip step 1-2 and just say:

```
I already have an adapted kit at ~/Downloads/raptor-agent-kit — review it against my actual
repo structure, flag anything that references a file path that doesn't exist in raptor-ai, fix
those paths, then apply it as a PR branch following the same plan-first process above.
```
