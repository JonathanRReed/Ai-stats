begin;

drop policy if exists "public read models" on public.aa_models;
drop policy if exists "Allow public read epoch_models" on public.epoch_models;
drop policy if exists "Allow public read epoch_benchmarks" on public.epoch_benchmarks;
drop policy if exists "Allow public read epoch_benchmark_runs" on public.epoch_benchmark_runs;

insert into public.epoch_models (
  model_version,
  model_name,
  display_name,
  organization,
  country,
  release_date,
  description
)
select
  run.model_version,
  run.model_version,
  run.model_version,
  max(run.organization),
  max(run.country),
  min(run.release_date),
  'Backfilled from Epoch benchmark runs to restore source-native model linkage.'
from public.epoch_benchmark_runs as run
left join public.epoch_models as model on model.model_version = run.model_version
where run.epoch_model_id is null
  and model.id is null
group by run.model_version
on conflict (model_version) do update set
  model_name = coalesce(public.epoch_models.model_name, excluded.model_name),
  display_name = coalesce(nullif(public.epoch_models.display_name, ''), excluded.display_name),
  organization = coalesce(public.epoch_models.organization, excluded.organization),
  country = coalesce(public.epoch_models.country, excluded.country),
  release_date = coalesce(public.epoch_models.release_date, excluded.release_date),
  description = coalesce(public.epoch_models.description, excluded.description),
  updated_at = now();

update public.epoch_benchmark_runs as run
set epoch_model_id = model.id,
    updated_at = now()
from public.epoch_models as model
where run.epoch_model_id is null
  and run.model_version = model.model_version;

insert into public.intelligence_sources (
  source_key,
  display_name,
  description,
  homepage_url,
  status,
  status_message,
  coverage_label,
  last_observed_at,
  last_successful_run_at,
  metadata,
  updated_at
)
values
  (
    'artificial-analysis',
    'Artificial Analysis',
    'Independent model quality, price, speed, and latency measurements.',
    'https://artificialanalysis.ai/',
    'unavailable',
    'Awaiting legacy source backfill.',
    '0 models',
    null,
    null,
    jsonb_build_object('provenance', 'public.aa_models'),
    now()
  ),
  (
    'epoch-ai',
    'Epoch AI',
    'Source-native benchmark records from Epoch AI public data exports.',
    'https://epoch.ai/',
    'unavailable',
    'Awaiting legacy source backfill.',
    '0 models, 0 observations',
    null,
    null,
    jsonb_build_object('provenance', 'public.epoch_models and public.epoch_benchmark_runs'),
    now()
  ),
  (
    'openrouter',
    'OpenRouter',
    'Public model catalog, pricing, capabilities, and provider metadata.',
    'https://openrouter.ai/',
    'unavailable',
    'Catalog sync has not completed.',
    '0 models',
    null,
    null,
    jsonb_build_object('provenance', 'OpenRouter public catalog API'),
    now()
  ),
  (
    'polibench',
    'PoliBench',
    'Operational model-output evidence with directional political profiles.',
    'https://github.com/JonathanRReed/Poli-bench',
    'unavailable',
    'Snapshot sync has not completed.',
    '0 models, 0 runs',
    null,
    null,
    jsonb_build_object('provenance', 'JonathanRReed/Poli-bench release artifact'),
    now()
  )
