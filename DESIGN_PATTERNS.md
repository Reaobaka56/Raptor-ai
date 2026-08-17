# Design Patterns

Structural conventions for new UI work on Raptor. This is about layout, composition, and
component organization — not visual identity. Raptor's existing Tailwind color tokens (zinc
gray palette, editorial typography from the Folk-inspired landing page rebuild) are the source
of truth for color. Nothing here introduces new colors.

## Component structure

Same rule as `AGENTS.md`: one folder per component, co-located tests/hooks/constants, promote
to shared `components/` only when 2+ pages need it. This isn't a style choice — it's what keeps
a solo-founder codebase navigable as it grows past what one person holds in their head.

## Card-based layout discipline

Raptor's landing page work already fixed card-height uniformity and reduced border brightness —
keep extending that discipline to in-app cards (review cards, agent template cards, provider
cards):

- Fixed or min-height cards in a grid, never cards that grow/shrink independently and break
  the row.
- Border weight stays low-contrast; let spacing and typography do the separating work, not a
  bright border.
- One consistent card padding scale across the app — don't let each new card type invent its
  own spacing.

## Typography hierarchy

- One scale, used consistently: a heading scale (h1–h4) and a body scale, not ad hoc font
  sizes per component.
- Editorial feel (per the landing page direction) means generous line-height and restrained
  weight variation — avoid reaching for bold as the default way to add emphasis.

## Scroll-triggered reveal pattern

Already implemented on the landing page. Extend the same `Reveal` component to in-app
long-scroll views (e.g. review history, PR timeline) rather than writing a second animation
system — one reveal implementation, reused.

## Explicitly out of scope here

- Color tokens, palette, dark/light theme values — unchanged, don't touch.
- Logo, iconography style — unchanged.

If a task calls for a new color or theme decision, that's a separate conversation, not a
side-effect of a structural refactor.
