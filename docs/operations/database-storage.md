# Ai-dex database storage

The Ai-dex project runs on the Supabase free plan, which caps each project database at 500 MB. These changes keep it under that cap without dropping any value. Migration `20261125172100_drop_unused_benchmark_observation_indexes` also drops three `benchmark_observations` indexes that no query uses (about 200 MB).

## Benchmark observations

Artificial Analysis rows that follow the standard shape are stored once per run of identical values:

- `benchmark_observation_series`: one row per model, benchmark version and source key prefix.
- `benchmark_observation_metadata`: each distinct metadata object, without its `observed_at` field.
- `benchmark_observation_runs`: one row per run of identical value, source URL and metadata, with the id, `observed_at` and `ingested_at` of every observation in arrays.

A `before insert` trigger on `benchmark_observations` folds new standard rows into their run, so `scripts/sync-intelligence-data.mjs` keeps upserting as before. Rows that are not a plain append stay in `benchmark_observations`: other sources, rows that do not match the standard key and metadata format, and out-of-order rows. A re-send of a folded key with a changed value is stored as a plain row with the original id and `ingested_at`, which is what the upsert would have left, and the original stays in its run.

Read every observation from `benchmark_observation_history_v1`. `latest_benchmark_observations_v1` reads both tables and returns the same rows as before.

Migration `20261125173057_store_unchanged_aa_observations_once` folds the existing rows. It checks that every folded row rebuilds exactly before it deletes the plain copy, and a failed check rolls the whole fold back. Run it outside the benchmark sync (37 minutes past 1, 7, 13 and 19 UTC). Postgres only returns the freed space to the plan after a rewrite, so run this afterwards, on its own:

```sql
vacuum full public.benchmark_observations;
```

`scripts/aa-observation-folding.test.ts` checks the history view against a control table that gets the same upserts without the trigger.

## Artificial Analysis fetch payloads

`archive-aa-fetches` moves `data` and `raw` from `aa_fetches` rows older than a day into the private `aa-fetch-archive` bucket. It uploads the payload, downloads it again and compares the SHA-256 before it clears the columns. The newest successful language fetch always stays inline because `scripts/build-intelligence-input.mjs` reads it. The cron job `archive-aa-fetch-payloads` runs it four times a day, six rows a run. For a backlog, call it repeatedly with `{"limit": 6}` until `remaining` is 0, then run `vacuum full public.aa_fetches;`.

Each archived row keeps `payload_object_path`, `payload_sha256` and `payload_bytes`. The object is gzipped JSON:

```json
{"data": ..., "raw": ..., "data_is_sql_null": false, "raw_is_sql_null": false}
```

To restore a row, download the object, check its SHA-256 against `payload_sha256`, then set `data` and `raw` from it (SQL `null` where the flag is true) and clear the four `payload_*` columns in the same update.

## Full backups

`ai-dex-backup` writes every `public` and `private` table to the private `ai-dex-backup` bucket as gzipped NDJSON, one `to_jsonb` row per line, plus `schema.json.gz` with columns, constraints, indexes, views, functions, triggers, policies, sequences and cron jobs. `private.backup_manifest` records the row count and SHA-256 of each chunk, and the `verify` mode downloads each chunk and checks both. Call it with the service-role token from SQL through `net.http_post`, one chunk per call, passing the `next` object of each export result as the following call's body:

```json
{"mode": "export", "run": "2026-11-21", "schema": "public", "table": "aa_fetches", "limit": 12}
{"mode": "verify", "run": "2026-11-21", "offset": 0}
```
