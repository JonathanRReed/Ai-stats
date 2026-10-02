# AI Stats Comparison and Data Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship correct, fresh cached data, a chart-first comparison explorer, and OpenRouter usage charts without a paid data dependency.

**Architecture:** Three independently testable stages: evidence/cache correctness, comparison UI, then usage/copy. Existing Astro/React pages consume versioned payloads built from validated Supabase snapshots; upstream fetches run only in ingestion jobs.

**Tech Stack:** Bun 1.4.0, Astro 7.2.10, React 19.2.8, TypeScript 6.0.3, Chart.js 4.5.1, Supabase/Postgres 17.

**Spec:** ../specs/2026-10-02-compare-data-refresh-design.md, approved by Jonathan on October 2 at 01:13 UTC.

## Global Constraints

- Code and migration changes go through GitHub MCP PRs.
- Run repository tests, lint, types and build against exact remote code on Snoopy's cloud machine.
- Changes are additive and reversible.
- Browsers never call AA, Epoch or OpenRouter upstream APIs directly.
- Unknown dates and conditions remain unknown.
- No paid subscription is assumed.
- No new credential grants or destructive cleanup are included.
- Preserve existing consumer fields through a versioned transition; do not change the shared AI Drag Racing storage/RPCs.
- Execute directly in the current task. Use a Sol review only when an independent final review is necessary; never Astra.

## Review Focus

1. A source removes a model: keep its history, exclude it from the current cohort without deleting records (Task 3).
2. A source revises an older daily bucket: replace that snapshot atomically, not append duplicate traffic (Task 7).
3. Shared URL references a missing model: retain valid selections and show the missing ID without crashing (Task 5).
4. JavaScript or refresh fails: initial static table and dated last-good evidence remain usable (Tasks 4 and 6).
5. Mobile filter dismissal and browser Back/Forward: selection state and focus remain consistent (Task 6).

## Stage A: Evidence and cache correctness

### Task 1: Preserve Epoch observation identity and conditions

**Files:** Create src/lib/epoch-observations.ts and src/lib/epoch-observations.test.ts; create scripts/epoch-records.mjs and scripts/epoch-records.test.ts; modify scripts/sync-epoch-data.mjs, scripts/sync-intelligence-data.mjs, src/lib/epoch-snapshot.ts and src/lib/supabase.ts.

**Interfaces:** EpochObservation has id, modelVersion, benchmarkSlug, metricKey, unit, value, conditions (string-keyed scalar map), evaluationDate, sourceUrl, fetchedAt and snapshotId. normalizeEpochRecord(row, benchmarkSlug) returns an observation or a typed rejection. selectComparableEpoch(observations, selection) returns distinct compatible observations plus excluded counts and reasons.

- [ ] Add fixtures from the verified Qwen Aider rows. Assert diff=8 and whole=16.4 survive independently; reverse row order and assert identical output. Assert missing values remain null, zero remains zero, and no condition is inferred from a display label.
- [ ] Run bun test scripts/epoch-records.test.ts src/lib/epoch-observations.test.ts; confirm the missing implementation fails.
- [ ] Extract import-safe CSV normalization from the current ingestion entrypoint. Preserve source condition fields and evaluation dates in both the public snapshot and canonical observation metadata. Keep raw records private. Use an explicit metric/unit registry, with unrecognized metrics retained as native/unknown rather than guessed.
- [ ] Test repeated comparable runs, source-published aggregates, unknown conditions and conflicting versions. No max-score or last-row aggregation.
- [ ] Run focused tests and existing sync-intelligence tests; commit through GitHub MCP.

### Task 2: Remove scalar overwrites and price-gated benchmark selection

**Files:** Modify src/pages/api/compare-initial.json.ts, src/pages/compare.astro, src/lib/live-data.ts, src/lib/aa-evidence.ts; create src/lib/compare-evidence.ts and src/lib/compare-evidence.test.ts.

**Interfaces:** buildCompareEvidence(models, observations) returns schemaVersion 2, model records, metric definitions and observation records. availableForMetric(model, metric) checks only that metric's requirements. Legacy response fields remain during migration.

- [ ] Add assertions: a zero-priced model with an intelligence score remains available; an unpriced model appears in benchmark charts but not cost scatter; null is never converted to zero.
- [ ] Add assertions: same family with different reasoning effort does not share a score; ambiguous cross-source aliases produce unmatched evidence; a 0.8 percent-unit value stays 0.8%, while a fraction-unit value converts to 80%.
- [ ] Run bun test src/lib/compare-evidence.test.ts scripts/compare-rendering.test.ts and confirm red failures.
- [ ] Replace both API and browser last-row-wins mappings with Task 1's shared selection contract. Preserve exact source IDs, index version and prompt conditions.
- [ ] Run focused tests, lint and typecheck; commit.

