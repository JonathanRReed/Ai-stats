/// <reference types="bun" />

import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/model_intelligence_foundation.sql",
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
