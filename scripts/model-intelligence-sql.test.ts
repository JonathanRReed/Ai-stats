/// <reference types="bun" />

import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901000100_model_intelligence_foundation.sql",
);
const legacyBackfillPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901000200_backfill_legacy_intelligence.sql",
);
const historyPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901000300_register_intelligence_migrations.sql",
);
const reconciliationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901155807_reconcile_source_native_observation_keys.sql",
);
const backendHardeningPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901170000_harden_cron_secrets_and_extensions.sql",
);

const requiredPublicTables = [
  "intelligence_sources",
  "canonical_models",
  "model_aliases",
  "benchmark_definitions",
  "benchmark_versions",
  "benchmark_observations",
  "polibench_snapshots",
];

const requiredPrivateTables = ["ingestion_runs", "ingestion_source_runs"];

const normalizeSql = (sql: string) => sql.replace(/\s+/gu, " ").trim().toLowerCase();

test("the intelligence migration is additive, constrained, indexed, and read-only for public clients", async () => {
  const sql = normalizeSql(await readFile(migrationPath, "utf8"));

  for (const table of requiredPublicTables) {
    expect(sql).toContain(`create table if not exists public.${table}`);
    expect(sql).toContain(`alter table public.${table} enable row level security`);
    expect(sql).toMatch(
      new RegExp(`create policy ${table}_select on public\\.${table} for select to anon, authenticated using \\(true\\)`),
    );
    expect(sql).toContain(`grant select on table public.${table} to anon, authenticated`);
    expect(sql).toContain(
      `revoke insert, update, delete, truncate, references, trigger on table public.${table} from public, anon, authenticated`,
    );
    expect(sql).toContain(
      `grant select, insert, update on table public.${table} to service_role`,
    );
    expect(sql).not.toContain(
      `grant select, insert, update, delete on table public.${table} to service_role`,
    );
  }

  for (const table of requiredPrivateTables) {
    expect(sql).toContain(`create table if not exists private.${table}`);
    expect(sql).toContain(`revoke all on table private.${table} from public, anon, authenticated`);
    expect(sql).not.toMatch(
      new RegExp(`grant [^;]+ on table private\\.${table} to service_role`),
    );
  }

  const publicIdentitySequences = requiredPublicTables.map((table) => `public.${table}_id_seq`);
  for (const sequence of publicIdentitySequences) {
    expect(sql).toContain(`grant usage, select on sequence ${sequence} to service_role`);
  }
  expect(sql).not.toContain("on all sequences in schema public");
  expect(sql).not.toContain("on all sequences in schema private");

  expect(sql).toMatch(/generated always as identity primary key/);
  expect(sql).toMatch(/constraint intelligence_sources_status_check check/);
  expect(sql).toMatch(/constraint model_aliases_confidence_check check/);
  expect(sql).toMatch(/constraint benchmark_observations_value_check check/);
  expect(sql).toMatch(/constraint polibench_snapshots_counts_check check/);
  expect(sql).toMatch(/constraint ingestion_runs_status_check check/);
  expect(sql).toMatch(/constraint ingestion_source_runs_status_check check/);
  expect(sql).toMatch(
    /constraint benchmark_definitions_direction_check check \( \(unit = 'directional_profile_score' and higher_is_better is null\) or \(unit <> 'directional_profile_score' and higher_is_better is not null\) \)/,
  );

  const requiredForeignKeys = [
    "model_aliases_canonical_model_id_fkey",
    "model_aliases_intelligence_source_id_fkey",
    "benchmark_definitions_intelligence_source_id_fkey",
    "benchmark_versions_benchmark_definition_id_fkey",
    "benchmark_observations_intelligence_source_id_fkey",
    "benchmark_observations_canonical_model_id_fkey",
    "benchmark_observations_benchmark_version_id_fkey",
    "polibench_snapshots_intelligence_source_id_fkey",
    "ingestion_source_runs_ingestion_run_id_fkey",
    "ingestion_source_runs_intelligence_source_id_fkey",
  ];
  for (const constraint of requiredForeignKeys) {
    expect(sql).toContain(`constraint ${constraint} foreign key`);
  }

  const requiredIndexes = [
    "idx_model_aliases_canonical_model",
    "idx_model_aliases_source_lookup",
    "idx_benchmark_definitions_source",
    "idx_benchmark_versions_definition",
    "idx_benchmark_observations_source_freshness",
    "idx_benchmark_observations_model_freshness",
    "idx_benchmark_observations_benchmark_freshness",
    "idx_polibench_snapshots_source_freshness",
    "idx_ingestion_source_runs_run",
    "idx_ingestion_source_runs_source_freshness",
    "idx_ingestion_runs_running",
    "idx_ingestion_runs_success_freshness",
  ];
  for (const index of requiredIndexes) expect(sql).toContain(`create index if not exists ${index}`);
  expect(sql).toMatch(/idx_ingestion_runs_running[^;]+where status = 'running'/);
  expect(sql).toMatch(/idx_ingestion_runs_success_freshness[^;]+where status = 'succeeded'/);

  for (const view of ["source_freshness_v1", "latest_benchmark_observations_v1"]) {
    expect(sql).toContain(`create or replace view public.${view} with (security_invoker = true)`);
    expect(sql).toContain(`grant select on table public.${view} to anon, authenticated`);
  }
  expect(sql).not.toMatch(/source_freshness_v1[^;]+private\./);

  const rpcNames = [
    "start_intelligence_ingestion",
    "finish_intelligence_ingestion",
    "start_intelligence_source_ingestion",
    "finish_intelligence_source_ingestion",
  ];
  for (const rpc of rpcNames) {
    expect(sql).toMatch(new RegExp(`create or replace function public\\.${rpc}\\(`));
    expect(sql).toMatch(new RegExp(`${rpc}[^$]+security definer set search_path = ''`));
    expect(sql).toMatch(
      new RegExp(`revoke all on function public\\.${rpc}\\([^;]+ from public, anon, authenticated`),
    );
    expect(sql).toMatch(
      new RegExp(`grant execute on function public\\.${rpc}\\([^;]+ to service_role`),
    );
  }
  expect(sql).toMatch(
    /create or replace function public\.start_intelligence_source_ingestion\([\s\S]*?from private\.ingestion_runs[\s\S]*?status = 'running'/,
  );

  const legacyObjects = [
    "aa_models",
    "epoch_models",
    "epoch_benchmarks",
    "epoch_benchmark_runs",
    "epoch_data_files",
    "openrouter_models",
    "openrouter_model_endpoints",
  ];
  for (const legacyObject of legacyObjects) {
    expect(sql).not.toMatch(
      new RegExp(`(?:alter|drop|delete\\s+from|truncate)(?: table)?(?: if exists)? public\\.${legacyObject}\\b`),
    );
  }
});

test("the legacy intelligence backfill preserves source rows and proves complete source-native coverage", async () => {
  const sql = normalizeSql(await readFile(legacyBackfillPath, "utf8"));

  expect(sql).not.toMatch(/\b(delete from|truncate)\b/);
  expect(sql).not.toMatch(/\bdrop\s+(table|schema|view|function)\b/);
  expect(sql).toContain("insert into public.epoch_models");
  expect(sql).toContain("update public.epoch_benchmark_runs as run");
  expect(sql).toContain("insert into public.intelligence_sources");
  expect(sql).toContain("insert into public.canonical_models");
  expect(sql).toContain("insert into public.model_aliases");
  expect(sql).toContain("insert into public.benchmark_definitions");
  expect(sql).toContain("insert into public.benchmark_versions");
  expect(sql).toContain("insert into public.benchmark_observations");
  expect(sql).toContain("insert into private.ingestion_runs");
  expect(sql).toContain("insert into private.ingestion_source_runs");
  expect(sql).toContain("epoch benchmark runs remain unlinked after the generic repair");
  expect(sql).toContain("artificial analysis source-native alias coverage is incomplete");
  expect(sql).toContain("epoch ai source-native alias coverage is incomplete");
  expect(sql).toContain('drop policy if exists "public read models" on public.aa_models');
  expect(sql).toContain('drop policy if exists "allow public read epoch_models"');
  expect(sql).not.toContain("where slug in (");
});

test("the dashboard-applied intelligence migrations are registered in order", async () => {
  const sql = normalizeSql(await readFile(historyPath, "utf8"));
  expect(sql).toContain("insert into supabase_migrations.schema_migrations");
  expect(sql).toContain("'20260901000100'");
  expect(sql).toContain("'20260901000200'");
  expect(sql).toContain("'20260901000300'");
  expect(sql).toContain("on conflict (version) do update set");
});

test("source-native observation reconciliation keeps one stable identity per record", async () => {
  const sql = normalizeSql(await readFile(reconciliationPath, "utf8"));

  expect(sql).toContain("'yyyy-mm-dd\"t\"hh24:mi:ss.ms\"z\"'");
  expect(sql).toContain("'epoch-ai:' || coalesce(nullif(btrim(run.epoch_run_id), ''), run.id::text)");
  expect(sql).toContain("join public.benchmark_observations as canonical");
  expect(sql).toContain("canonical.id <> keys.id");
  expect(sql).toContain("source-native observation reconciliation failed");
  expect(sql).not.toMatch(/\btruncate\b/);
  expect(sql).not.toMatch(/\bdrop\s+(table|schema|view|function)\b/);
});

test("backend hardening removes plaintext cron credentials and public extension ownership", async () => {
  const sql = normalizeSql(await readFile(backendHardeningPath, "utf8"));

  expect(sql).toContain("vault.create_secret");
  expect(sql).toContain("vault.update_secret");
  expect(sql).toContain("vault.decrypted_secrets");
  expect(sql).toContain("ai-stats-ingest-service-role");
  expect(sql).toContain("authorization");
  expect(sql).toContain("bearer ' ||");
  expect(sql).toContain("from vault.decrypted_secrets");
  expect(sql).toContain("cron.alter_job(target_job_id, command := replacement_command)");
  expect(sql).not.toContain("update cron.job set command");
  expect(sql).toContain("select count(*) into queued_requests from net.http_request_queue");
  expect(sql).toContain("drop extension pg_net");
  expect(sql).toContain("create extension pg_net with schema extensions");
  expect(sql).toContain("drop extension http");
  expect(sql).toContain("create extension http with schema extensions");
  expect(sql).toContain("raise exception 'cron credential migration failed'");
  expect(sql).toContain("raise exception 'pg_net request queue must be empty before relocation'");
  expect(sql).not.toMatch(/eyj[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/i);
});
