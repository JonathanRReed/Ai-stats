# Benchmark refresh

Artificial Analysis response metadata belongs to each model observation. `aa_models.source_metadata` records the reported index version, endpoint, tier, prompt conditions, release date, and index cost when supplied. Never infer an index version from today's date. The current Free API uses long-prompt speed measurements, which must not be compared directly with the earlier medium-prompt series.

The `evaluations` JSON preserves all returned fields. Retained scalar columns for retired benchmarks are historical values, so readers and the normalized importer use the current response fields when metadata identifies the V2 language API. The Free API does not supply the full evaluation breakdown. Missing values remain unavailable.

The Edge Function source is in `supabase/functions/ingest-artificialanalysis`. Keep gateway JWT verification enabled. The handler accepts service-role callers only, rejects empty or mixed-version pagination, and writes a single observation time per run. Raw fetch records remain private and unchanged for recovery.

Epoch may omit its former `epoch_capabilities_index.csv`. In that case, model identities come from the benchmark runs and ECI remains missing. An archive without usable benchmark evidence must fail before database writes or snapshot replacement.

`Refresh benchmark evidence` runs twice daily at 01:37 and 13:37 UTC, after the existing Artificial Analysis database refresh. It can also be dispatched manually. There are no paid inference calls.

The workflow reads the official Epoch archive, updates the shared Supabase tables, imports the current OpenRouter catalog and checked PoliBench snapshot into normalized observations, and verifies a populated public build. Only the two public snapshot files are committed. Cloudflare's Git integration publishes that commit.

Use `bun run test` locally and in CI. It enables Bun's per-file isolation, because API adapter tests replace the database module and must not leak that replacement into freshness tests.

Required repository secrets are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PUBLIC_SUPABASE_ANON_KEY`. The service key is scoped to the ingestion step and is never supplied to the frontend build. The build uses the existing public anonymous key.

`POLIBENCH_READ_KEY` is an optional read-only SSH deploy key authorized only for the private Poli-bench repository. When available, checkout reads its current main revision and the importer records that exact Git SHA. Without it, the workflow explicitly warns and retains the previously checked snapshot with its original generated date. A successful refresh of other sources does not imply that PoliBench was updated.

The UI compares source timestamps, not row counts, to select Epoch evidence. Charts, comparisons, and source status share that selection. Empty datasets stay unavailable; old evidence stays dated. A failed refresh does not publish an empty replacement. Database ingestion and website publication remain separate receipts, so check both when diagnosing failures.

After a manual run, verify its log counts, the main snapshot commit, the Cloudflare deployment revision, `/api/compare-initial.json`, and the source status shown on the production homepage. Do not infer website publication from database success alone.
