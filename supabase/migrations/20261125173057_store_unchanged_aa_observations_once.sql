-- Change-only storage for Artificial Analysis benchmark observations.
-- Rows that follow the standard AA shape are stored once per run of identical values.
-- Every original row (id, key, value, timestamps, metadata) can be rebuilt exactly
-- from public.benchmark_observation_history_v1.

-- The fold below reads and rewrites every Artificial Analysis row; the default 2 minute limit is too short.
set local statement_timeout = '20min';
set local work_mem = '64MB';

create table if not exists public.benchmark_observation_series (
  id integer generated always as identity primary key,
  intelligence_source_id bigint not null references public.intelligence_sources(id) on delete cascade,
  canonical_model_id bigint not null references public.canonical_models(id) on delete cascade,
  benchmark_version_id bigint not null references public.benchmark_versions(id) on delete cascade,
  source_model_key text not null,
  key_prefix text not null,
  constraint benchmark_observation_series_key unique (
    intelligence_source_id, canonical_model_id, benchmark_version_id, source_model_key, key_prefix
  )
);

create table if not exists public.benchmark_observation_metadata (
  id integer generated always as identity primary key,
  metadata jsonb not null
);
-- Keyed on the text form so numbers keep their exact scale (1.5 and 1.50 stay distinct).
create unique index if not exists benchmark_observation_metadata_text_key
  on public.benchmark_observation_metadata ((metadata::text));

create table if not exists public.benchmark_observation_runs (
  series_id integer not null references public.benchmark_observation_series(id) on delete cascade,
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  value numeric,
  source_url text,
  metadata_id integer not null references public.benchmark_observation_metadata(id),
  observation_ids bigint[] not null,
  observed_ats timestamptz[] not null,
  ingested_ats timestamptz[] not null,
  primary key (series_id, first_observed_at),
  constraint benchmark_observation_runs_shape check (
    cardinality(observation_ids) >= 1
    and cardinality(observed_ats) = cardinality(observation_ids)
    and cardinality(ingested_ats) = cardinality(observation_ids)
    and observed_ats[1] = first_observed_at
    and observed_ats[cardinality(observed_ats)] = last_observed_at
  )
);

alter table public.benchmark_observation_series enable row level security;
alter table public.benchmark_observation_metadata enable row level security;
alter table public.benchmark_observation_runs enable row level security;

drop policy if exists benchmark_observation_series_select on public.benchmark_observation_series;
create policy benchmark_observation_series_select on public.benchmark_observation_series
  for select to anon, authenticated using (true);
drop policy if exists benchmark_observation_metadata_select on public.benchmark_observation_metadata;
create policy benchmark_observation_metadata_select on public.benchmark_observation_metadata
  for select to anon, authenticated using (true);
drop policy if exists benchmark_observation_runs_select on public.benchmark_observation_runs;
create policy benchmark_observation_runs_select on public.benchmark_observation_runs
  for select to anon, authenticated using (true);

revoke all on table public.benchmark_observation_series from public, anon, authenticated;
revoke all on table public.benchmark_observation_metadata from public, anon, authenticated;
revoke all on table public.benchmark_observation_runs from public, anon, authenticated;
grant select on table public.benchmark_observation_series to anon, authenticated;
grant select on table public.benchmark_observation_metadata to anon, authenticated;
grant select on table public.benchmark_observation_runs to anon, authenticated;
grant select on table public.benchmark_observation_series to service_role;
grant select on table public.benchmark_observation_metadata to service_role;
grant select on table public.benchmark_observation_runs to service_role;

