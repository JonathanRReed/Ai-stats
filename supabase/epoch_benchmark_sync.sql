-- Extend Epoch benchmark storage so the free CSV export can be synced repeatedly.
-- Apply this before running `bun run sync:epoch`.

begin;

alter table public.epoch_benchmarks
  add column if not exists updated_at timestamptz not null default now();

alter table public.epoch_models
  add column if not exists updated_at timestamptz not null default now();

alter table public.epoch_benchmark_runs
  add column if not exists score_metric text,
  add column if not exists source_name text,
  add column if not exists source_link text,
  add column if not exists raw jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.epoch_benchmark_runs
  drop constraint if exists epoch_benchmark_runs_model_version_benchmark_id_key;

drop index if exists public.epoch_benchmark_runs_model_version_benchmark_id_key;

create table if not exists public.epoch_data_files (
  file_path text primary key,
  row_count integer not null default 0,
  rows jsonb not null default '[]'::jsonb,
  source_url text not null default 'https://epoch.ai/data/benchmark_data.zip',
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists epoch_benchmarks_slug_key
  on public.epoch_benchmarks(slug);

create unique index if not exists epoch_models_model_version_key
  on public.epoch_models(model_version);

drop index if exists public.epoch_benchmark_runs_epoch_run_id_key;

create unique index if not exists epoch_benchmark_runs_epoch_run_id_key
  on public.epoch_benchmark_runs(epoch_run_id);

create index if not exists idx_epoch_benchmark_runs_benchmark_score
  on public.epoch_benchmark_runs(benchmark_id, score desc nulls last);

create index if not exists idx_epoch_benchmark_runs_model_version
  on public.epoch_benchmark_runs(model_version);

alter table public.epoch_benchmarks enable row level security;
alter table public.epoch_models enable row level security;
alter table public.epoch_benchmark_runs enable row level security;
alter table public.epoch_data_files enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'epoch_benchmarks'
      and policyname = 'epoch_benchmarks_select_all'
  ) then
    create policy epoch_benchmarks_select_all
      on public.epoch_benchmarks
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'epoch_models'
      and policyname = 'epoch_models_select_all'
  ) then
    create policy epoch_models_select_all
      on public.epoch_models
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'epoch_benchmark_runs'
      and policyname = 'epoch_benchmark_runs_select_all'
  ) then
    create policy epoch_benchmark_runs_select_all
      on public.epoch_benchmark_runs
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'epoch_data_files'
      and policyname = 'epoch_data_files_select_all'
  ) then
    create policy epoch_data_files_select_all
      on public.epoch_data_files
      for select
      using (true);
  end if;
end;
$$;

commit;
