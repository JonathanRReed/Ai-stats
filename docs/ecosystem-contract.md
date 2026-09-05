# Ecosystem design contract

Version 1, September 2026. This file is identical in every repo in the family:
AI News, AI Stats, Prompt Info, AI Drag Racing, PoliBench. Change it in one
place, then copy it to the others in the same sweep.

## What is shared

The family resemblance comes from the same measurements, type, chrome, and
honesty rules, not from a shared name or logo. Visitors never need to learn
that an ecosystem exists.

### Tokens

Every site defines the same custom property names in `ecosystem.css`. Only
the values in the "Site palette" block differ.

| Group | Names |
|---|---|
| Surfaces | `--surface-0` page, `--surface-1` panel, `--surface-2` raised, `--surface-3` hover |
| Ink | `--ink-0` primary, `--ink-1` secondary, `--ink-2` muted, `--ink-3` faint |
| Lines | `--line-0` hairline, `--line-1` strong |
| Signal | `--signal`, `--signal-hover`, `--signal-ink`, `--signal-soft`, `--signal-text` (a signal tint that passes 4.5:1 as small text on surface-0) |
| Status | `--ok`, `--warn`, `--bad`, `--info`, each with a `-soft` tint |
| Focus | `--focus` |
| Type | `--font-sans`, `--font-mono`, `--text-xs` to `--text-4xl`, `--leading-*` |
| Space | `--space-1` (4px) to `--space-8` (64px) |
| Radius | `--radius-sm` 2px, `--radius-md` 4px, `--radius-lg` 8px |
| Motion | `--dur-fast` 120ms, `--dur-base` 200ms, `--dur-slow` 320ms, `--ease-standard`, `--ease-out` |
| Layout | `--container` 1280px, `--gutter`, `--header-h` 56px, `--control-h` 44px |
| Depth | `--shadow-1`, `--shadow-2` |

Every ink token must reach 4.5:1 on `--surface-0` in both themes. `--signal-ink`
is whatever passes on the signal fill, so it may be dark in one theme and
white in the other.

### Site palettes

| Site | Surface 0 | Signal | Notes |
|---|---|---|---|
| AI News | `#0a0a0a` | `#e61919` red | Industrial editorial |
| AI Stats | `#090b0d` | `#d86d4a` copper | Calibrated console |
| Prompt Info | `#0a0a0a` | `#e61919` red | Calculator workbench |
| AI Drag Racing | `#090b0a` | `#c9f74f` lime | Timing station |
| PoliBench | `#0e1013` | `#a08ee6` violet | Editorial research, chrome never red or blue |

### Type

Nebula Sans for everything readable, self-hosted in Book 400, Medium 500,
Semibold 600, Bold 700, with Book and Bold italics. JetBrains Mono, variable
weight, for measured values, identifiers, code, and receipts. No third-party
font requests.

Labels are sentence case in the sans face. Uppercase is reserved for a site's
own display identity (AI News and Prompt Info headlines) and never used for
small metadata labels.

### Theme

Dark is the default on every site. Light is a first-class theme for
accessibility, switched by the header toggle, stored in
`localStorage.theme` as `dark` or `light`, applied as
`html[data-theme]` before first paint by an inline script, and mirrored to the
`theme-color` meta tag. Both themes must render every page without a flash.

### Chrome anatomy

- Skip link as the first focusable element, targeting the main landmark.
- Header: 56px, sticky, hairline bottom border, translucent surface with blur.
  Left, the site's own mark at 24px beside its name in Semibold. Center or
  right, the nav in sentence case with a 2px signal underline on the current
  page. Right, the theme toggle at 36px and, under 768px, a 44px menu button.
- Footer: a "Related tools" row listing the four sibling sites with a
  one-line purpose each, then the site's own link groups, then a meta line
  with "By Jonathan R. Reed", the domain, and the year.
- Focus ring: 2px solid `--focus`, 2px offset, on every interactive element.
- Reduced motion: all animation and transition durations collapse to near
  zero. Nothing depends on motion to be understood.

### Voice

Each site opens with the question it answers, in plain words:

- AI News: what changed in AI.
- AI Stats: how these models compare.
- Prompt Info: what a prompt or workload costs.
- AI Drag Racing: how fast a model responds from here.
- PoliBench: where models land on political questions.

No em dashes, no emojis, no superlatives, no "best model" claims. Missing
data stays visibly missing.

### Cross-links

The canonical model key is the OpenRouter `author/model` slug. Contextual
links between sites pass that key:

- AI Stats compare: `/compare?model=<name or slug>`
- AI Drag Racing: `/?model=<openrouter id>&provider=openrouter`
- AI News: `/?q=<display name>`
- Prompt Info: `/?model=<openrouter id>`
- PoliBench: `/models/<slug>/`

### Verification before a push

Build, lint, typecheck, and the repo's own tests. Screenshots at 375px and
1440px for every changed page in both themes. An accessibility pass with no
new failures.
