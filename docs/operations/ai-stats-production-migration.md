# AI Stats production migration runbook

This runbook applies the versioned additive normalized intelligence migrations in `supabase/migrations/` and backfills them with `scripts/build-intelligence-input.mjs` and `scripts/sync-intelligence-data.mjs`. It does not replace or rewrite the existing Artificial Analysis, Epoch, OpenRouter, or snapshot tables.

The production target is the `Ai-dex` Supabase project with reference `bgbqdzmgxkwstjihgeef`. Confirm the signed-in dashboard still shows that project, organization, region, and production branch together before every production operation. Never substitute the AI News project or infer the target from an environment file.

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

## Apply the versioned migrations

Apply these files in order from the same release revision that passed verification:

1. `20260901000100_model_intelligence_foundation.sql`
2. `20260901000200_backfill_legacy_intelligence.sql`
3. `20260901000300_register_intelligence_migrations.sql`
4. `20260901155807_reconcile_source_native_observation_keys.sql`
5. `20260901170000_harden_cron_secrets_and_extensions.sql`

Review the project target before execution and retain the migration receipt. Stop if a transaction rolls back, an existing object has an incompatible shape, or any constraint, grant, policy, or reconciliation assertion fails.

The migrations must not drop, truncate, or remove rows from legacy source tables. Approved legacy mutations are limited to restoring missing Epoch model linkage and removing redundant public-read policies after equivalent select access is verified.

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

## Build, dry run, and sync

Build the intelligence payload into a private file outside the repository. The builder reads Artificial Analysis from the verified production project, uses the checked Epoch and PoliBench snapshots, and fetches the current OpenRouter public catalog. It deduplicates Artificial Analysis by source slug using the same freshness ordering as the production backfill.

```sh
SUPABASE_URL=https://bgbqdzmgxkwstjihgeef.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=REDACTED \
bun run build:intelligence-input -- --output /secure/path/intelligence-input.json

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

Use a short-lived secret key for a manual production sync. Revoke it after the post-sync readback and access-control probes pass. Remove the generated input file and clear any clipboard copy after revocation.

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

Verify source-native observation identities after every legacy backfill or source sync. Artificial Analysis keys must use a UTC millisecond timestamp ending in `Z`. Epoch keys must use `epoch_run_id` when it is present. Equivalent rows with the older PostgreSQL timestamp string or internal UUID key are a failed migration state.

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

## Verified production receipt, 2026-09-01

- Applied migrations: `20260901000100`, `20260901000200`, `20260901000300`, `20260901155807`, and `20260901170000`.
- Source sync: succeeded as ingestion run `2`; all four source runs succeeded with no error summary.
- Current source coverage: Artificial Analysis 659 models, Epoch AI 606 current-snapshot models and 3,375 observations, OpenRouter 565 models, and PoliBench 103 models with 110 runs.
- Normalized totals: 1,938 canonical models, 1,938 aliases, 85 benchmark definitions, 85 benchmark versions, 9,736 observations, and one PoliBench snapshot.
- Observation totals by source: Artificial Analysis 4,435, Epoch AI 3,447 including 72 retained legacy-only observations, and PoliBench 1,854.
- Integrity checks: zero unlinked Epoch legacy runs, zero noncanonical Artificial Analysis keys, and zero legacy Epoch UUID observation keys where a source-native run ID exists.
- Anonymous probes: public source-freshness read returned `200`; normalized table write and ingestion RPC returned `401`; private-schema read returned `406`.
- The one-time `codex_ai_stats_sync_20260901` secret key was deleted after verification and the clipboard was cleared.
- The Artificial Analysis cron authorization value now lives in Supabase Vault. The cron command contains no plaintext JWT, references the named Vault secret, and returned HTTP `200` in a production invocation.
- The non-relocatable `http` and `pg_net` extensions were transactionally recreated with `extensions` as their owning schema after the `pg_net` queue was verified empty. Both extension surfaces passed post-change checks.
- The remaining advisor warning is the Supabase-managed PostgreSQL patch level. A platform upgrade remains gated on a verified recovery point because this free project has no confirmed backup receipt.
