# Shadscan Workflow

AI Stats uses Astro with React islands. Shadscan can inspect the React-facing source and run a separate rendered overflow check, but this repository does not use a shadcn `components.json` registry. Treat the source score as an advisory, not a performance score or a release gate.

No Shadscan dependency is installed in the repository. Run the pinned CLI on demand:

```bash
bunx @shadscan/cli@0.17.0 --json
```

Use the prompt format only when handing the findings to a coding agent:

```bash
bunx @shadscan/cli@0.17.0 --prompt
```

The rendered check is separate and does not produce a source score. It checks document-level horizontal overflow at Shadscan's fixed mobile and desktop viewports:

```bash
bunx @shadscan/cli@0.17.0 \
  --check-ui https://aistats.jonathanrreed.com \
  --route /compare \
  --route /about \
  --route /contact \
  --route /privacy \
  --route /subprocessors
```

## What Shadscan does not replace

- `bun run lint`
- `bun run build`
- browser interaction checks for filtering, comparison, drawers, and mobile navigation
- console and network review
- Lighthouse or PageSpeed diagnostics
- field Core Web Vitals
- data-source and freshness checks

Do not add `--fail-under` until the report has been reviewed rule by rule and the score is known to represent this Astro/React architecture. Do not add React, shadcn components, or a second design system to raise the score.

## Current status

The commands are documented but were not executed from the GitHub-only editing environment. No Shadscan pass or score is claimed by this file.
