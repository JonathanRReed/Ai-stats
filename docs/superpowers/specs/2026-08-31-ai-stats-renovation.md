# AI Stats Renovation Specification

## Outcome

Turn AI Stats into a free, source-backed model-selection workbench that helps a technical user move from a task and budget to a defensible shortlist, then inspect native benchmark evidence, cost, speed, latency, coverage, provider availability, and freshness without leaving the site.

## Approved visual direction

Preserve the current near-black AI Stats identity. The primary composition is `.impeccable/mocks/ai-stats-task-first.png`, combined with the source-health and graph system from `.impeccable/mocks/ai-stats-overview-first.png`. Keep the existing warm gray display face, narrow monospaced measurement labels, muted copper accent, hairline grid, compact navigation, and restrained density. Avoid a generic SaaS dashboard, a theatrical instrument metaphor, oversized KPI cards, decorative glow, and opaque universal rankings.

## Primary experience

1. The homepage opens with the current concise explanation.
2. A compact task control chooses a transparent preset and optional budget constraint.
3. AI Stats returns three candidates with a plain-language reason, price, speed, one relevant native benchmark value, and comparable metric coverage.
4. A visible explanation lists the preset weights and excluded/missing evidence.
5. Source health reports the newest observation, coverage, and state for Artificial Analysis, Epoch AI, SimpleBench, and PoliBench.
6. The following overview shows a quality-versus-price Pareto plot, benchmark coverage by domain, and recent source or methodology changes.
7. Compare remains the deep side-by-side workbench, with clearer coverage and source context and no default synthetic winner claim.

## Ranking rules

- No cross-benchmark universal score is displayed as a fact.
- Task presets may calculate a local recommendation score only when their normalized fields, weights, minimum coverage, missing-data handling, and tie-breakers are visible.
- Comparable leaderboards require a minimum number of populated metrics and rank only within the same metric set.
- Missing data stays missing and never becomes zero.
- Price, benchmark evidence, provider routes, catalog popularity, and PoliBench political-profile axes remain separate evidence types.
- PoliBench robustness may be shown as a source-native composite. PoliBench axis scores remain directional profiles, not higher-is-better quality scores.

## Data architecture

Legacy compatibility remains intact:

- `public.aa_models`
- `public.epoch_models`
- `public.epoch_benchmarks`
- `public.epoch_benchmark_runs`
- `public.epoch_data_files`
- existing OpenRouter catalog objects

Add an observation layer beside them:

- `public.intelligence_sources`
- `public.canonical_models`
- `public.model_aliases`
- `public.benchmark_definitions`
- `public.benchmark_versions`
- `public.benchmark_observations`
- `public.polibench_snapshots`
- `private.ingestion_runs`
- `private.ingestion_source_runs`
- `public.source_freshness_v1`
- `public.latest_benchmark_observations_v1`

All public objects enable RLS and grant read-only access to `anon` and `authenticated`. Writes and ingestion RPCs remain service-role only. Indexes cover source/model alias lookups, latest observations by model and benchmark, and ingestion status/freshness queries.

## PoliBench contract

The source artifact is `/Users/jonathanreed/Downloads/Poli-bench/src/data/liveBenchmark.generated.json` at PoliBench commit `f49763cdbca9387d823ba19578992434b5ac04b0`. The checked snapshot contains 103 models and 110 runs and was generated at `2026-08-30T07:15:38.021Z`.

- Preserve `modelSlug`, `provider`, and `label` as source-native identity.
- Preserve robustness, completion, validity, stability, consistency, resolution, latency, evidence level, and release fields separately.
- Preserve directional axis scores separately from quality metrics.
- Do not fuzzy-match a PoliBench model to AA or Epoch. Cross-source joins require an explicit alias row with provenance and confidence.
- Label the imported snapshot as live operational evidence, not a paper-release result.

## Failure and accessibility states

- Loading: retain a stable skeleton or reserved layout without hiding readable fallback content.
- Empty: explain which constraint removed all candidates and provide a reset.
- Partial: show the candidate with its coverage count and explicit missing values.
- Stale: show source age and the last successful ingestion result.
- Error: keep the checked-in snapshot usable and name the unavailable source.
- Keyboard, focus, semantics, reduced motion, textual chart equivalents, mobile layout, and WCAG 2.2 AA contrast are required.

## Production boundary

Repository implementation, migration SQL, source transforms, and local verification may proceed now. Applying the migration, running a service-role backfill, changing production schedules, or deploying the site requires an exact target receipt, recoverable pre-change export, additive migration execution, count and RLS readback, and live browser verification.

## Out of scope

- Paid accounts, paywalls, subscriptions, or visitor-supplied API keys.
- An opaque single score across all benchmark publishers.
- Automated fuzzy cross-source model identity merges.
- Deleting or renaming current public tables or routes.
