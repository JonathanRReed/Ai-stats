# Benchmark refresh

Artificial Analysis response metadata belongs to each model observation. `aa_models.source_metadata` records the reported index version, endpoint, tier, prompt conditions, release date, and index cost when supplied. Never infer an index version from today's date. The current Free API uses long-prompt speed measurements, which must not be compared directly with the earlier medium-prompt series.

The `evaluations` JSON preserves all returned fields. Retained scalar columns for retired benchmarks are historical values, so readers and the normalized importer use the current response fields when metadata identifies the V2 language API. The Free API does not supply the full evaluation breakdown. Missing values remain unavailable.

The Edge Function source is in `supabase/functions/ingest-artificialanalysis`. Keep gateway JWT verification enabled. The handler accepts service-role callers only, rejects empty or mixed-version pagination, and writes a single observation time per run. Raw fetch records remain private and unchanged for recovery.

Epoch may omit its former `epoch_capabilities_index.csv`. In that case, model identities come from the benchmark runs and ECI remains missing. An archive without usable benchmark evidence must fail before database writes or snapshot replacement.

`Refresh benchmark evidence` runs every six hours at 01:37, 07:37, 13:37 and 19:37 UTC. Artificial Analysis ingestion remains separately scheduled every twelve hours. It can also be dispatched manually. There are no paid inference calls.

The workflow reads the official Epoch archive, updates the shared Supabase tables, imports the current OpenRouter catalog and checked PoliBench snapshot into normalized observations, and verifies a populated public build. Only the two public snapshot files are committed. Cloudflare's Git integration publishes that commit.

Use `bun run test` locally and in CI. It enables Bun's per-file isolation, because API adapter tests replace the database module and must not leak that replacement into freshness tests.

