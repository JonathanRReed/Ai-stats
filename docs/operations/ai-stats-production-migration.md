# AI Stats production migration runbook

This runbook applies the additive normalized intelligence layer in `supabase/model_intelligence_foundation.sql` and backfills it with `scripts/sync-intelligence-data.mjs`. It does not replace or rewrite the existing Artificial Analysis, Epoch, OpenRouter, or snapshot tables.

The expected project reference from the renovation plan is `bgbqdzmgxkwstjihgeef`. Treat that value as unverified until the signed-in Supabase dashboard shows the AI Stats project name, reference, organization, region, and production branch together. Never substitute the AI News project or infer the target from an environment file.

## Preconditions

1. Confirm the Git revision intended for release and save `git rev-parse HEAD` in the change record.
2. In the signed-in Supabase dashboard, record the organization, project name, project reference, region, health, database version, active branch, and recent migration history.
3. Confirm a recoverable database backup or point-in-time recovery window exists. Record the backup identifier and timestamp before applying SQL.
4. Export definitions and counts for every legacy object the site reads. At minimum, record counts for `aa_models`, `epoch_models`, `epoch_benchmarks`, `epoch_benchmark_runs`, `openrouter_models`, and `openrouter_model_endpoints` when those relations exist.
5. Run the repository gates from a clean dependency install:

   ```sh
   bun install --frozen-lockfile
   bun run lint
   bun run typecheck
   bun test
   bun run build
   ```

6. Keep `SUPABASE_SERVICE_ROLE_KEY` in the local process environment only. Do not paste it into SQL, shell history, issue text, screenshots, logs, or committed files.

Stop if the target identity, backup receipt, or service-role boundary cannot be verified.

## Pre-change inventory

Run these read-only queries in the verified target project and save the complete results.

```sql
select current_database(), current_user, current_setting('server_version');

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname in ('public', 'private')
order by schemaname, tablename;

select table_schema, table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema in ('public', 'private')
order by table_schema, table_name, grantee, privilege_type;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Record legacy counts without assuming every optional table exists. Use the dashboard table editor or guarded `to_regclass` checks before querying an optional relation.

## Apply the additive foundation

1. Open `supabase/model_intelligence_foundation.sql` from the same release revision that passed verification.
2. Review the SQL Editor target banner again before execution.
3. Run the complete migration as one transaction. Save the Supabase query receipt, timestamp, executing role, and success result.
4. Do not continue if the transaction rolls back, any existing object has an incompatible shape, or a grant/policy statement fails.

The migration must only add or replace the normalized intelligence objects. It must not drop or alter the legacy source tables.

## Verify schema and access controls

Confirm all expected relations exist:

```sql
select to_regclass('public.intelligence_sources') as intelligence_sources,
       to_regclass('public.canonical_models') as canonical_models,
       to_regclass('public.model_aliases') as model_aliases,
       to_regclass('public.benchmark_definitions') as benchmark_definitions,
       to_regclass('public.benchmark_versions') as benchmark_versions,
       to_regclass('public.benchmark_observations') as benchmark_observations,
       to_regclass('public.polibench_snapshots') as polibench_snapshots,
       to_regclass('private.ingestion_runs') as ingestion_runs,
       to_regclass('private.ingestion_source_runs') as ingestion_source_runs;
```

Re-run the RLS, policy, and grant inventory. Verify these invariants:

- RLS is enabled on every new public table.
- `anon` and `authenticated` have `select` only on public intelligence tables and views.
- `anon` and `authenticated` cannot read either private ingestion table.
- `anon` and `authenticated` cannot execute ingestion lifecycle RPCs.
- `service_role` can execute the lifecycle RPCs and write the normalized public tables.
- Public views use `security_invoker = true`.
- Privileged functions use a fixed empty `search_path`.

Use an anonymous client request to read each public view and attempt a harmless write that must be denied. Do not use a production record as the write target.

## Dry run and backfill

Build the intelligence payload without credentials or a database write first. The input bundle must contain the validated `aa`, `epoch`, `openrouter`, and `polibench` source objects exercised by `scripts/sync-intelligence-data.test.ts`; store it outside the repository and record its digest in the change receipt.

```sh
bun run sync:intelligence -- --input /secure/path/intelligence-input.json --dry-run
```

Save the source counts, model counts, benchmark counts, observation counts, alias counts, warnings, and exit status. Resolve unexpected zero counts, duplicate identities, unsafe URLs, or ambiguous aliases before continuing.

Run the service-role backfill only after the dry-run receipt is accepted:

```sh
SUPABASE_URL=https://bgbqdzmgxkwstjihgeef.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=REDACTED \
bun run sync:intelligence -- --input /secure/path/intelligence-input.json
```

Set the real key through a secure environment mechanism rather than entering the literal `REDACTED` placeholder. Save the sanitized command shape, exit status, ingestion run ID, and per-source row counts.

## Post-backfill readback

```sql
select source_key, status, coverage_label, last_observed_at, last_successful_run_at
from public.source_freshness_v1
order by source_key;

select count(*) as canonical_models from public.canonical_models;
select count(*) as aliases from public.model_aliases;
select count(*) as benchmark_definitions from public.benchmark_definitions;
select count(*) as benchmark_versions from public.benchmark_versions;
select count(*) as benchmark_observations from public.benchmark_observations;
select count(*) as polibench_snapshots from public.polibench_snapshots;

select source_key, count(*) as observation_count,
       max(observed_at) as newest_observation
from public.latest_benchmark_observations_v1
group by source_key
order by source_key;
```

Verify the latest private ingestion run is `succeeded`, has a non-null `finished_at`, and has source-run rows whose read/write totals match the sanitized CLI receipt. A successful SQL transaction without these operational receipts is not a completed migration.

Re-run all legacy table counts and compare them with the pre-change receipt. Any unexpected legacy count change is a stop condition.

## Site verification

1. Build with the verified public Supabase URL and anonymous key only.
2. Confirm the public bundle contains no service-role key or private ingestion data.
3. Verify the homepage source-health strip, task presets, shortlist, quality-price plot, coverage bars, and PoliBench receipt.
4. Verify Compare happy, loading, empty, partial, stale, and error states at desktop and mobile widths.
5. Confirm `/api/intelligence.json` reports `delivery.mode = "build-snapshot"`, a valid generation timestamp, and the correct source fallback state.
6. Test anonymous reads and denied anonymous writes against production once more.

## Rollback

Prefer a forward correction when data is valid and only presentation needs adjustment. If the migration or backfill violates an invariant:

1. Stop the sync process and record the failing ingestion run.
2. Restore from the verified pre-change backup if any legacy object or data was affected.
3. If only newly added normalized objects are affected, disable their use in the application first. Then remove them only through a separately reviewed rollback migration that names each new view, function, policy, table, sequence, and the `private` schema objects it owns.
4. Never run a broad schema drop, destructive wildcard, or unreviewed reverse script.
5. Re-run legacy counts, public read paths, and the pre-change site revision before declaring rollback complete.

## Completion receipt

The production migration is complete only when the change record contains the verified project identity, backup receipt, release SHA, migration receipt, dry-run receipt, successful ingestion run and source-run IDs, post-change counts, RLS/grant readback, anonymous read/write probes, legacy invariants, and rendered production checks. Without those receipts, report the migration as pending or partial.
