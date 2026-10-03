# Benchmark Source Contracts Implementation Plan

> For agentic workers: use superpowers:executing-plans for native implementation. Code changes go through GitHub MCP; cloud checkout is for testing.

Goal: make displayed benchmark values traceable to the correct version, metric, unit, evaluated system and source.
Architecture: import the upstream schema with each snapshot, preserve it through the durable cache, then use the same source contracts in Stats and Compare. Currentness is checked independently of fetch time.
Tech stack: Astro, TypeScript, Bun, existing Supabase snapshot publication.
Spec: Jonathan's October 3 request to audit every displayed benchmark against its original source and update collection as needed.

## Global constraints
- No paid API purchases, guessed scores, or relabeling old trials as new benchmark versions
- Unknown units, versions and evaluation dates stay unknown
- Preserve historical observations and exact model/agent/run identity
- Keep the existing cache and rate limits; no per-visitor upstream requests
- Hold publication until correctness checks pass

## Review focus
- Missing documented primary columns must not select another metric
- Fractional scores under percent-looking headings must not become 0.93% instead of 93%
- Repeated models with different agents must remain distinguishable
- Breaking benchmark versions and mixed metrics cannot share a ranking
- Fresh retrieval of old data must not imply fresh evaluation

## Tasks
- [ ] Source schema: tests in scripts/epoch-metadata-contract.test.ts cover exact primary selection, missing values, percent/fraction/native storage, version conditions and Source URL fallback; implement in epoch-records.mjs and sync-epoch-data.mjs
- [ ] Persistence: preserve sanitized benchmark metadata and benchmark_version through source-snapshots.mjs, epoch-snapshot.ts, supabase types, observation adapters, release assets and intelligence publication; add cache round-trip tests
- [ ] Display: shared benchmark series building must retain run identities, versions, metric/unit cohorts and agent labels; replace Stats magnitude-based formatting and generic descending sorts; test all options and mobile behavior
- [ ] Currentness: inspect each original source; record current, historical or unverified status, current version, access/license and refresh route; add direct collectors for accessible missing current results without replacing historical cohorts
- [ ] Verify: Bun full suite, lint and typecheck; generated snapshot membership and units checked against original CSV and metadata; browser-check every offered benchmark and source attribution
- [ ] Publish only verified changes through reviewed PRs, then confirm production data and page behavior before resuming SEO and other PRs
