# Benchmark refresh

Artificial Analysis response metadata belongs to each model observation. `aa_models.source_metadata` records the reported index version, endpoint, tier, prompt conditions, release date, and index cost when supplied. Never infer an index version from today's date. The current Free API uses long-prompt speed measurements, which must not be compared directly with the earlier medium-prompt series.

The `evaluations` JSON preserves all returned fields. Retained scalar columns for retired benchmarks are historical values, so readers and the normalized importer use the current response fields when metadata identifies the V2 language API. The Free API does not supply the full evaluation breakdown. Missing values remain unavailable.

The Edge Function source is in `supabase/functions/ingest-artificialanalysis`. Keep gateway JWT verification enabled. The handler accepts service-role callers only, rejects empty or mixed-version pagination, and writes a single observation time per run. Raw fetch records remain private and unchanged for recovery.

Epoch may omit its former `epoch_capabilities_index.csv`. In that case, model identities come from the benchmark runs and ECI remains missing. An archive without usable benchmark evidence must fail before database writes or snapshot replacement.

`Refresh benchmark evidence` runs every six hours at 01:37, 07:37, 13:37 and 19:37 UTC. Artificial Analysis ingestion runs every four hours at 01:00, 05:00, 09:00, 13:00, 17:00 and 21:00 UTC. The six-hour evidence workflow can also be dispatched manually. There are no paid inference calls.

The workflow reads the official Epoch archive, updates the shared Supabase tables, imports the current OpenRouter catalog and checked PoliBench snapshot into normalized observations, and validates a complete app-data release. The checked Epoch and PoliBench snapshots plus their source manifest are committed. Cloudflare's Git integration publishes that commit.

Use `bun run test` locally and in CI. It enables Bun's per-file isolation, because API adapter tests replace the database module and must not leak that replacement into freshness tests.

