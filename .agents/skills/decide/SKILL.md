---
name: decide
description: Walk through design/implementation decisions one at a time before writing code, or review a completed change one step at a time. Use when you say "walk me through the decisions", "let's decide together", or "QA this step by step". Presents concise context, mutually exclusive options, logs each answer, finishes with a summary.
---

# Decide

This exists as a deliberate brake on scope creep — invoke it for anything architecture-shaped
(sandbox isolation, migration strategy, provider abstraction changes) before an agent goes off
and builds the whole thing in one pass.

## Prepare

Before a design walkthrough, inspect the relevant code and record concrete decision points —
don't start asking questions before you've actually looked. Note them in order of dependency
and leverage, not the order they occurred to you.

## Decision walkthrough

For each decision:

1. Show `## Decision N: <title>`.
2. Give 2-4 sentences of context grounded in real files/functions — not abstract.
3. State the trade-off in one sentence.
4. Ask exactly one question with 2-4 mutually exclusive options. Put the recommended option
   first, labeled `(Recommended)`. One sentence per option explaining its trade-off.
5. After the answer: write `Logged: <decision>.` and move to the next one.

If the answer is "sure, whatever you think" without an actual choice, log the recommended
option and note the assumption — don't treat silence as full authorization to expand scope.

At the end: a `| # | Decision | Choice |` table, and offer to turn it into an implementation
plan. Do not write implementation code during the walkthrough itself — decide first, build
after.

## QA walkthrough

For reviewing an existing diff/commit/PR step by step instead of all at once:

1. Identify the review unit (commit, staged diff, PR, explicit file set).
2. Break it into logical steps in dependency order.
3. One step per turn: `## Step N: <title>`, 1-2 sentences on what changed and why, a real code
   excerpt with file/line references, one verdict question — `Looks good, next (Recommended)`,
   `Push back, change this`, or (for non-trivial steps only) `Pause, explain more`.
4. Wait for the verdict before showing the next step.
5. Finish with a `| # | Step | Verdict |` table.

If a QA step surfaces a real design fork (not just a bug), pause and offer to switch to
decision mode for that fork specifically.