Required repository secrets are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PUBLIC_SUPABASE_ANON_KEY`. The service key is scoped to the ingestion step and is never supplied to the frontend build. The build uses the existing public anonymous key.

`POLIBENCH_READ_KEY` is an optional read-only SSH deploy key authorized only for the private Poli-bench repository. When available, checkout reads its current main revision and the importer records that exact Git SHA. Without it, the workflow explicitly warns and retains the previously checked snapshot with its original generated date. A successful refresh of other sources does not imply that PoliBench was updated.

The UI compares source timestamps, not row counts, to select Epoch evidence. Charts, comparisons, and source status share that selection. Empty datasets stay unavailable; old evidence stays dated. A failed refresh does not publish an empty replacement. Database ingestion and website publication remain separate receipts, so check both when diagnosing failures.

After a manual run, verify its log counts, the main snapshot commit, the Cloudflare deployment revision, `/api/compare-initial.json`, and the source status shown on the production homepage. Do not infer website publication from database success alone.


## Validated source cache rollout

The additive migration `20261002014704_validated_source_snapshots.sql` introduces private staging/history and a public sanitized cache. It does not alter the existing canonical registry, benchmark tables or AI Drag Racing share RPCs.

1. Validate the migration from the reviewed branch in an isolated database. The test runner is `scripts/validate-source-snapshot-db.mjs`; set `PGLITE_TEST_MODULE` to an isolated installation of the official `@electric-sql/pglite` package, then run it with Node. The current local validation uses PGlite 0.5.8 / Postgres 18.3, not the production Postgres 17 engine; use only SQL supported by production and record that version difference.
2. Before production application, confirm project `bgbqdzmgxkwstjihgeef`, record current schema/migrations and row counts, and verify the two new table names are absent. Review all grants. Existing `service_role` usage on the private schema is required.
3. Apply the reviewed migration via Supabase MCP. Verify migration registration, table definitions, RLS and grants. Re-run advisors; do not remove intentional deny-by-default raw-data policies just to silence informational notices.
4. The ingestion adapter must call `prepareSourceSnapshot` before transmitting data. It rejects empty, duplicate, malformed and private-field payloads and creates a deterministic content hash. The payload must contain sanitized public evidence only; raw upstream responses remain outside this cache.
5. `stage_source_snapshot` stores a candidate privately. `promote_source_snapshot` atomically replaces the public cache only after validation. A fresh fetch cannot make an older source observation supersede newer evidence. Both RPCs are SECURITY INVOKER and executable only by the existing service role.
6. Record the prior and new snapshot IDs, content hash, source/evidence timestamp, fetch timestamp and publication timestamp. Confirm the public cache exposes only the expected source records; verify anonymous roles cannot stage, promote, alter or read private history.
7. Publication to the database is separate from the static site's deployment. Verify the matching website payload and revision before reporting the change live.

### Rollback

Old snapshots are retained. Disable the new reader or ingestion feature first if its behavior is wrong; the old static artifact remains a fallback. To restore cached data, inspect the recorded prior snapshot and use an explicit reviewed transaction to restore that payload and pointer from private history. The normal promotion RPC deliberately rejects older data, so do not falsify timestamps to force a rollback. Do not delete historical snapshots, legacy rows or source receipts.

The new tables are additive. A code rollback can ignore them; dropping them is unnecessary and is not part of ordinary recovery.

### Source boundaries

AA's public-display permission request is pending. Do not enable richer AA redistribution or scrape its website. Epoch's own data is CC BY with attribution; external benchmark records retain their original licenses. OpenRouter's daily usage dataset is CC BY 4.0 with its specified source/as-of attribution. Its category and language filters are sampled weekly estimates and are not interchangeable with the exact day-grain series.


## Evidence/cache rollout checkpoint (October 2, 2026)

This first corrective release preserves conditions, prevents ambiguous score overwrites, validates sanitized Epoch snapshots, and publishes an identity-only AA current-membership cache. It also replaces the generic fourteen-day freshness threshold with source-specific targets.

The refresh workflow runs Epoch and normalized evidence every six hours. Cache promotion follows tests and a successful build. The checked Epoch artifact changes only when sanitized content changes; successful unchanged retrievals still update the durable cache receipt. AA source membership is validated against the latest complete private fetch and imported rows; the private fetch payload is never published.

AA's upstream cron remains twelve-hourly in this release. Seven days of successful receipts showed four pages per fetch. The four-hour target requires a shared daily request counter and failure-aware quota enforcement before changing that separate cron. The source-policy helper alone is not an active scheduler.

Remaining implementation: durable OpenRouter/HuggingFace/LiteLLM catalog adapters and selective manifest refresh, persisted upstream backoff/conditional requests, richer freshness receipts across every surface, chart-first Compare and official OpenRouter daily usage. Do not label those finished based on this corrective release.

If AA membership is unavailable, page readers retain existing rows with current_source_member=null. They must not present that uncertainty as verified current membership. Full history remains available via getModels(true). Current-cohort filtering is effective only after a valid cache promotion.

The isolated migration harness runs PostgreSQL 18 through PGlite; production is PostgreSQL 17. It verifies supported SQL behavior, permissions and rollback preservation, but does not replace production readback/advisor checks. No engine upgrade is part of this release.

AA public health currently uses a 24-hour overdue threshold against its active twelve-hour ingestion schedule. The four-hour target/eight-hour threshold is retained as a future policy only. Epoch archive publication requires a parsed archive receipt (source URL, SHA-256 and file inventory). A missing previously published benchmark or a >20% drop in models/runs holds refresh for source review; legitimate large source revisions must be reviewed before updating the checked baseline. A content-based source-manifest artifact covers AA membership and measurements so AA-only changes trigger a static deployment, followed by a verified post-promotion build.


## Durable public catalogs

OpenRouter's model catalog is admitted at most every six hours. Hugging Face's top-download catalog and the LiteLLM pricing catalog are admitted at most every 24 hours. The catalog worker reserves no more than eight requests per source per UTC day. That is a local safety budget, not a claim about a provider-wide allowance. AA's existing twelve-hour schedule is unchanged until its separate shared-quota guard is verified.

The refresh workflow prepares sanitized candidates, runs the release checks, then atomically publishes them. A 30-minute service-only lease prevents a replaced or expired worker from publishing. An empty or malformed response, duplicate identity, or more than 20% reduction in catalog coverage retains the previous snapshot. HTTP 304 reuses an existing validated payload; it cannot bootstrap an empty cache. HTTP 429 respects Retry-After. A delay beyond the clock's representable range records an indefinite hold for operator review instead of retrying immediately.

Catalog payloads contain public model metadata only. Request validators, leases, counters and error details stay in private.catalog_refresh_state. Anonymous users can read the sanitized source_snapshot_cache but cannot claim, fail or publish refreshes. Server credentials are accepted only for the existing bgbqdzmgxkwstjihgeef project and are sent in headers.

### Commands

- Prepare: bun scripts/refresh-public-catalogs.mjs --prepare --output .tmp/public-catalog-candidates.json
- Compose release input: bun run build:intelligence-input
- After tests and the candidate build: bun scripts/refresh-public-catalogs.mjs --publish --input .tmp/public-catalog-candidates.json

These commands use the existing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY workflow secrets. Do not paste keys into logs, committed files, browser code, or command history. Preparation changes lease/backoff receipts but does not replace public model data. Candidate files are private temporary workflow artifacts.

A manual run on a feature branch can validate and populate the approved source caches after the additive migration is installed. Only main may push the checked public snapshot files back to main. Source changes still require a PR and merge.

### Data and receipt behavior

The site reads cached catalogs rather than fetching those three upstream catalogs on every build. Existing OpenRouter database rows remain a last-known fallback when the durable catalog is unavailable. Hugging Face and LiteLLM stay unavailable until their first validated snapshot. OpenRouter's embedding/provider/endpoints surfaces remain separate from these three catalog refreshes.

Content hashes include catalog model changes but omit retrieval-only timestamps. An unchanged source therefore does not cause a deployment. The source-health panel can read a small public receipt on page load; it updates freshness only if the returned content hash matches the data baked into that page. A newer cache hash is disclosed as a newer snapshot rather than silently relabeling the displayed data.

Observed, retrieved and published timestamps are distinct. Missing source observation dates remain unknown. Failed catalog refreshes keep a sanitized failure status beside the last-good payload, so a canonical-data synchronization cannot accidentally make a failed catalog look healthy.

### Recovery and verification

Run scripts/validate-catalog-refresh-db.mjs in an isolated Postgres-compatible environment before applying the migration. It verifies leases, daily allowance, backoff, unchanged publication time, stale-worker rejection, retained data and anonymous access boundaries.

Do not clear provider backoff or a quota counter simply to make a test pass. Investigate a large catalog shrink before accepting it. For a rollback, choose a verified immutable private.source_snapshots entry and restore only that source's public pointer under service access, preserving the original observed/fetched dates and marking the rollback explicitly. Never delete source history or manufacture a new retrieval date for old evidence.