Required repository secrets are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PUBLIC_SUPABASE_ANON_KEY`. The service key is scoped to ingestion and publication steps. Data compilation and frontend builds use the existing public anonymous key.

`POLIBENCH_READ_KEY` is an optional read-only SSH deploy key authorized only for the private Poli-bench repository. When available, checkout reads its current main revision and the importer records that exact Git SHA. Without it, the workflow explicitly warns and retains the previously checked snapshot with its original generated date. A successful refresh of other sources does not imply that PoliBench was updated.

The UI compares source timestamps, not row counts, to select Epoch evidence. Charts, comparisons, and source status share that selection. Empty datasets stay unavailable; old evidence stays dated. A failed refresh does not publish an empty replacement. Database ingestion and website publication remain separate receipts, so check both when diagnosing failures.

After a manual run, verify its log counts, the main snapshot commit, the Cloudflare deployment revision, `/api/compare-initial.json`, and the source status shown on the production homepage. Do not infer website publication from database success alone.


## Validated source cache rollout

The additive migration `20261002032322_validated_source_snapshots.sql` introduces private staging/history and a public sanitized cache. It does not alter the existing canonical registry, benchmark tables or AI Drag Racing share RPCs.

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

The cache rollout preserves conditions, prevents ambiguous score overwrites, validates sanitized Epoch snapshots, and publishes an identity-only AA current-membership cache. It also replaces the generic fourteen-day freshness threshold with source-specific targets.

The refresh workflow runs Epoch and normalized evidence every six hours. Cache promotion follows tests and successful data-only compilation. The checked Epoch artifact changes only when sanitized content changes; successful unchanged retrievals still update the durable cache receipt. AA source membership is validated against the latest complete private fetch and imported rows; the private fetch payload is never published.

AA's four-hour cron is protected by service-only leases and per-request quota reservations. The first guarded run on October 2 at 21:00 UTC updated 689 models with five requests. The upstream fixed 24-hour reset is authoritative; the policy helper does not schedule jobs.

Durable OpenRouter, Hugging Face and LiteLLM catalogs, chart-first Compare and independent Compare data publication are deployed. The official OpenRouter daily-usage adapter is present, but no usage snapshot has been published. Stats still uses its static snapshot build.

If AA membership is unavailable, page readers retain existing rows with current_source_member=null. They must not present that uncertainty as verified current membership. Full history remains available via getModels(true). Current-cohort filtering is effective only after a valid cache promotion.

The isolated migration harness runs PostgreSQL 18 through PGlite; production is PostgreSQL 17. It verifies supported SQL behavior, permissions and rollback preservation, but does not replace production readback/advisor checks. No engine upgrade is part of this release.

AA public health uses an eight-hour overdue threshold against its active four-hour ingestion schedule. Epoch archive publication requires a parsed archive receipt (source URL, SHA-256 and file inventory). A missing previously published benchmark or a >20% drop in models/runs holds refresh for source review; legitimate large source revisions must be reviewed before updating the checked baseline. A content-based source-manifest artifact covers AA membership and measurements so AA-only changes trigger a static deployment, with a separately verified post-promotion data release.


## Durable public catalogs

OpenRouter's model catalog is admitted at most every six hours. Hugging Face's top-download catalog and the LiteLLM pricing catalog are admitted at most every 24 hours. The catalog worker reserves no more than eight requests per source per UTC day. That is a local safety budget, not a claim about a provider-wide allowance. AA now uses a service-only four-hour cron with durable fixed-window quota receipts, a 90-request local cap, and a ten-request reserve. It honors the upstream shared quota reset and Retry-After rather than resetting at UTC midnight.

The refresh workflow prepares sanitized candidates, runs the release checks, then atomically publishes them. A 30-minute service-only lease prevents a replaced or expired worker from publishing. An empty or malformed response, duplicate identity, or more than 20% reduction in catalog coverage retains the previous snapshot. HTTP 304 reuses an existing validated payload; it cannot bootstrap an empty cache. HTTP 429 respects Retry-After. A delay beyond the clock's representable range records an indefinite hold for operator review instead of retrying immediately.

Catalog payloads contain public model metadata only. Request validators, leases, counters and error details stay in private.catalog_refresh_state. Anonymous users can read the sanitized source_snapshot_cache but cannot claim, fail or publish refreshes. Server credentials are accepted only for the existing bgbqdzmgxkwstjihgeef project and are sent in headers.

### Commands

- Prepare: bun scripts/refresh-public-catalogs.mjs --prepare --output .tmp/public-catalog-candidates.json
- Compose release input: bun run build:intelligence-input
- After tests and candidate compilation: bun scripts/refresh-public-catalogs.mjs --publish --input .tmp/public-catalog-candidates.json

These commands use the existing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY workflow secrets. Do not paste keys into logs, committed files, browser code, or command history. Preparation changes lease/backoff receipts but does not replace public model data. Candidate files are private temporary workflow artifacts.

Production refresh runs only for refs/heads/main and checks out reviewed main. Feature-branch validation must use public read-only credentials or an isolated test database; it cannot populate production caches. Install reviewed additive migrations and merge source changes before the first production refresh. The initial catalog bootstrap was explicitly reviewed and has finished; its temporary branch-dispatch path is closed.

### Data and receipt behavior

The site reads cached catalogs rather than fetching those three upstream catalogs on every build. Existing OpenRouter database rows remain a last-known fallback when the durable catalog is unavailable. Hugging Face and LiteLLM stay unavailable until their first validated snapshot. OpenRouter's embedding/provider/endpoints surfaces remain separate from these three catalog refreshes.

Content hashes include catalog model changes but omit retrieval-only timestamps. An unchanged source therefore does not cause a deployment. The source-health panel can read a small public receipt on page load; it updates freshness only if the returned content hash matches the data baked into that page. A newer cache hash is disclosed as a newer snapshot rather than silently relabeling the displayed data.

Observed, retrieved and published timestamps are distinct. Missing source observation dates remain unknown. Failed catalog refreshes keep a sanitized failure status beside the last-good payload, so a canonical-data synchronization cannot accidentally make a failed catalog look healthy.

### Recovery and verification

Run scripts/validate-catalog-refresh-db.mjs in an isolated Postgres-compatible environment before applying the migration. It verifies leases, daily allowance, backoff, unchanged publication time, stale-worker rejection, retained data and anonymous access boundaries.

Do not clear provider backoff or a quota counter simply to make a test pass. Investigate a large catalog shrink before accepting it. For a rollback, choose a verified immutable private.source_snapshots entry and restore only that source's public pointer under service access, preserving the original observed/fetched dates and marking the rollback explicitly. Never delete source history or manufacture a new retrieval date for old evidence.

## Official OpenRouter daily usage

The daily usage adapter requests unfiltered, completed UTC days from the official rankings-daily endpoint. It keeps token totals as decimal strings, including the source's Other bucket. Missing days remain gaps; a model absent from a day's top 50 has unknown individual traffic. The old HTML-scraped weekly rankings reader is retired and its legacy JSON field remains an empty array. Daily totals do not manufacture weekly ranks, request counts, tool calls or model variants.

Storage reuses validated source snapshots and the service-only refresh lease. The usage lease admits at most eight requests per UTC day and one successful refresh per six hours. This is an application-local budget, not a claim about usage by other keys on the account. HTTP Retry-After and increasing failure backoff are both honored. A revision atomically replaces the current daily snapshot while retaining prior history.

Commands in the main-only refresh workflow:
- Prepare: bun scripts/sync-openrouter-usage.mjs --prepare --file .tmp/openrouter-usage-candidate.json
- After verification: bun scripts/sync-openrouter-usage.mjs --publish --file .tmp/openrouter-usage-candidate.json

OPENROUTER_API_KEY is a server-only prerequisite. It was absent from the repository's Actions secrets when checked on October 2. Missing authentication produces a blocked candidate and makes no upstream request; existing published usage remains available. Credential creation/configuration requires a separate secure user action. Never put a key in chat, source, a public environment variable or logs.

Apply the reviewed additive 20261002082538_openrouter_usage_refresh.sql migration before the first authenticated main refresh. Verify the isolated database harness, service-only RPC permissions, RLS, actual daily coverage and matching deployment. A passing fixture test is not a verified live upstream fetch.

The Stats module offers share or token volume, 7/30/90-day windows, model selection, keyboard day inspection and exact static tables. Shares use the whole reported OpenRouter dataset, not the selected subset. They are not market share, user counts or spend. Source/as-of and CC BY 4.0 attribution stay visible; provider tokenizers differ.

## Applied migration versions

The October 2 migration filenames match production's recorded application versions. SQL bytes were compared against the applied records before renaming; these files must not be replayed as new migrations. The receipt regression test detects accidental changes to applied SQL. Future schema changes require a new migration.

Compare releases are compiled with bun scripts/build-app-release.mjs and published from .tmp/app-release. Data jobs do not need an Astro page build. Static fallback snapshots are still saved separately.
