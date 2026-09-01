---
name: AI Stats
description: A calibrated, source-backed console for comparing AI model capability, cost, speed, and evidence quality.
colors:
  measurement-black: "#090b0d"
  console-surface: "#101417"
  raised-surface: "#171d20"
  intelligence-base: "#0f1114"
  intelligence-surface: "#151719"
  grid-hairline: "#2c2e31"
  warm-paper: "#f2f1ea"
  supporting-copy: "#c5cbc8"
  muted-reading: "#858d90"
  action-copper: "#d86d4a"
  intelligence-copper: "#c6764d"
  plot-blue: "#668796"
  evidence-green: "#89c8b6"
  caution-gold: "#d0a85a"
typography:
  display:
    fontFamily: "Geist, Nebula Sans, Arial Narrow, Helvetica Neue, sans-serif"
    fontSize: "clamp(2.25rem, 7vw, 4.9rem)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, Nebula Sans, Arial Narrow, Helvetica Neue, sans-serif"
    fontSize: "clamp(1rem, 2vw, 1.35rem)"
    fontWeight: 700
    lineHeight: 1.1
  body:
    fontFamily: "Geist, Nebula Sans, Arial Narrow, Helvetica Neue, sans-serif"
    fontSize: "clamp(15px, 1.2vw, 16px)"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "JetBrains Mono, SFMono-Regular, Roboto Mono, Consolas, monospace"
    fontSize: "0.67rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0.1em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
  xl: "14px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  2xl: "2rem"
  3xl: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.action-copper}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0.7rem 1.35rem"
    height: "44px"
  control:
    backgroundColor: "{colors.console-surface}"
    textColor: "{colors.warm-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0.7rem 0.85rem"
    height: "44px"
  card:
    backgroundColor: "{colors.console-surface}"
    textColor: "{colors.warm-paper}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  chip-selected:
    backgroundColor: "{colors.action-copper}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.75rem"
---

# Design System: AI Stats

## Overview

**Creative North Star: "The Calibrated Console"**

AI Stats should feel like a trusted measurement instrument, not a marketing dashboard. The interface is dense enough to reward investigation but disciplined enough that a first-time visitor can choose a task, understand the recommendation, and inspect the evidence without decoding the page.

Near-black fields, warm neutral type, muted copper controls, restrained blue-gray plots, and monospaced measurement labels create a recognizable technical world. Hairline dividers carry most of the structure. The system avoids oversized ornamental cards, decorative gradients, and universal-rank spectacle.

**Key Characteristics:**

- Task-first hierarchy with evidence immediately available.
- Compact measurement labels paired with plain-language interpretation.
- Hairline grids and tonal layering instead of card sprawl.
- Copper reserved for decisions, selections, and the most important plotted point.
- Charts remain readable as data tables or source receipts.

## Colors

The palette uses warm neutrals over a near-black instrument panel, with copper for action, blue-gray for comparison, and green or gold only for evidence states.

### Primary

- **Action Copper:** Reserved for primary actions, active controls, key links, and the most important point in a chart.

### Secondary

- **Plot Blue:** Carries comparison series and frontier lines without competing with the primary action.
- **Evidence Green:** Marks healthy sources and strong evidence, never generic decoration.
- **Caution Gold:** Marks partial or aging evidence that remains usable with context.

### Neutral

- **Measurement Black:** The default page canvas.
- **Console Surface:** The resting surface for controls and grouped content.
- **Raised Surface:** A sparingly used layer for drawers and strongly separated regions.
- **Warm Paper:** Primary text with a softer character than pure white.
- **Supporting Copy:** Secondary text that still needs comfortable reading contrast.
- **Muted Reading:** Metadata, axes, and supporting descriptions.
- **Grid Hairline:** Dividers, plot frames, and the measurement grid.

### Named Rules

**The One Signal Rule.** Copper should occupy a small fraction of a screen. Its scarcity gives selections and primary actions meaning.

**The Evidence Color Rule.** Green and gold communicate source or score state. They are not alternate brand accents.

## Typography

**Display Font:** Geist with Nebula Sans and system sans fallbacks
**Body Font:** Geist with Nebula Sans and system sans fallbacks
**Label/Mono Font:** JetBrains Mono with SFMono and common monospace fallbacks

**Character:** The sans family keeps long analytical copy calm and direct. The mono family gives labels, controls, values, and source metadata the precision of an instrument readout.

### Hierarchy

