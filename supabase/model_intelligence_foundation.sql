-- Add the normalized intelligence observation layer without changing legacy AA,
-- Epoch, or OpenRouter objects. Production execution is a separate gated step.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.intelligence_sources (
  id bigint generated always as identity primary key,
  source_key text not null unique,
  display_name text not null,
  description text,
  homepage_url text,
  license_name text,
  status text not null default 'unavailable',
  status_message text,
  coverage_label text,
  last_observed_at timestamptz,
  last_successful_run_at timestamptz,
  is_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_sources_key_check check (source_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint intelligence_sources_status_check check (
    status in ('healthy', 'stale', 'partial', 'failed', 'unavailable')
  ),
  constraint intelligence_sources_homepage_check check (
    homepage_url is null or homepage_url ~ '^https://'
  )
);

create table if not exists public.canonical_models (
  id bigint generated always as identity primary key,
  canonical_key text not null unique,
  display_name text not null,
  provider_name text,
  model_family text,
  release_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canonical_models_key_check check (length(btrim(canonical_key)) > 0),
  constraint canonical_models_name_check check (length(btrim(display_name)) > 0)
);

create table if not exists public.model_aliases (
  id bigint generated always as identity primary key,
  canonical_model_id bigint not null,
  intelligence_source_id bigint not null,
  source_model_key text not null,
  source_model_name text,
  match_method text not null default 'source_native',
  provenance text not null,
  confidence numeric(5, 4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_aliases_canonical_model_id_fkey foreign key (canonical_model_id)
    references public.canonical_models(id) on delete cascade,
  constraint model_aliases_intelligence_source_id_fkey foreign key (intelligence_source_id)
    references public.intelligence_sources(id) on delete cascade,
  constraint model_aliases_source_key_check check (length(btrim(source_model_key)) > 0),
  constraint model_aliases_match_method_check check (
    match_method in ('source_native', 'explicit_cross_source')
  ),
  constraint model_aliases_provenance_check check (length(btrim(provenance)) > 0),
  constraint model_aliases_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint model_aliases_source_identity_key unique (
    intelligence_source_id,
    source_model_key
  )
);

create table if not exists public.benchmark_definitions (
  id bigint generated always as identity primary key,
  intelligence_source_id bigint not null,
  benchmark_key text not null,
  display_name text not null,
  domain text not null,
  unit text not null,
  higher_is_better boolean,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint benchmark_definitions_intelligence_source_id_fkey foreign key (intelligence_source_id)
    references public.intelligence_sources(id) on delete cascade,
  constraint benchmark_definitions_key_check check (length(btrim(benchmark_key)) > 0),
  constraint benchmark_definitions_name_check check (length(btrim(display_name)) > 0),
  constraint benchmark_definitions_domain_check check (length(btrim(domain)) > 0),
  constraint benchmark_definitions_unit_check check (length(btrim(unit)) > 0),
  constraint benchmark_definitions_direction_check check (
    (unit = 'directional_profile_score' and higher_is_better is null) or
    (unit <> 'directional_profile_score' and higher_is_better is not null)
  ),
  constraint benchmark_definitions_source_key unique (
    intelligence_source_id,
    benchmark_key
  )
);

create table if not exists public.benchmark_versions (
  id bigint generated always as identity primary key,
  benchmark_definition_id bigint not null,
  version_key text not null,
  methodology_url text,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint benchmark_versions_benchmark_definition_id_fkey foreign key (benchmark_definition_id)
    references public.benchmark_definitions(id) on delete cascade,
  constraint benchmark_versions_key_check check (length(btrim(version_key)) > 0),
  constraint benchmark_versions_methodology_check check (
    methodology_url is null or methodology_url ~ '^https://'
  ),
  constraint benchmark_versions_definition_key unique (
    benchmark_definition_id,
    version_key
  )
);

create table if not exists public.benchmark_observations (
  id bigint generated always as identity primary key,
  intelligence_source_id bigint not null,
  canonical_model_id bigint not null,
  benchmark_version_id bigint not null,
  observation_key text not null,
  source_model_key text not null,
  value numeric,
  observed_at timestamptz not null,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint benchmark_observations_intelligence_source_id_fkey foreign key (intelligence_source_id)
    references public.intelligence_sources(id) on delete cascade,
  constraint benchmark_observations_canonical_model_id_fkey foreign key (canonical_model_id)
    references public.canonical_models(id) on delete cascade,
  constraint benchmark_observations_benchmark_version_id_fkey foreign key (benchmark_version_id)
    references public.benchmark_versions(id) on delete cascade,
  constraint benchmark_observations_key_check check (length(btrim(observation_key)) > 0),
  constraint benchmark_observations_source_model_check check (length(btrim(source_model_key)) > 0),
  constraint benchmark_observations_value_check check (value is null or value <> 'NaN'::numeric),
  constraint benchmark_observations_source_url_check check (
    source_url is null or source_url ~ '^https://'
  ),
  constraint benchmark_observations_source_key unique (
    intelligence_source_id,
    observation_key
  )
);

create table if not exists public.polibench_snapshots (
  id bigint generated always as identity primary key,
  intelligence_source_id bigint not null,
  snapshot_key text not null unique,
  generated_at timestamptz not null,
  suite text not null,
  source_kind text not null,
  model_count integer not null,
  row_count integer not null,
  run_count integer not null,
  evidence_kind text not null,
  evidence_label text not null,
  source_repository text not null,
  source_commit text not null,
  source_artifact_path text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint polibench_snapshots_intelligence_source_id_fkey foreign key (intelligence_source_id)
    references public.intelligence_sources(id) on delete cascade,
  constraint polibench_snapshots_key_check check (length(btrim(snapshot_key)) > 0),
  constraint polibench_snapshots_suite_check check (length(btrim(suite)) > 0),
  constraint polibench_snapshots_counts_check check (
    model_count >= 0 and row_count >= 0 and run_count >= 0
  ),
  constraint polibench_snapshots_repository_check check (source_repository ~ '^https://')
);

create table if not exists private.ingestion_runs (
  id bigint generated always as identity primary key,
  trigger_kind text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error_summary text,
  constraint ingestion_runs_trigger_check check (length(btrim(trigger_kind)) > 0),
  constraint ingestion_runs_status_check check (status in ('running', 'succeeded', 'failed')),
  constraint ingestion_runs_finished_check check (
    (status = 'running' and finished_at is null) or
    (status in ('succeeded', 'failed') and finished_at is not null)
  )
);

create table if not exists private.ingestion_source_runs (
  id bigint generated always as identity primary key,
  ingestion_run_id bigint not null,
  intelligence_source_id bigint not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_read integer not null default 0,
  rows_written integer not null default 0,
  error_summary text,
  constraint ingestion_source_runs_ingestion_run_id_fkey foreign key (ingestion_run_id)
    references private.ingestion_runs(id) on delete cascade,
  constraint ingestion_source_runs_intelligence_source_id_fkey foreign key (intelligence_source_id)
    references public.intelligence_sources(id) on delete restrict,
  constraint ingestion_source_runs_status_check check (status in ('running', 'succeeded', 'failed')),
  constraint ingestion_source_runs_counts_check check (rows_read >= 0 and rows_written >= 0),
  constraint ingestion_source_runs_finished_check check (
    (status = 'running' and finished_at is null) or
    (status in ('succeeded', 'failed') and finished_at is not null)
  ),
  constraint ingestion_source_runs_run_source_key unique (
    ingestion_run_id,
    intelligence_source_id
  )
);

create index if not exists idx_model_aliases_canonical_model
  on public.model_aliases(canonical_model_id, intelligence_source_id);
create index if not exists idx_model_aliases_source_lookup
  on public.model_aliases(intelligence_source_id, source_model_key, confidence desc);
create index if not exists idx_benchmark_definitions_source
  on public.benchmark_definitions(intelligence_source_id, benchmark_key);
create index if not exists idx_benchmark_versions_definition
  on public.benchmark_versions(benchmark_definition_id, published_at desc nulls last);
create index if not exists idx_benchmark_observations_source_freshness
  on public.benchmark_observations(intelligence_source_id, observed_at desc, id desc);
create index if not exists idx_benchmark_observations_model_freshness
  on public.benchmark_observations(canonical_model_id, observed_at desc, benchmark_version_id);
create index if not exists idx_benchmark_observations_benchmark_freshness
  on public.benchmark_observations(benchmark_version_id, observed_at desc, canonical_model_id);
create index if not exists idx_polibench_snapshots_source_freshness
  on public.polibench_snapshots(intelligence_source_id, generated_at desc);
create index if not exists idx_ingestion_source_runs_run
  on private.ingestion_source_runs(ingestion_run_id, started_at desc);
create index if not exists idx_ingestion_source_runs_source_freshness
  on private.ingestion_source_runs(intelligence_source_id, started_at desc);
create index if not exists idx_ingestion_runs_running
  on private.ingestion_runs(started_at desc)
  where status = 'running';
create index if not exists idx_ingestion_runs_success_freshness
  on private.ingestion_runs(finished_at desc)
  where status = 'succeeded';

alter table public.intelligence_sources enable row level security;
alter table public.canonical_models enable row level security;
alter table public.model_aliases enable row level security;
alter table public.benchmark_definitions enable row level security;
alter table public.benchmark_versions enable row level security;
alter table public.benchmark_observations enable row level security;
alter table public.polibench_snapshots enable row level security;

drop policy if exists intelligence_sources_select on public.intelligence_sources;
create policy intelligence_sources_select on public.intelligence_sources
  for select to anon, authenticated using (true);
drop policy if exists canonical_models_select on public.canonical_models;
create policy canonical_models_select on public.canonical_models
  for select to anon, authenticated using (true);
drop policy if exists model_aliases_select on public.model_aliases;
create policy model_aliases_select on public.model_aliases
  for select to anon, authenticated using (true);
drop policy if exists benchmark_definitions_select on public.benchmark_definitions;
create policy benchmark_definitions_select on public.benchmark_definitions
  for select to anon, authenticated using (true);
drop policy if exists benchmark_versions_select on public.benchmark_versions;
create policy benchmark_versions_select on public.benchmark_versions
  for select to anon, authenticated using (true);
drop policy if exists benchmark_observations_select on public.benchmark_observations;
create policy benchmark_observations_select on public.benchmark_observations
  for select to anon, authenticated using (true);
drop policy if exists polibench_snapshots_select on public.polibench_snapshots;
create policy polibench_snapshots_select on public.polibench_snapshots
  for select to anon, authenticated using (true);

revoke all on table public.intelligence_sources from public, anon, authenticated;
revoke all on table public.canonical_models from public, anon, authenticated;
revoke all on table public.model_aliases from public, anon, authenticated;
revoke all on table public.benchmark_definitions from public, anon, authenticated;
revoke all on table public.benchmark_versions from public, anon, authenticated;
revoke all on table public.benchmark_observations from public, anon, authenticated;
revoke all on table public.polibench_snapshots from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.intelligence_sources from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.canonical_models from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.model_aliases from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.benchmark_definitions from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.benchmark_versions from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.benchmark_observations from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.polibench_snapshots from public, anon, authenticated;
grant select on table public.intelligence_sources to anon, authenticated;
grant select on table public.canonical_models to anon, authenticated;
grant select on table public.model_aliases to anon, authenticated;
grant select on table public.benchmark_definitions to anon, authenticated;
grant select on table public.benchmark_versions to anon, authenticated;
grant select on table public.benchmark_observations to anon, authenticated;
grant select on table public.polibench_snapshots to anon, authenticated;
grant select, insert, update on table public.intelligence_sources to service_role;
grant select, insert, update on table public.canonical_models to service_role;
grant select, insert, update on table public.model_aliases to service_role;
grant select, insert, update on table public.benchmark_definitions to service_role;
grant select, insert, update on table public.benchmark_versions to service_role;
grant select, insert, update on table public.benchmark_observations to service_role;
grant select, insert, update on table public.polibench_snapshots to service_role;
grant usage, select on sequence public.intelligence_sources_id_seq to service_role;
grant usage, select on sequence public.canonical_models_id_seq to service_role;
grant usage, select on sequence public.model_aliases_id_seq to service_role;
grant usage, select on sequence public.benchmark_definitions_id_seq to service_role;
grant usage, select on sequence public.benchmark_versions_id_seq to service_role;
grant usage, select on sequence public.benchmark_observations_id_seq to service_role;
grant usage, select on sequence public.polibench_snapshots_id_seq to service_role;

revoke all on table private.ingestion_runs from public, anon, authenticated;
revoke all on table private.ingestion_source_runs from public, anon, authenticated;

create or replace view public.source_freshness_v1
with (security_invoker = true)
as
select
  source_key,
  display_name,
  status,
  status_message,
  coverage_label,
  last_observed_at,
  last_successful_run_at,
  is_enabled,
  updated_at
from public.intelligence_sources;

create or replace view public.latest_benchmark_observations_v1
with (security_invoker = true)
as
select
  ranked.id,
  ranked.source_key,
  ranked.canonical_key,
  ranked.model_name,
  ranked.benchmark_key,
  ranked.benchmark_name,
  ranked.version_key,
  ranked.observation_key,
  ranked.source_model_key,
  ranked.value,
  ranked.unit,
  ranked.higher_is_better,
  ranked.observed_at,
  ranked.source_url,
  ranked.metadata
from (
  select
    observation.id,
    source.source_key,
    model.canonical_key,
    model.display_name as model_name,
    definition.benchmark_key,
    definition.display_name as benchmark_name,
    version.version_key,
    observation.observation_key,
    observation.source_model_key,
    observation.value,
    definition.unit,
    definition.higher_is_better,
    observation.observed_at,
    observation.source_url,
    observation.metadata,
    row_number() over (
      partition by observation.canonical_model_id, observation.benchmark_version_id
      order by observation.observed_at desc, observation.id desc
    ) as freshness_rank
  from public.benchmark_observations observation
  join public.intelligence_sources source on source.id = observation.intelligence_source_id
  join public.canonical_models model on model.id = observation.canonical_model_id
  join public.benchmark_versions version on version.id = observation.benchmark_version_id
  join public.benchmark_definitions definition on definition.id = version.benchmark_definition_id
) ranked
where ranked.freshness_rank = 1;

revoke all on table public.source_freshness_v1 from public, anon, authenticated;
revoke all on table public.latest_benchmark_observations_v1 from public, anon, authenticated;
grant select on table public.source_freshness_v1 to anon, authenticated;
grant select on table public.latest_benchmark_observations_v1 to anon, authenticated;

create or replace function public.start_intelligence_ingestion(p_trigger_kind text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id bigint;
begin
  if p_trigger_kind is null or length(btrim(p_trigger_kind)) = 0 then
    raise exception 'ingestion trigger is required';
  end if;
  insert into private.ingestion_runs (trigger_kind)
  values (p_trigger_kind)
  returning id into run_id;
  return run_id;
end;
$$;

create or replace function public.finish_intelligence_ingestion(
  p_run_id bigint,
  p_status text,
  p_summary jsonb default '{}'::jsonb,
  p_error_summary text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid final ingestion status';
  end if;
  update private.ingestion_runs
  set status = p_status,
      finished_at = now(),
      summary = coalesce(p_summary, '{}'::jsonb),
      error_summary = left(p_error_summary, 500)
  where id = p_run_id and status = 'running';
  if not found then
    raise exception 'running ingestion receipt not found';
  end if;
end;
$$;

create or replace function public.start_intelligence_source_ingestion(
  p_run_id bigint,
  p_source_key text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_id bigint;
  source_run_id bigint;
begin
  perform 1
  from private.ingestion_runs
  where id = p_run_id and status = 'running';
  if not found then
    raise exception 'running parent ingestion receipt not found';
  end if;
  select id into source_id
  from public.intelligence_sources
  where source_key = p_source_key;
  if source_id is null then
    raise exception 'intelligence source not found';
  end if;
  insert into private.ingestion_source_runs (ingestion_run_id, intelligence_source_id)
  values (p_run_id, source_id)
  returning id into source_run_id;
  return source_run_id;
end;
$$;

create or replace function public.finish_intelligence_source_ingestion(
  p_source_run_id bigint,
  p_status text,
  p_rows_read integer default 0,
  p_rows_written integer default 0,
  p_error_summary text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid final source status';
  end if;
  update private.ingestion_source_runs
  set status = p_status,
      finished_at = now(),
      rows_read = greatest(coalesce(p_rows_read, 0), 0),
      rows_written = greatest(coalesce(p_rows_written, 0), 0),
      error_summary = left(p_error_summary, 500)
  where id = p_source_run_id and status = 'running';
  if not found then
    raise exception 'running source receipt not found';
  end if;
end;
$$;

revoke all on function public.start_intelligence_ingestion(text) from public, anon, authenticated;
revoke all on function public.finish_intelligence_ingestion(bigint, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.start_intelligence_source_ingestion(bigint, text) from public, anon, authenticated;
revoke all on function public.finish_intelligence_source_ingestion(bigint, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.start_intelligence_ingestion(text) to service_role;
grant execute on function public.finish_intelligence_ingestion(bigint, text, jsonb, text) to service_role;
grant execute on function public.start_intelligence_source_ingestion(bigint, text) to service_role;
grant execute on function public.finish_intelligence_source_ingestion(bigint, text, integer, integer, text) to service_role;

commit;
