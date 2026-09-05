-- Add provenance without changing historical scores or widening table access.
alter table public.aa_models add column if not exists source_metadata jsonb;
comment on column public.aa_models.source_metadata is
  'AA response version and measurement conditions. Null means provenance is unknown, not current.';

-- Only attach a receipt when its exact model payload matches the current row.
with latest as (
  select distinct on (item->>'id') item, fetched_at, endpoint, prompt_options
  from public.aa_fetches
  cross join lateral jsonb_array_elements(data) item
  where status = 200
  order by item->>'id', fetched_at desc
)
update public.aa_models m
set source_metadata = jsonb_build_object(
  'endpoint', f.endpoint,
  'intelligence_index_version', f.prompt_options->'intelligence_index_version',
  'performance_prompt', case when f.endpoint = 'language/models/free' then 'long' else coalesce(f.prompt_options->>'prompt_type', f.prompt_options->>'prompt_length') end,
  'tier', f.prompt_options->'tier',
  'observed_at', f.fetched_at,
  'release_date', f.item->'release_date',
  'index_cost', f.item->'artificial_analysis_intelligence_index_cost'
)
from latest f
where m.id::text = f.item->>'id'
  and m.evaluations is not distinct from f.item->'evaluations'
  and m.source_metadata is null;
