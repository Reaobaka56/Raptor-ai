# Plans

Dated design docs for non-trivial changes, written *before* the work starts, not after.

## Convention

Filename: `YYYYMMDD-short-topic.md` (e.g. `20260817-sandbox-container-isolation.md`).

Write one when a change is architecture-shaped, touches the PR review core loop, or you know
you'll forget the reasoning in a month — not for routine bug fixes or small UI tweaks.

## Minimal structure

```markdown
# <Title>

## Why
1-3 sentences. What's broken or needed, and why now.

## Approach
What you're actually going to do. Specific enough that "future you" could execute it without
re-deriving the reasoning.

## Alternatives considered
Briefly — what else you thought about and why you didn't pick it. This is the part that saves
you from re-litigating the same decision in six months.

## Status
draft | in-progress | done | abandoned
```

Pairs with the `decide` skill (`.agents/skills/decide/SKILL.md`) — run a decision walkthrough
first, then write the plan doc from the logged decisions instead of starting the doc blank.

Move to `plans/done/` once shipped, so the active `plans/` directory only shows what's still
live. Don't delete finished plans — they're the changelog of *why*, not just *what*.