- **Display** (700, responsive, tight): Route titles and the primary product statement. Keep the measure compact enough that the task begins in the first viewport.
- **Headline** (700, responsive, compact): Section titles and analysis panel headings.
- **Body** (400, responsive, relaxed): Explanations, methodology, and model context. Keep long passages near 70 characters per line.
- **Label** (700, compact, tracked): Metrics, filters, axes, statuses, and source metadata. Uppercase only when it improves scanning.

### Named Rules

**The Readout Rule.** Mono type identifies measurable or operational information. It does not replace readable body copy.

## Layout

The core page uses a 1200px content boundary with a 1rem minimum gutter. Compare views may widen to 1320px when the extra width directly supports plots or side-by-side model evidence.

Composition starts with the user's task, continues through a compact recommendation and source receipt seam, then opens into overview plots and deeper tables. Analytical panels join through shared borders and grid lines instead of becoming unrelated floating cards.

The spacing rhythm is based on quarter-rem steps and grows through half, three-quarter, one, one-and-a-half, two, and three rem intervals. At tablet widths, four-column evidence strips become two columns. On small screens, comparison lenses and evidence grids become a single column, controls reach a 44px minimum target, and wide tables scroll within their own labeled region.

## Elevation & Depth

The system is flat by default. Depth comes from tonal surfaces, border contrast, and a subtle inset glass edge. Shadows are reserved for interactive cards, overlays, and focus moments where the layer relationship would otherwise be unclear.

### Shadow Vocabulary

- **Low:** A small ambient shadow for pressed or compact interactive states.
- **Panel:** A broad, quiet shadow for a hovering analytical card.
- **Overlay:** The strongest ambient shadow, reserved for drawers and transient layers.
- **Action Glow:** A copper-tinted shadow used only on the primary action.

### Named Rules

**The Flat-by-Default Rule.** Data regions are separated by hairlines and tone. A shadow must explain interaction or layering.

## Shapes

Corners are small and functional. Controls and buttons use the smallest radius, normal cards use the medium radius, and larger radii are reserved for overlays. Status dots and plot points may be circular because the geometry encodes state or a coordinate. Borders remain one pixel unless a semantic score badge requires stronger separation.

## Components

### Buttons

- **Shape:** Compact rectangular control with a small radius and a 44px minimum target.
- **Primary:** Copper fill, white label, mono uppercase text, and a restrained ambient glow.
- **Hover / Focus:** A two-pixel lift for pointer hover, a visible copper focus treatment, and no motion when reduced motion is requested.
- **Secondary:** Console surface with a hairline border. Copper appears on hover or focus, not at rest.

### Chips

- **Style:** Small mono controls that read as filters or modes rather than decorative pills.
- **State:** Selected chips use copper fill. Unselected chips stay neutral with a hairline border and full keyboard focus.

### Cards / Containers

- **Corner Style:** Medium radius with a one-pixel border.
- **Structure:** Prefer joined panels, split rows, and shared borders. A standalone card must represent a true movable or interactive unit.
- **State:** Interactive cards may lift slightly. Static analytical regions remain flat.

### Inputs and Selects

- **Shape:** Small radius for boxed controls; borderless lens selects may use a single bottom rule.
- **Color:** Console surface and warm text with muted placeholder or helper copy.
- **Focus:** Copper border or a two-pixel copper-derived outline with sufficient contrast.

### Charts and Evidence Tables

- **Plot:** Blue-gray carries the comparison field, copper marks the decision point, and the hairline grid stays visible but quiet.
- **Labels:** Mono text with explicit axes and units. Never encode an important distinction by color alone.
- **Fallback:** Provide a table, receipt, or textual interpretation for the same claim.

### Source Health

- **Structure:** A joined grid of source records with status, refresh time, coverage, and a short operational message.
- **State:** Green means healthy, gold means stale or partial, and copper-red means failed. Every color state also has a text label.

## Do's and Don'ts

### Do

- Do begin with the user's task and expose the ranking logic nearby.
- Do pair every recommendation with source quality, freshness, and missing-data context.
- Do use compact grids, shared rules, and deliberate whitespace to organize dense information.
- Do keep mobile controls reachable and analytical overflow contained.
- Do preserve keyboard focus, reduced-motion behavior, and non-color status labels.

### Don't

- Don't present one universal leaderboard as objective truth.
- Don't fill the page with interchangeable rounded cards.
- Don't use copper, green, or gold as decoration.
- Don't hide methodology behind an unexplained score.
- Don't animate plots or controls when the motion does not clarify a state change.
