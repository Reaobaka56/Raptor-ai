---
name: ticket-format
description: Use when creating or drafting a GitHub issue/ticket in this repo. Defines the canonical three-section structure.
---

# Ticket Format

## Context
2-4 sentences. What's broken or wanted, and why. Outcome-focused, not solution-focused —
describe the problem, not your preferred fix.

## References
Where the ticket came from — an Upwork client message, a user bug report, a production log,
your own notes. Omit this section if there's nothing to link.

| Source | Who | Link/Note | Date |
|--------|-----|-----------|------|
| Production logs | — | Render dashboard, 503 spike | 2026-08-15 |

## Implementation notes
Agent-groomed. Leave empty if there's no codebase context yet — fill in on a later pass. When
filled in, use these sub-headings and skip what doesn't apply:

- `### Files` — `path:line` + why relevant
- `### Approach` — one paragraph
- `### Related code` — similar patterns already in the repo
- `### Gotchas` — constraints, prior incidents (e.g. check `AGENTS.md`'s known-issues list
  before assuming something is new)

Why this matters solo: six months from now you won't remember why you filed a vague ticket.
Context-first, solution-later keeps tickets useful to future-you, not just present-you.