-- The AA timestamp format used in observation keys and metadata.observed_at.
create or replace function private.aa_observed_at_text(p_observed_at timestamptz)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select to_char(p_observed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- True when a row can be rebuilt exactly from series, run and per-observation arrays.
create or replace function private.aa_observation_is_compressible(
  p_source_id bigint, p_observation_key text, p_source_model_key text,
  p_observed_at timestamptz, p_metadata jsonb, p_updated_at timestamptz
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    p_source_id = 1
    and p_updated_at = p_observed_at
    and jsonb_typeof(p_metadata -> 'observed_at') = 'string'
    and p_metadata ->> 'observed_at' = private.aa_observed_at_text(p_observed_at)
    and right(p_observation_key, length(p_metadata ->> 'observed_at') + 1) = ':' || (p_metadata ->> 'observed_at')
    and left(p_observation_key, length('artificial-analysis:' || p_source_model_key || ':'))
      = 'artificial-analysis:' || p_source_model_key || ':',
    false)
$$;

-- Every observation, exactly as it was written to benchmark_observations.
create or replace view public.benchmark_observation_history_v1
with (security_invoker = true)
as
select
  b.id, b.intelligence_source_id, b.canonical_model_id, b.benchmark_version_id, b.observation_key,
  b.source_model_key, b.value, b.observed_at, b.source_url, b.metadata, b.ingested_at, b.updated_at
from public.benchmark_observations b
union all
select
  u.id, s.intelligence_source_id, s.canonical_model_id, s.benchmark_version_id,
  s.key_prefix || to_char(u.observed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  s.source_model_key, r.value, u.observed_at, r.source_url,
  m.metadata || jsonb_build_object('observed_at', to_char(u.observed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  u.ingested_at, u.observed_at
from public.benchmark_observation_runs r
join public.benchmark_observation_series s on s.id = r.series_id
join public.benchmark_observation_metadata m on m.id = r.metadata_id
cross join lateral unnest(r.observation_ids, r.observed_ats, r.ingested_ats) as u(id, observed_at, ingested_at);

revoke all on table public.benchmark_observation_history_v1 from public, anon, authenticated;
grant select on table public.benchmark_observation_history_v1 to anon, authenticated, service_role;

-- Latest value per model and benchmark, reading only the newest observation of each run.
-- A plain row wins a tie with a run entry of the same id: it is the newer version of that key.
create or replace view public.latest_benchmark_observations_v1
with (security_invoker = true)
as
select
  ranked.id, ranked.source_key, ranked.canonical_key, ranked.model_name, ranked.benchmark_key,
  ranked.benchmark_name, ranked.version_key, ranked.observation_key, ranked.source_model_key,
  ranked.value, ranked.unit, ranked.higher_is_better, ranked.observed_at, ranked.source_url, ranked.metadata
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
      order by observation.observed_at desc, observation.id desc, observation.from_run
    ) as freshness_rank
  from (
    select b.id, b.intelligence_source_id, b.canonical_model_id, b.benchmark_version_id, b.observation_key,
      b.source_model_key, b.value, b.observed_at, b.source_url, b.metadata, false as from_run
    from public.benchmark_observations b
    union all
    select r.observation_ids[cardinality(r.observation_ids)], s.intelligence_source_id, s.canonical_model_id,
      s.benchmark_version_id, s.key_prefix || to_char(r.last_observed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      s.source_model_key, r.value, r.last_observed_at, r.source_url,
      m.metadata || jsonb_build_object('observed_at', to_char(r.last_observed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      true
    from public.benchmark_observation_runs r
    join public.benchmark_observation_series s on s.id = r.series_id
    join public.benchmark_observation_metadata m on m.id = r.metadata_id
  ) observation
  join public.intelligence_sources source on source.id = observation.intelligence_source_id
  join public.canonical_models model on model.id = observation.canonical_model_id
  join public.benchmark_versions version on version.id = observation.benchmark_version_id
  join public.benchmark_definitions definition on definition.id = version.benchmark_definition_id
) ranked
where ranked.freshness_rank = 1;

revoke all on table public.latest_benchmark_observations_v1 from public, anon, authenticated;
grant select on table public.latest_benchmark_observations_v1 to anon, authenticated;

-- Folds a standard AA row into its run and skips the plain insert.
-- Anything that is not a plain append (other sources, odd shapes, out-of-order or changed re-sends)
-- falls through to benchmark_observations unchanged, so no value is ever dropped.
create or replace function private.compress_aa_benchmark_observation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ts text;
  v_prefix text;
  v_series integer;
  v_meta integer;
  v_run public.benchmark_observation_runs%rowtype;
begin
  if not private.aa_observation_is_compressible(
    new.intelligence_source_id, new.observation_key, new.source_model_key,
    new.observed_at, new.metadata, new.updated_at
  ) then
    return new;
  end if;

  -- A key already stored as a plain row keeps the normal upsert path.
  if exists (
    select 1 from public.benchmark_observations b
    where b.intelligence_source_id = new.intelligence_source_id and b.observation_key = new.observation_key
  ) then
    return new;
  end if;

  v_ts := new.metadata ->> 'observed_at';
  v_prefix := left(new.observation_key, length(new.observation_key) - length(v_ts));

  insert into public.benchmark_observation_series
    (intelligence_source_id, canonical_model_id, benchmark_version_id, source_model_key, key_prefix)
  values (new.intelligence_source_id, new.canonical_model_id, new.benchmark_version_id, new.source_model_key, v_prefix)
  on conflict on constraint benchmark_observation_series_key do nothing
  returning id into v_series;
  if v_series is null then
    select s.id into strict v_series from public.benchmark_observation_series s
    where s.intelligence_source_id = new.intelligence_source_id
      and s.canonical_model_id = new.canonical_model_id
      and s.benchmark_version_id = new.benchmark_version_id
      and s.source_model_key = new.source_model_key
      and s.key_prefix = v_prefix;
  end if;

  insert into public.benchmark_observation_metadata (metadata)
  values (new.metadata - 'observed_at')
  on conflict ((metadata::text)) do nothing
  returning id into v_meta;
  if v_meta is null then
    select m.id into strict v_meta from public.benchmark_observation_metadata m
    where m.metadata::text = (new.metadata - 'observed_at')::text;
  end if;

  select * into v_run from public.benchmark_observation_runs r
  where r.series_id = v_series and r.first_observed_at <= new.observed_at
  order by r.first_observed_at desc
  limit 1
  for update;

  if found then
    if new.observed_at = any(v_run.observed_ats) then
      -- Same key sent again: identical values change nothing. A changed value becomes a plain row
      -- with the original id and ingested_at, as the upsert would have left it, and the folded
      -- original stays in its run, so both versions remain readable.
      if v_run.value::text is not distinct from new.value::text
        and v_run.source_url is not distinct from new.source_url
        and v_run.metadata_id = v_meta then
        return null;
      end if;
      new.id := v_run.observation_ids[array_position(v_run.observed_ats, new.observed_at)];
      new.ingested_at := v_run.ingested_ats[array_position(v_run.observed_ats, new.observed_at)];
      return new;
    end if;
    if new.observed_at < v_run.last_observed_at then
      return new;
    end if;
    if v_run.value::text is not distinct from new.value::text
      and v_run.source_url is not distinct from new.source_url
      and v_run.metadata_id = v_meta then
      update public.benchmark_observation_runs r
      set last_observed_at = new.observed_at,
          observation_ids = r.observation_ids || new.id,
          observed_ats = r.observed_ats || new.observed_at,
          ingested_ats = r.ingested_ats || new.ingested_at
      where r.series_id = v_run.series_id and r.first_observed_at = v_run.first_observed_at;
      return null;
    end if;
  end if;

  -- A new value starts a new run, but only at the end of the series.
  if exists (
    select 1 from public.benchmark_observation_runs r
    where r.series_id = v_series and r.first_observed_at > new.observed_at
  ) then
    return new;
  end if;

  insert into public.benchmark_observation_runs
    (series_id, first_observed_at, last_observed_at, value, source_url, metadata_id,
     observation_ids, observed_ats, ingested_ats)
  values
    (v_series, new.observed_at, new.observed_at, new.value, new.source_url, v_meta,
     array[new.id], array[new.observed_at], array[new.ingested_at]);
  return null;
end;
$$;

revoke all on function private.compress_aa_benchmark_observation() from public, anon, authenticated;

-- Fold the existing standard rows into runs, prove every one rebuilds exactly, then remove the
-- plain copies. One statement, so a failed check rolls all of it back. Safe to run again:
-- rows already folded are gone from benchmark_observations and are not picked up twice.
do $$
declare
  v_folded bigint;
  v_runs_hits bigint;
  v_mismatched bigint;
  v_deleted bigint;
  v_duplicate_ids bigint;
begin
  create temporary table aa_fold on commit drop as
  select b.id, b.intelligence_source_id, b.canonical_model_id, b.benchmark_version_id, b.source_model_key,
    left(b.observation_key, length(b.observation_key) - length(b.metadata ->> 'observed_at')) as key_prefix,
    b.metadata - 'observed_at' as metadata, b.value, b.source_url, b.observed_at, b.ingested_at
  from public.benchmark_observations b
  where private.aa_observation_is_compressible(
    b.intelligence_source_id, b.observation_key, b.source_model_key, b.observed_at, b.metadata, b.updated_at);
  insert into public.benchmark_observation_series
    (intelligence_source_id, canonical_model_id, benchmark_version_id, source_model_key, key_prefix)
  select distinct f.intelligence_source_id, f.canonical_model_id, f.benchmark_version_id, f.source_model_key, f.key_prefix
  from aa_fold f
  on conflict on constraint benchmark_observation_series_key do nothing;

  insert into public.benchmark_observation_metadata (metadata)
  select distinct on (f.metadata::text) f.metadata from aa_fold f
  on conflict ((metadata::text)) do nothing;

  -- Rows of a series that already has runs (a rerun after new data) stay plain.
  create temporary table aa_new on commit drop as
  select s.id as series_id, m.id as metadata_id, f.id, f.value, f.source_url, f.observed_at, f.ingested_at
  from aa_fold f
  join public.benchmark_observation_series s
    on s.intelligence_source_id = f.intelligence_source_id
   and s.canonical_model_id = f.canonical_model_id
   and s.benchmark_version_id = f.benchmark_version_id
   and s.source_model_key = f.source_model_key
   and s.key_prefix = f.key_prefix
  join public.benchmark_observation_metadata m on m.metadata::text = f.metadata::text
  where not exists (select 1 from public.benchmark_observation_runs r where r.series_id = s.id);
  select count(*) into v_folded from aa_new;

  with flagged as (
    select p.*,
      case when lag(p.id) over w is null
        or p.value::text is distinct from lag(p.value::text) over w
        or p.source_url is distinct from lag(p.source_url) over w
        or p.metadata_id <> lag(p.metadata_id) over w
      then 1 else 0 end as starts_run
    from aa_new p
    window w as (partition by p.series_id order by p.observed_at, p.id)
  ),
  grouped as (
    select f.*, sum(f.starts_run) over (partition by f.series_id order by f.observed_at, f.id) as run_no
    from flagged f
  )
  insert into public.benchmark_observation_runs
    (series_id, first_observed_at, last_observed_at, value, source_url, metadata_id,
     observation_ids, observed_ats, ingested_ats)
  select g.series_id, min(g.observed_at), max(g.observed_at), g.value, g.source_url, g.metadata_id,
    array_agg(g.id order by g.observed_at, g.id),
    array_agg(g.observed_at order by g.observed_at, g.id),
    array_agg(g.ingested_at order by g.observed_at, g.id)
  from grouped g
  group by g.series_id, g.run_no, g.value::text, g.value, g.source_url, g.metadata_id;

  -- Every row folded now must sit in exactly one run and rebuild exactly as stored.
  with rebuilt as (
    select u.id, s.intelligence_source_id, s.canonical_model_id, s.benchmark_version_id,
      s.key_prefix || private.aa_observed_at_text(u.observed_at) as observation_key,
      s.source_model_key, r.value, u.observed_at, r.source_url,
      m.metadata || jsonb_build_object('observed_at', private.aa_observed_at_text(u.observed_at)) as metadata,
      u.ingested_at, u.observed_at as updated_at
    from public.benchmark_observation_runs r
    join public.benchmark_observation_series s on s.id = r.series_id
    join public.benchmark_observation_metadata m on m.id = r.metadata_id
    cross join lateral unnest(r.observation_ids, r.observed_ats, r.ingested_ats) as u(id, observed_at, ingested_at)
    where r.series_id in (select n.series_id from aa_new n)
  )
  select
    count(*),
    count(*) - count(distinct x.id),
    count(*) filter (where row(b.intelligence_source_id, b.canonical_model_id, b.benchmark_version_id, b.observation_key,
        b.source_model_key, b.value::text, b.observed_at, b.source_url, b.metadata::text, b.ingested_at, b.updated_at)
      is distinct from
        row(x.intelligence_source_id, x.canonical_model_id, x.benchmark_version_id, x.observation_key,
        x.source_model_key, x.value::text, x.observed_at, x.source_url, x.metadata::text, x.ingested_at, x.updated_at))
  into v_runs_hits, v_duplicate_ids, v_mismatched
  from rebuilt x
  join aa_new n on n.id = x.id
  left join public.benchmark_observations b on b.id = x.id;

  if v_mismatched <> 0 then
    raise exception 'fold check failed: % folded rows do not rebuild exactly', v_mismatched;
  end if;
  if v_duplicate_ids <> 0 or v_runs_hits <> v_folded then
    raise exception 'fold check failed: % rows folded, % found in runs, % duplicated', v_folded, v_runs_hits, v_duplicate_ids;
  end if;

  delete from public.benchmark_observations b
  using aa_new n
  where b.id = n.id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> v_folded then
    raise exception 'fold check failed: deleted % plain rows, expected %', v_deleted, v_folded;
  end if;
  raise notice 'folded % rows into runs', v_deleted;
end;
$$;

drop trigger if exists benchmark_observations_compress_aa on public.benchmark_observations;
create trigger benchmark_observations_compress_aa
  before insert on public.benchmark_observations
  for each row execute function private.compress_aa_benchmark_observation();