# AI Stats Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free, provenance-aware AI model-selection workbench with a normalized Supabase observation layer, first-party PoliBench ingestion, transparent task ranking, and the approved Task First plus Overview First interface.

**Architecture:** Preserve the current AA, Epoch, OpenRouter, and static snapshot readers as compatibility paths. Add pure TypeScript view-model helpers and source-specific snapshots first, then a read-only normalized Postgres layer, and finally compose the homepage and compare enhancements from those stable contracts. Production migration and deployment remain a separate gated operation.

**Tech Stack:** Astro 7, TypeScript 6, React 19, Bun 1.4, Chart.js 4, Supabase Postgres, static JSON fallbacks.

**Spec:** `docs/superpowers/specs/2026-08-31-ai-stats-renovation.md`

## Global Constraints

- Use Bun for package installation, scripts, lint, typecheck, tests, and builds.
- Add no production dependency without explicit approval.
- Preserve the current dark AI Stats identity and the approved comps.
- Do not fabricate missing benchmark values or silently normalize unlike metrics.
- Preserve current tables, routes, public snapshots, and no-account free use.
- The user authorized a conventional commit and push after all release gates pass. Do not deploy or mutate production.
- Every behavior change follows a witnessed red-green-refactor cycle.

---

### Task 1: Lock the source-backed ranking contract

**Files:**
- Create: `src/lib/model-intelligence.ts`
- Create: `src/lib/model-intelligence.test.ts`
- Modify: `src/lib/data-integrity.ts`
- Modify: `src/lib/data-integrity.test.ts`

**Interfaces:**
- Produces: `TaskPreset`, `ModelEvidence`, `RankedCandidate`, `rankComparableModels(models, preset)`, `findComparableCoverageLeader(models, metricKeys, minimumCoverage)`, and `buildParetoFrontier(models)`.
- Consumes: existing `AaModel` numeric fields and explicit source-native Epoch or PoliBench observations.

- [ ] Write a failing test proving a one-metric 100 percent row cannot beat a model with the required comparable coverage.
- [ ] Run `bun test src/lib/model-intelligence.test.ts` and verify the failure is caused by the missing exports.
- [ ] Implement nullable metric extraction, minimum coverage, visible preset weights, deterministic tie-breaking, and Pareto dominance without treating missing values as zero.
- [ ] Run the focused test and verify it passes.
- [ ] Add failing tests for budget exclusion, missing price, lower-is-better latency and price, and stable ties.
- [ ] Implement the minimal ranking behavior and rerun the focused tests.
- [ ] Refactor the existing AA average-leader calculation to call `findComparableCoverageLeader` while keeping its rendered contract stable until Task 6.

### Task 2: Add a verified PoliBench snapshot boundary

**Files:**
- Create: `src/lib/polibench-snapshot.ts`
- Create: `src/lib/polibench-snapshot.test.ts`
- Create: `scripts/sync-polibench-data.mjs`
- Create: `scripts/sync-polibench-data.test.ts`
- Create: `public/data/polibench-snapshot.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `NOTICE.md`

**Interfaces:**
- Produces: `PublicPoliBenchSnapshot`, `getPublicPoliBenchSnapshot()`, and `bun run sync:polibench`.
- The transform consumes PoliBench `generatedAt`, `suite`, `source`, `models`, `rows`, and `runs`; it emits source-native identity, distinct evidence axes, releases, and freshness.

- [ ] Write failing transform tests for 103 models, stable `modelSlug` identity, separate robustness and axis scores, operational-evidence labeling, and rejected malformed input.
- [ ] Run `bun test scripts/sync-polibench-data.test.ts src/lib/polibench-snapshot.test.ts` and verify the failures.
- [ ] Implement a pure transform plus file/URL loader with an explicit source path and no fuzzy model merge.
- [ ] Generate `public/data/polibench-snapshot.json` from the authoritative sibling repository artifact.
- [ ] Run the focused tests and verify the generated snapshot counts and metadata.
- [ ] Document the source commit, methodology, citation, live-evidence boundary, and refresh command.

### Task 3: Build the additive Supabase intelligence foundation

**Files:**
- Create: `supabase/model_intelligence_foundation.sql`
- Create: `scripts/model-intelligence-sql.test.ts`
- Create: `scripts/sync-intelligence-data.mjs`
- Create: `scripts/sync-intelligence-data.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces the tables and views named in the spec and a service-role-only sync command.
- Consumes validated source payloads from AA, Epoch, OpenRouter metadata, and the public PoliBench snapshot.

- [ ] Write a failing SQL-shape test for primary keys, foreign keys, check constraints, indexes, RLS, grants, fixed `search_path`, and service-role-only mutation.
- [ ] Run `bun test scripts/model-intelligence-sql.test.ts` and verify the migration is missing.
- [ ] Write the additive migration with public read projections and private ingestion receipts.
- [ ] Run the SQL-shape test and inspect the migration for legacy-table mutations.
- [ ] Write failing sync tests for idempotent source/model/benchmark/observation payloads and an explicit PoliBench alias boundary.
- [ ] Implement the service-role sync with bounded batches, sanitized errors, ingestion receipts, and no browser credential path.
- [ ] Run focused tests without production credentials; the command must fail closed with a clear configuration error when invoked without them.

### Task 4: Extend freshness and public API contracts

**Files:**
- Modify: `src/lib/data-freshness.ts`
- Create: `src/lib/data-freshness.test.ts`
- Create: `src/pages/api/intelligence.json.ts`
- Create: `scripts/intelligence-api.test.ts`
- Modify: `src/lib/live-data.ts`

