---
name: redesign
description: Critique and improve the visual design of an existing UI component with concrete implementation guidance. Use when asked to redesign, restyle, reimagine, polish, or improve a component or screen in this React/Tailwind codebase.
---

# Redesign

Inspect the real component and its surrounding layout before proposing changes. Reuse
Raptor's existing design tokens, primitives, and component conventions — see
`DESIGN_PATTERNS.md` for the structural rules (card discipline, typography scale, reveal
pattern).

**Hard rule: never introduce a new color token.** Every color used must already exist in the
current Tailwind config. If a change seems to need a color that isn't there, stop and flag it
as a separate decision — don't invent one inline.

Respond in this order:

1. Identify the component and file being redesigned.
2. Name three concrete issues — hierarchy, spacing, contrast, alignment, responsiveness, or
   affordance. Ground each in what's actually in the code, not a generic critique.
3. Propose specific layout, spacing, and Tailwind class changes for each issue, using only
   existing tokens.
4. Show a short before/after excerpt with only the meaningful class or structure changes.
5. If implementation was requested, make the changes.

Keep the critique concise. Do not invent a new visual language when the repo already has one —
extend the editorial/card-based direction from the landing page, don't diverge from it.