### Task 3: Add validated snapshot membership without deleting history

**Files:** Create scripts/source-snapshots.mjs and scripts/source-snapshots.test.ts; modify scripts/sync-intelligence-data.mjs and docs/operations/benchmark-refresh.md. Add a migration generated through the supported Supabase migration workflow, committed under supabase/migrations/.

**Interfaces:** stageSnapshot(sourceKey, contentHash, fetchedAt, evidence) returns snapshotId. promoteSnapshot(snapshotId) atomically advances only validated source data. Current membership is keyed by snapshotId/source record ID; historical observations remain unchanged.

- [ ] Capture schema/count baselines through read-only MCP. Validate the production project ID bgbqdzmgxkwstjihgeef and existing private ingestion run contracts.
- [ ] Define source snapshots, membership and current-pointer storage using existing source/run IDs. Private staging is service-only; only sanitized current benchmark data is publicly readable. No permission grants to raw fetches.
- [ ] Add red tests: empty result, failed last page, malformed numeric field and partial source do not advance current pointer; a removed model remains in history but not current membership; repeat import is idempotent.
- [ ] Implement staging/validation/promotion in a transaction with source-level locking. Preserve the last good pointer on every error.
- [ ] Validate migration in an isolated database when supported, record rollback pointer procedure, run anonymous-read/service-write policy checks and advisors. Do not deploy if isolation or recovery cannot be validated.
- [ ] Commit migration and tests; open the Stage A PR only after the remaining Stage A task passes.

### Task 4: Freshness receipts and bounded refresh scheduling

**Files:** Modify src/lib/data-freshness.ts, src/lib/data-freshness.test.ts, src/lib/live-data.ts, src/pages/api/intelligence.json.ts, scripts/build-intelligence-input.mjs, .github/workflows/refresh-benchmarks.yml and docs/operations/benchmark-refresh.md; create scripts/source-refresh-policy.mjs and scripts/source-refresh-policy.test.ts.

**Interfaces:** getRefreshPolicy(sourceKey) returns intervalHours and staleAfterHours. resolveReceipt(receipt, now) separates sourceObservedAt, fetchedAt, publishedAt and lastSuccessfulSnapshotId.

- [ ] Add red clock tests: AA target 4h/overdue8h; Epoch/OpenRouter target6h/overdue12h; HF/LiteLLM target24h/overdue48h. Historical evaluation dates do not trigger source-ingestion failure. Reimporting old PoliBench data never updates its evidence date.
- [ ] Add red tests for Retry-After, conditional unchanged responses, overlapping jobs and unchanged payloads causing no deployment.
- [ ] Implement source policies, backoff, locks and quota guards. Increase AA cadence only after verified page-count headroom under the shared 100/day quota. Respect any stricter observed limit.
- [ ] Persist public catalog receipts in the durable cache, retaining last-good payloads on source failure. Generate a small manifest and selective chart payloads; preserve static fallback and explicit partial status.
- [ ] Run bun run test, bun run lint, bun run typecheck and bun run build. Verify exact remote candidate, Stage A PR checks, reviewed migration and post-merge publication independently.

## Stage B: Chart-first Compare

### Task 5: Explorer state and chart adapters

**Files:** Create src/lib/compare-state.ts, src/lib/compare-state.test.ts, src/lib/compare-series.ts, src/lib/compare-series.test.ts; create src/components/compare/CompareExplorer.tsx, ModelSelector.tsx, ComparisonChart.tsx and ObservationDetails.tsx.

**Interfaces:** CompareState includes chart, modelIds, reasoningEfforts, metricId, conditionKey, scale, labels and frontier. parseCompareState(URLSearchParams, catalog) and serializeCompareState(state) round-trip safe state. buildCompareSeries(evidence, state) returns points/bars, units, compatible cohort and exclusions.

- [ ] Add red tests for family selection, reasoning variants, missing/deleted IDs, URL round-trip, zero-cost log fallback, same-index/condition frontier and no inferred token counts.
- [ ] Implement shared state and chart adapters using Stage A evidence. Default to a compatible recent measured cohort; offer history explicitly.
- [ ] Build cost/intelligence and speed/intelligence scatter, cost and price bars, individual benchmark view and evidence receipts. Keep unavailable token charts visibly explained and noninteractive.
- [ ] Render focusable points or a keyboard-accessible equivalent table, pinned details, stable colors, optional labels and condition selection.
- [ ] Run focused tests and typecheck; commit.