**Interfaces:**
- Produces source-level `status`, `lastObservedAt`, `lastSuccessfulRunAt`, `coverageLabel`, `ageDays`, and `message`, plus task presets and overview data for browser refresh.
- Preserves existing `updatedAt`, `aaLastSeen`, and `epochFetchedAt` fields.

- [ ] Write failing tests for healthy, stale, partial, failed, and unavailable source states, including PoliBench freshness.
- [ ] Run the focused tests and verify the missing behavior.
- [ ] Extend freshness resolution to read the new Supabase view when configured and static snapshots otherwise.
- [ ] Add the versioned public JSON endpoint with explicit build-time delivery and source-fallback metadata. A runtime endpoint requires a separately approved adapter dependency.
- [ ] Run the focused API and freshness tests.

### Task 5: Establish the visual build contract

**Files:**
- Modify: `src/components/Layout.astro`
- Modify: `.impeccable/surfaces/src-pages-index-astro.md`
- Create: `.impeccable/review/hero-repro.png` during verification

**Interfaces:**
- Emits the seed-key direction contract as the first child of `<body>` in production HTML.
- Records the approved comp, component grammar, sampled palette, type ramp, line weights, and implementation-medium inventory.

- [ ] Add the six-line HTML direction contract with seed `be94f65f` before the root slot.
- [ ] Record comp colors `#0F1114`, `#151719`, `#2C2E31`, warm gray text, muted copper, and blue-gray chart marks in the surface brief.
- [ ] Record that all core text, tables, controls, and charts are semantic HTML/CSS/SVG or existing Chart.js, and that no generated raster ships in the product UI.
- [ ] Run `bun run build` and grep `dist/index.html` for `be94f65f`.

### Task 6: Build the Task First homepage

**Files:**
- Create: `src/components/TaskWorkbench.astro`
- Create: `src/components/SourceHealthStrip.astro`
- Create: `src/components/IntelligenceOverview.astro`
- Create: `scripts/homepage-intelligence.test.ts`
- Modify: `src/components/Dashboard.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/tailwind.css`

**Interfaces:**
- Consumes `rankComparableModels`, task presets, source health, AA models, Epoch data, and PoliBench snapshot.
- Emits accessible shortlist rows, weight disclosure, resettable constraints, textual chart equivalents, source health, Pareto plot, coverage bars, and recent source changes.

- [ ] Write failing source and behavior tests for the task control, three-candidate shortlist, visible weights, source receipts, empty reset action, chart text equivalents, and approved section order.
- [ ] Run `bun test scripts/homepage-intelligence.test.ts` and verify the new regions are absent.
- [ ] Implement the first viewport at the comp’s 1586 by 992 composition using existing tokens and hairline grid language.
- [ ] Capture `.impeccable/review/hero-repro.png` at 1586 by 992 and compare it beside the approved comp before building later sections.
- [ ] Implement source health and overview graphs from the supporting comp, using native units and real snapshot data.
- [ ] Add keyboard, reduced-motion, loading, empty, partial, stale, and error behavior.
- [ ] Run focused tests, lint, and typecheck.

### Task 7: Clarify the compare workbench

**Files:**
- Modify: `src/pages/compare.astro`
- Modify: `scripts/compare-mobile-layout.test.ts`
- Modify: `scripts/compare-rendering.test.ts`

**Interfaces:**
- Consumes the same task presets, source receipts, and coverage rules as the homepage.
- Preserves existing Chart.js lifecycle, mobile filter rail behavior, model drawer, build-snapshot hydration, and URL state without automatic browser table crawls.

- [ ] Write failing tests for task preset entry, coverage display, explicit synthetic-fallback labeling, and mobile ordering.
- [ ] Run the focused tests and verify expected failures.
- [ ] Add a compact preset and coverage summary without duplicating the homepage hero.
- [ ] Label any demo fallback as illustrative and exclude it from source-backed default recommendations.
- [ ] Keep chart destruction and theme re-render paths intact.
- [ ] Run focused tests and the complete Bun test suite.

### Task 8: Verify the repository and prepare the production gate

**Files:**
- Modify: `README.md`
- Create: `docs/operations/ai-stats-production-migration.md`
- Create: `.impeccable/review/desktop.png`
- Create: `.impeccable/review/mobile.png`

**Interfaces:**
- Produces a reproducible pre-change export, migration, backfill, RLS/count readback, rollback, and live-browser checklist for Supabase project `bgbqdzmgxkwstjihgeef`.

- [ ] Run `bun run lint`, `bun run typecheck`, `bun test`, and `bun run build`.
- [ ] Start the local preview and verify homepage and compare happy, loading, empty, partial, stale, and error states in the in-app browser.
- [ ] Capture desktop and mobile screenshots, open each file, and verify it contains the named state.
- [ ] Run the Impeccable detector once and fix mechanical findings in one batch.
- [ ] Run a focused security scan over the migration, sync commands, public API, and browser credential boundary.
- [ ] Run the required independent finish review and act on its disposition.
- [ ] Run the documenter after the last accepted correction so `DESIGN.md` reflects the built system.
- [ ] Stop before production mutation and present the exact backup, target, migration, backfill, and readback receipt for approval.

## Self-review

- Spec coverage: UI direction, task ranking, source health, PoliBench, normalized Supabase schema, compatibility, accessibility, failure states, tests, visual review, security review, and production gating all map to tasks above.
- Placeholder scan: no deferred implementation placeholders are present.
- Type consistency: `TaskPreset`, `ModelEvidence`, `RankedCandidate`, `PublicPoliBenchSnapshot`, and source-health fields are defined once and consumed by later tasks with the same names.
- Commit and push are authorized only after every release gate above has current evidence. Deployment and production Supabase mutation remain separately gated.