on conflict (source_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  metadata = public.intelligence_sources.metadata || excluded.metadata,
  updated_at = excluded.updated_at;

with ranked_aa as (
  select
    model.*,
    row_number() over (
      partition by model.slug
      order by model.last_seen desc, model.first_seen desc, model.id
    ) as freshness_rank
  from public.aa_models as model
  where nullif(btrim(model.slug), '') is not null
)
insert into public.canonical_models (
  canonical_key,
  display_name,
  provider_name,
  model_family,
  metadata,
  updated_at
)
select
  'artificial-analysis:' || model.slug,
  coalesce(nullif(btrim(model.name), ''), model.slug),
  coalesce(nullif(btrim(model.creator_name), ''), nullif(btrim(model.creator_slug), '')),
  null,
  jsonb_build_object('source', 'artificial-analysis'),
  model.last_seen
from ranked_aa as model
where model.freshness_rank = 1
on conflict (canonical_key) do update set
  display_name = excluded.display_name,
  provider_name = excluded.provider_name,
  metadata = public.canonical_models.metadata || excluded.metadata,
  updated_at = excluded.updated_at;

insert into public.canonical_models (
  canonical_key,
  display_name,
  provider_name,
  model_family,
  release_date,
  metadata,
  updated_at
)
select
  'epoch-ai:' || model.model_version,
  coalesce(nullif(btrim(model.display_name), ''), nullif(btrim(model.model_name), ''), model.model_version),
  nullif(btrim(model.organization), ''),
  nullif(btrim(model.model_name), ''),
  model.release_date,
  jsonb_build_object(
    'source', 'epoch-ai',
    'country', model.country,
    'accessibility', model.model_accessibility,
    'trainingComputeFlop', model.training_compute_flop
  ),
  model.updated_at
from public.epoch_models as model
on conflict (canonical_key) do update set
  display_name = excluded.display_name,
  provider_name = excluded.provider_name,
  model_family = excluded.model_family,
  release_date = excluded.release_date,
  metadata = public.canonical_models.metadata || excluded.metadata,
  updated_at = excluded.updated_at;

with ranked_aa as (
  select
    model.*,
    row_number() over (
      partition by model.slug
      order by model.last_seen desc, model.first_seen desc, model.id
    ) as freshness_rank
  from public.aa_models as model
  where nullif(btrim(model.slug), '') is not null
)
insert into public.model_aliases (
  canonical_model_id,
  intelligence_source_id,
  source_model_key,
  source_model_name,
  match_method,
  provenance,
  confidence,
  updated_at
)
select
  canonical.id,
  source.id,
  model.slug,
  coalesce(nullif(btrim(model.name), ''), model.slug),
  'source_native',
  'Artificial Analysis source-native identity from public.aa_models',
  1,
  model.last_seen
from ranked_aa as model
join public.canonical_models as canonical
  on canonical.canonical_key = 'artificial-analysis:' || model.slug
join public.intelligence_sources as source on source.source_key = 'artificial-analysis'
where model.freshness_rank = 1
on conflict (intelligence_source_id, source_model_key) do update set
  canonical_model_id = excluded.canonical_model_id,
  source_model_name = excluded.source_model_name,
  match_method = excluded.match_method,
  provenance = excluded.provenance,
  confidence = excluded.confidence,
  updated_at = excluded.updated_at;

insert into public.model_aliases (
  canonical_model_id,
  intelligence_source_id,
  source_model_key,
  source_model_name,
  match_method,
  provenance,
  confidence,
  updated_at
)
select
  canonical.id,
  source.id,
  model.model_version,
  coalesce(nullif(btrim(model.display_name), ''), nullif(btrim(model.model_name), ''), model.model_version),
  'source_native',
  'Epoch AI source-native identity from public.epoch_models',
  1,
  model.updated_at
from public.epoch_models as model
join public.canonical_models as canonical
  on canonical.canonical_key = 'epoch-ai:' || model.model_version
join public.intelligence_sources as source on source.source_key = 'epoch-ai'
on conflict (intelligence_source_id, source_model_key) do update set
  canonical_model_id = excluded.canonical_model_id,
  source_model_name = excluded.source_model_name,
  match_method = excluded.match_method,
  provenance = excluded.provenance,
  confidence = excluded.confidence,
  updated_at = excluded.updated_at;

with aa_metrics(benchmark_key, display_name, domain, unit, higher_is_better) as (
  values
    ('aa_intelligence_index', 'Artificial Analysis Intelligence Index', 'quality', 'index_points', true),
    ('aa_coding_index', 'Artificial Analysis Coding Index', 'coding', 'index_points', true),
    ('aa_math_index', 'Artificial Analysis Math Index', 'math', 'index_points', true),
    ('mmlu_pro', 'MMLU-Pro', 'knowledge', 'score', true),
    ('gpqa', 'GPQA', 'reasoning', 'score', true),
    ('hle', 'Humanity''s Last Exam', 'reasoning', 'score', true),
    ('livecodebench', 'LiveCodeBench', 'coding', 'score', true),
    ('scicode', 'SciCode', 'coding', 'score', true),
    ('math_500', 'MATH-500', 'math', 'score', true),
    ('aime', 'AIME', 'math', 'score', true),
    ('price_1m_blended_3_to_1', 'Blended token price', 'cost', 'usd_per_million_tokens', false),
    ('price_1m_input_tokens', 'Input token price', 'cost', 'usd_per_million_tokens', false),
    ('price_1m_output_tokens', 'Output token price', 'cost', 'usd_per_million_tokens', false),
    ('median_output_tokens_per_second', 'Median output speed', 'speed', 'tokens_per_second', true),
    ('median_time_to_first_token_seconds', 'Median time to first token', 'latency', 'seconds', false),
    ('median_time_to_first_answer_token', 'Median time to first answer token', 'latency', 'seconds', false)
)
insert into public.benchmark_definitions (
  intelligence_source_id,
  benchmark_key,
  display_name,
  domain,
  unit,
  higher_is_better,
  description,
  metadata,
  updated_at
)
select
  source.id,
  metric.benchmark_key,
  metric.display_name,
  metric.domain,
  metric.unit,
  metric.higher_is_better,
  'Source-native Artificial Analysis measurement.',
  jsonb_build_object('evidenceType', metric.domain),
  now()
from aa_metrics as metric
join public.intelligence_sources as source on source.source_key = 'artificial-analysis'
on conflict (intelligence_source_id, benchmark_key) do update set
  display_name = excluded.display_name,
  domain = excluded.domain,
  unit = excluded.unit,
  higher_is_better = excluded.higher_is_better,
  description = excluded.description,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

insert into public.benchmark_definitions (
  intelligence_source_id,
  benchmark_key,
  display_name,
  domain,
  unit,
  higher_is_better,
  description,
  metadata,
  updated_at
)
select
  source.id,
  benchmark.slug,
  benchmark.name,
  'source_native_benchmark',
  'source_native_score',
  true,
  benchmark.description,
  jsonb_build_object('source', benchmark.source),
  benchmark.updated_at
from public.epoch_benchmarks as benchmark
join public.intelligence_sources as source on source.source_key = 'epoch-ai'
on conflict (intelligence_source_id, benchmark_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

insert into public.benchmark_versions (
  benchmark_definition_id,
  version_key,
  methodology_url,
  metadata,
  updated_at
)
select
  definition.id,
  'source-native-current',
  case
    when source.source_key = 'artificial-analysis'
      then 'https://artificialanalysis.ai/methodology/intelligence-benchmarking'
    else null
  end,
  '{}'::jsonb,
  now()
from public.benchmark_definitions as definition
join public.intelligence_sources as source on source.id = definition.intelligence_source_id
where source.source_key in ('artificial-analysis', 'epoch-ai')
on conflict (benchmark_definition_id, version_key) do update set
  methodology_url = excluded.methodology_url,
  updated_at = excluded.updated_at;

with ranked_aa as (
  select
    model.*,
    row_number() over (
      partition by model.slug
      order by model.last_seen desc, model.first_seen desc, model.id
    ) as freshness_rank
  from public.aa_models as model
  where nullif(btrim(model.slug), '') is not null
), aa_observations as (
  select
    model.slug,
    model.last_seen,
    metric.benchmark_key,
    metric.value
  from ranked_aa as model
  cross join lateral (
    values
      ('aa_intelligence_index', model.aa_intelligence_index),
      ('aa_coding_index', model.aa_coding_index),
      ('aa_math_index', model.aa_math_index),
      ('mmlu_pro', model.mmlu_pro),
      ('gpqa', model.gpqa),
      ('hle', model.hle),
      ('livecodebench', model.livecodebench),
      ('scicode', model.scicode),
      ('math_500', model.math_500),
      ('aime', model.aime),
      ('price_1m_blended_3_to_1', model.price_1m_blended_3_to_1),
      ('price_1m_input_tokens', model.price_1m_input_tokens),
      ('price_1m_output_tokens', model.price_1m_output_tokens),
      ('median_output_tokens_per_second', model.median_output_tokens_per_second),
      ('median_time_to_first_token_seconds', model.median_time_to_first_token_seconds),
      ('median_time_to_first_answer_token', model.median_time_to_first_answer_token)
  ) as metric(benchmark_key, value)
  where model.freshness_rank = 1
    and metric.value is not null
)
insert into public.benchmark_observations (
  intelligence_source_id,
  canonical_model_id,
  benchmark_version_id,
  observation_key,
  source_model_key,
  value,
  observed_at,
  metadata,
  updated_at
)
select
  source.id,
  canonical.id,
  version.id,
  'artificial-analysis:' || observation.slug || ':' || observation.benchmark_key || ':' || observation.last_seen::text,
  observation.slug,
  observation.value,
  observation.last_seen,
  '{}'::jsonb,
  observation.last_seen
from aa_observations as observation
join public.intelligence_sources as source on source.source_key = 'artificial-analysis'
join public.canonical_models as canonical
  on canonical.canonical_key = 'artificial-analysis:' || observation.slug
join public.benchmark_definitions as definition
  on definition.intelligence_source_id = source.id
  and definition.benchmark_key = observation.benchmark_key
join public.benchmark_versions as version
  on version.benchmark_definition_id = definition.id
  and version.version_key = 'source-native-current'
on conflict (intelligence_source_id, observation_key) do update set
  canonical_model_id = excluded.canonical_model_id,
  benchmark_version_id = excluded.benchmark_version_id,
  value = excluded.value,
  observed_at = excluded.observed_at,
  updated_at = excluded.updated_at;

insert into public.benchmark_observations (
  intelligence_source_id,
  canonical_model_id,
  benchmark_version_id,
  observation_key,
  source_model_key,
  value,
  observed_at,
  source_url,
  metadata,
  updated_at
)
select
  source.id,
  canonical.id,
  version.id,
  'epoch-ai:' || run.id::text,
  run.model_version,
  run.score,
  coalesce(run.updated_at, run.created_at, run.started_at, now()),
  case when run.source_link ~ '^https://' then run.source_link else null end,
  jsonb_strip_nulls(jsonb_build_object(
    'scoreMetric', run.score_metric,
    'sourceName', run.source_name,
    'originalSourceLink', run.source_link,
    'stderr', run.stderr
  )),
  coalesce(run.updated_at, run.created_at, run.started_at, now())
from public.epoch_benchmark_runs as run
join public.epoch_benchmarks as benchmark on benchmark.id = run.benchmark_id
join public.intelligence_sources as source on source.source_key = 'epoch-ai'
join public.canonical_models as canonical
  on canonical.canonical_key = 'epoch-ai:' || run.model_version
join public.benchmark_definitions as definition
  on definition.intelligence_source_id = source.id
  and definition.benchmark_key = benchmark.slug
join public.benchmark_versions as version
  on version.benchmark_definition_id = definition.id
  and version.version_key = 'source-native-current'
where run.score is not null
on conflict (intelligence_source_id, observation_key) do update set
  canonical_model_id = excluded.canonical_model_id,
  benchmark_version_id = excluded.benchmark_version_id,
  value = excluded.value,
  observed_at = excluded.observed_at,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

update public.intelligence_sources as source
set status = case
      when source.source_key = 'artificial-analysis' and snapshot.observed_at >= now() - interval '14 days' then 'healthy'
      when source.source_key = 'epoch-ai' and snapshot.observed_at >= now() - interval '90 days' then 'healthy'
      else 'stale'
    end,
    status_message = case
      when source.source_key = 'artificial-analysis' then 'Backfilled from the latest admitted Artificial Analysis model rows.'
      else 'Backfilled from the latest admitted Epoch AI export. Freshness is source-native.'
    end,
    coverage_label = snapshot.coverage_label,
    last_observed_at = snapshot.observed_at,
    last_successful_run_at = now(),
    updated_at = now()
from (
  select
    'artificial-analysis'::text as source_key,
    max(model.last_seen) as observed_at,
    count(distinct model.slug) || ' models' as coverage_label
  from public.aa_models as model
  where nullif(btrim(model.slug), '') is not null
  union all
  select
    'epoch-ai'::text,
    max(greatest(model.updated_at, run.updated_at)),
    count(distinct model.id) || ' models, ' || count(distinct run.id) || ' observations'
  from public.epoch_models as model
  left join public.epoch_benchmark_runs as run on run.epoch_model_id = model.id
) as snapshot
where source.source_key = snapshot.source_key;

do $$
declare
  migration_run_id bigint;
begin
  insert into private.ingestion_runs (
    trigger_kind,
    status,
    started_at,
    finished_at,
    summary
  )
  values (
    'migration:20260901000200',
    'succeeded',
    now(),
    now(),
    jsonb_build_object('mode', 'legacy-source-backfill', 'sources', 2)
  )
  returning id into migration_run_id;

  insert into private.ingestion_source_runs (
    ingestion_run_id,
    intelligence_source_id,
    status,
    started_at,
    finished_at,
    rows_read,
    rows_written
  )
  select
    migration_run_id,
    source.id,
    'succeeded',
    now(),
    now(),
    case source.source_key
      when 'artificial-analysis' then (select count(*) from public.aa_models)
      else (select count(*) from public.epoch_benchmark_runs)
    end,
    (
      select count(*)
      from public.benchmark_observations as observation
      where observation.intelligence_source_id = source.id
    )
  from public.intelligence_sources as source
  where source.source_key in ('artificial-analysis', 'epoch-ai');
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.epoch_benchmark_runs
    where epoch_model_id is null
  ) then
    raise exception 'Epoch benchmark runs remain unlinked after the generic repair'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('aa_models', 'epoch_models', 'epoch_benchmarks', 'epoch_benchmark_runs')
      and cmd = 'SELECT'
    group by tablename
    having count(*) > 1
  ) then
    raise exception 'duplicate public read policies remain after policy consolidation'
      using errcode = '23514';
  end if;

  if (select count(*) from public.intelligence_sources) < 4 then
    raise exception 'normalized intelligence source catalog is incomplete'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from public.model_aliases as alias
    join public.intelligence_sources as source on source.id = alias.intelligence_source_id
    where source.source_key = 'artificial-analysis'
  ) <> (
    select count(distinct slug)
    from public.aa_models
    where nullif(btrim(slug), '') is not null
  ) then
    raise exception 'Artificial Analysis source-native alias coverage is incomplete'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from public.model_aliases as alias
    join public.intelligence_sources as source on source.id = alias.intelligence_source_id
    where source.source_key = 'epoch-ai'
  ) <> (select count(*) from public.epoch_models) then
    raise exception 'Epoch AI source-native alias coverage is incomplete'
      using errcode = '23514';
  end if;
end;
$$;

commit;
