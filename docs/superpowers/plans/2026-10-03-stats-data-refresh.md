# Independent Stats refresh
Spec: docs/superpowers/specs/2026-10-02-ai-stats-architecture.md
Base: 665d467d7e5d16dc8117512b01d439c075a40987

## Scope
Finish step 4 for the existing Stats page without redesigning it, migrating hosting, adding a paid service, or making browser requests to upstream data vendors. Preserve the immediate static fallback, source identity, metric units, observed/fetched/published dates, and active controls.

## Decisions
- Extend the existing bounded app-data release with a separately fetched, validated Stats asset. Compare must not download it.
- Keep the current Cloudflare Pages deployment; the current Astro Cloudflare adapter targets Workers and a hosting migration is unnecessary here.
- Only publish display fields and source-backed counts. No raw fetch bodies, credentials, share records or private ingestion state.
- A Stats release is accepted only after all required sections can use the same immutable snapshot. A failed fetch or invalid payload keeps the entire last-good page.
- Offer later updates through one short Refresh data control. Preserve model searches, sort order, chart filters, selected benchmark, workbench settings, and open detail state where the exact record still exists.
- Distinguish raw corpus counts from displayed subsets. Never derive a full-corpus count from a top-five projection or guess units from score magnitude.

## Task 1: Snapshot contract and publication
Write failing tests for optional Stats manifest descriptors, content hashes, complete current-AA identity, zero values, dates, malformed/private fields, unavailable optional sources, source-size limits and backward compatibility.
Implement a pure public payload validator, cached server compiler, artifact read/write path and immutable Pages API route. Include the Stats content hash in the dataset fingerprint. Publish no incomplete or oversized payload.
Verify the focused tests, full suite, lint and typecheck.

## Task 2: Coherent page consumers
Add a refresh controller with stale-request cancellation, first-load/focus/visibility behavior and explicit retry. Wire all data-bearing sections: current-model strip, workbench/reasoning, source health, overview plot/coverage, usage, PoliBench, catalog totals, model cards/table/drawer and benchmark lists.
Keep a dated static snapshot usable offline. Validate before changing the page, and retain the previous release on errors. Remove the unused legacy event-only refresh path once replaced.

## Task 3: Data and interaction guardrails
Test exact source joins, true zero scores, native/percent/fraction units, duplicate or ambiguous Epoch observations, missing benchmark controls, rollback, repeated clicks, stale asynchronous responses and refresh during interaction. Check phone-width filters, chart selection, Back/Forward, keyboard controls and failure/retry.

## Task 4: Release
Run the full verification suite and a fresh whole-branch review, fix important findings with regression tests, open a PR, merge and inspect the production page. Prove a cached Stats update can be consumed without a code rebuild. Keep the old cache contract compatible during rollout.
