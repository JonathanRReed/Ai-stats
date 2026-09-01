---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/components/Dashboard.astro","src/pages/compare.astro"]
---

## Scope and mode

Homepage and shared model-selection data presentation. Operate mode.

## Audience and job

AI-literate builders need to move from a task and budget to a defensible shortlist, then inspect the evidence without leaving AI Stats.

## Primary task and proof

Start from a compact task query, return three candidates with price, speed, one native benchmark value, and coverage, then expose source health, quality-versus-price, benchmark coverage, and recent methodology or result changes. Artificial Analysis, Epoch AI, SimpleBench, and PoliBench retain source, observation date, version, unit, and missing-data state.

## Constraints

Preserve the near-black canvas, warm gray type, monospaced measurement labels, muted copper accent, hairline grid, compact navigation, and restrained density of the current site. No opaque universal score. Core use stays free and accountless. Desktop, mobile, keyboard, reduced-motion, loading, error, empty, partial, and stale states must work.

The approved palette anchors are `#0F1114`, `#151719`, `#2C2E31`, warm gray text, muted copper actions, and blue-gray chart marks. Keep the grid hairline and chart accents quiet instead of glowing or decorative.

## Chosen direction

Approved primary comp: `.impeccable/mocks/ai-stats-task-first.png`. Combine its Task First opening with the source-health and graph system from `.impeccable/mocks/ai-stats-overview-first.png`. The memorable moment is a task query resolving into a source-backed three-model shortlist inside the existing grid language.

Implementation medium inventory: all core text, tables, controls, and charts ship as semantic HTML, CSS, SVG, or the existing Chart.js runtime. No generated raster belongs in the shipped product UI.

## Unresolved decisions

Production migration timing, refresh credentials, and external source rate limits remain deployment gates. The repository implementation must preserve legacy tables and static fallbacks until the production readback proves the new observation layer is healthy.
