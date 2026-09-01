begin;

with aa_keys as (
  select
    observation.id,
    observation.intelligence_source_id,
    'artificial-analysis:' || observation.source_model_key || ':' || definition.benchmark_key || ':' ||
      to_char(
        observation.observed_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as canonical_observation_key
  from public.benchmark_observations as observation
  join public.intelligence_sources as source
    on source.id = observation.intelligence_source_id
  join public.benchmark_versions as version
    on version.id = observation.benchmark_version_id
  join public.benchmark_definitions as definition
    on definition.id = version.benchmark_definition_id
  where source.source_key = 'artificial-analysis'
), duplicate_aa as (
  select keys.id
  from aa_keys as keys
  join public.benchmark_observations as canonical
    on canonical.intelligence_source_id = keys.intelligence_source_id
   and canonical.observation_key = keys.canonical_observation_key
   and canonical.id <> keys.id
)
delete from public.benchmark_observations as observation
using duplicate_aa as duplicate
where observation.id = duplicate.id;

with aa_keys as (
  select
    observation.id,
    'artificial-analysis:' || observation.source_model_key || ':' || definition.benchmark_key || ':' ||
      to_char(
        observation.observed_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as canonical_observation_key
  from public.benchmark_observations as observation
  join public.intelligence_sources as source
    on source.id = observation.intelligence_source_id
  join public.benchmark_versions as version
    on version.id = observation.benchmark_version_id
  join public.benchmark_definitions as definition
    on definition.id = version.benchmark_definition_id
  where source.source_key = 'artificial-analysis'
)
update public.benchmark_observations as observation
set observation_key = keys.canonical_observation_key,
    updated_at = now()
from aa_keys as keys
where observation.id = keys.id
  and observation.observation_key <> keys.canonical_observation_key;

with epoch_keys as (
  select
    observation.id,
    observation.intelligence_source_id,
    'epoch-ai:' || coalesce(nullif(btrim(run.epoch_run_id), ''), run.id::text)
      as canonical_observation_key
  from public.benchmark_observations as observation
  join public.intelligence_sources as source
    on source.id = observation.intelligence_source_id
  join public.epoch_benchmark_runs as run
    on observation.observation_key = 'epoch-ai:' || run.id::text
  where source.source_key = 'epoch-ai'
), duplicate_epoch as (
  select keys.id
  from epoch_keys as keys
  join public.benchmark_observations as canonical
    on canonical.intelligence_source_id = keys.intelligence_source_id
   and canonical.observation_key = keys.canonical_observation_key
   and canonical.id <> keys.id
)
delete from public.benchmark_observations as observation
using duplicate_epoch as duplicate
where observation.id = duplicate.id;

with epoch_keys as (
  select
    observation.id,
    'epoch-ai:' || coalesce(nullif(btrim(run.epoch_run_id), ''), run.id::text)
      as canonical_observation_key
  from public.benchmark_observations as observation
  join public.intelligence_sources as source
    on source.id = observation.intelligence_source_id
  join public.epoch_benchmark_runs as run
    on observation.observation_key = 'epoch-ai:' || run.id::text
  where source.source_key = 'epoch-ai'
)
update public.benchmark_observations as observation
set observation_key = keys.canonical_observation_key,
    updated_at = now()
from epoch_keys as keys
where observation.id = keys.id
  and observation.observation_key <> keys.canonical_observation_key;

do $$
declare
  noncanonical_aa bigint;
  legacy_epoch_keys bigint;
begin
  select count(*)
  into noncanonical_aa
  from public.benchmark_observations as observation
  join public.intelligence_sources as source
    on source.id = observation.intelligence_source_id
  join public.benchmark_versions as version
    on version.id = observation.benchmark_version_id
  join public.benchmark_definitions as definition
    on definition.id = version.benchmark_definition_id
  where source.source_key = 'artificial-analysis'
    and observation.observation_key <>
      'artificial-analysis:' || observation.source_model_key || ':' || definition.benchmark_key || ':' ||
      to_char(
        observation.observed_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      );

  select count(*)
  into legacy_epoch_keys
  from public.benchmark_observations as observation
  join public.intelligence_sources as source
    on source.id = observation.intelligence_source_id
  join public.epoch_benchmark_runs as run
    on observation.observation_key = 'epoch-ai:' || run.id::text
  where source.source_key = 'epoch-ai'
    and nullif(btrim(run.epoch_run_id), '') is not null;

  if noncanonical_aa <> 0 or legacy_epoch_keys <> 0 then
    raise exception 'source-native observation reconciliation failed: aa=%, epoch=%',
      noncanonical_aa,
      legacy_epoch_keys;
  end if;
end
$$;

commit;