### Task 6: Replace Compare shell and verify interactions

**Files:** Modify src/pages/compare.astro and scripts/compare-mobile-layout.test.ts, scripts/compare-rendering.test.ts; create src/styles/compare-explorer.css.

- [ ] Add red assertions for the small page shell, chart-first hierarchy, static exact-data fallback, model selector and methodology disclosure.
- [ ] Replace the monolithic renderer with Task 5 components while retaining header/footer/theme conventions.
- [ ] Implement shareable URLs, reset, mobile drawer focus return, Escape, reduced motion and source/date-bearing exports. Do not replay entrance animations on each filter change.
- [ ] Run tests, lint, types and build. In the cloud browser test desktop/mobile, light/dark, empty selection, repeated toggles, invalid URL, failed refresh, Back/Forward and keyboard inspection.
- [ ] Review screenshots against AI Stats' current styling and supplied Slopalytics references. Commit, open Stage B PR, verify preview, then merge and verify live URL.

## Stage C: Usage on Stats and copy cleanup

### Task 7: Official OpenRouter daily data adapter

**Files:** Create scripts/sync-openrouter-usage.mjs, scripts/sync-openrouter-usage.test.ts, src/lib/openrouter-usage.ts and src/lib/openrouter-usage.test.ts; add sanitized daily-series storage via the supported migration workflow.

**Interfaces:** UsageSnapshot includes asOf, startDate, endDate, period, filters, estimated and rows. A row has date, modelPermaslug and totalTokens represented losslessly. normalizeUsageSnapshot(payload) validates UTC dates, finite nonnegative integer totals and duplicate keys.

- [ ] Add red fixtures for Other, a model outside the top50, missing days, revised past days, duplicate keys, very large token totals and incomplete UTC days.
- [ ] Implement the official /api/v1/datasets/rankings-daily adapter with a securely configured server-side key. Do not create or configure credentials without the required secure approval. Missing auth blocks ingestion only, not independent work.
- [ ] Use day-grain unfiltered exact data for the first release. Preserve period/filters/estimated metadata; reject sampled category/language data from this adapter rather than presenting weekly estimates as daily totals.
- [ ] Keep Other in dataset denominators. Absence from top50 is unknown individual traffic, not zero. Do not add reasoning tokens to the endpoint's total_tokens.
- [ ] Test atomic revision replacement, bounded backoff and CC BY/source/as_of attribution. Commit and validate storage policies.

### Task 8: Usage charts and concise Stats copy

**Files:** Create src/components/OpenRouterUsage.tsx; modify src/pages/index.astro and scripts/homepage-intelligence.test.ts; create src/lib/openrouter-usage-view.test.ts.

**Interfaces:** buildUsageSeries(snapshot, windowDays, selectedModels, mode) accepts 7, 30 or90 days and share or volume. Returns dated series, Other, coverage and explicit denominator labels.

- [ ] Add red assertions for full-dataset versus selected-subset shares, gaps, insufficient history, zero total and source as_of labels.
- [ ] Add stacked usage charts, 7/30/90 controls, model selection, keyboard/touch inspection and exact-data table using the existing design system.
- [ ] Replace hero copy with: heading "Compare AI models"; sentence "Benchmarks, pricing and speed, with sources you can check." Move repeated methodological prose into disclosures without removing necessary units/conditions near charts.
- [ ] Verify existing Stats sections remain usable and the usage module fails independently. Run full checks and browser QA.
- [ ] Commit, open Stage C PR, verify preview and production. Report https://aistats.jonathanrreed.com/ and /compare with observed results.

## Independent prerequisites and exclusions

- AA access/public-display inquiry is sent; response pending. No richer AA field or new redistribution is enabled on assumption.
- OpenRouter API key availability must be verified without exposing its value. Secure setup, if missing, is a narrow user step.
- Supabase advisors report an available Postgres security patch. Treat a managed-engine upgrade as separate maintenance with backup/restore validation and an agreed downtime window; do not mix it into these application migrations.
- RLS-with-no-policy notices on raw fetches and private share storage are not automatically bugs. Preserve intentional deny-by-default behavior. Review shared RPC warnings in context, never disable sharing to silence a linter.
- No new paid source, public user telemetry, AA scraping, destructive data cleanup or unrelated database refactor.

## Completion evidence

For each stage record remote SHA, tests actually run, test counts, migration receipt if relevant, CI result, deployed revision, live browser scenarios, source freshness and outstanding external prerequisites. A successful database sync is not proof of deployment. Do not report token views as complete while their source is unavailable.
