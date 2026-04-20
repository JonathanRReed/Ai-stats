-- Repair stale AA duplicate rows and backfill Epoch benchmark-run model links.
-- This requires a writable Supabase SQL session. The current MCP session is read-only.

begin;

with stale_aa_duplicates as (
  select id
  from (
    select
      id,
      row_number() over (
        partition by slug
        order by last_seen desc nulls last, first_seen desc nulls last, id
      ) as duplicate_rank
    from public.aa_models
    where slug in (
      select slug
      from public.aa_models
      where slug is not null
      group by slug
      having count(*) > 1
    )
  ) ranked
  where duplicate_rank > 1
)
delete from public.aa_models m
using stale_aa_duplicates stale
where m.id = stale.id;

insert into public.epoch_models (
  model_version,
  model_name,
  display_name,
  organization,
  country,
  model_accessibility,
  release_date,
  description
)
values
  (
    'DeepSeek-R1-0528',
    'DeepSeek-R1',
    'DeepSeek-R1-0528',
    'DeepSeek',
    'China',
    null,
    date '2025-05-28',
    'Backfilled from Epoch benchmark runs to restore model linkage.'
  ),
  (
    'gpt-4-0314',
    'GPT-4',
    'GPT-4 (0314)',
    'OpenAI',
    'USA',
    null,
    date '2023-03-14',
    'Backfilled from Epoch benchmark runs to restore model linkage.'
  ),
  (
    'gpt-5-nano-2025-08-07_high',
    'GPT-5 nano',
    'GPT-5 nano (high)',
    'OpenAI',
    'USA',
    null,
    date '2025-08-07',
    'Backfilled from Epoch benchmark runs to restore model linkage.'
  ),
  (
    'o4-mini-2025-04-16_high',
    'o4-mini',
    'o4-mini (high)',
    'OpenAI',
    'USA',
    null,
    date '2025-04-16',
    'Backfilled from Epoch benchmark runs to restore model linkage.'
  )
on conflict (model_version) do update set
  model_name = coalesce(public.epoch_models.model_name, excluded.model_name),
  display_name = coalesce(nullif(public.epoch_models.display_name, ''), excluded.display_name),
  organization = coalesce(public.epoch_models.organization, excluded.organization),
  country = coalesce(public.epoch_models.country, excluded.country),
  release_date = coalesce(public.epoch_models.release_date, excluded.release_date),
  description = coalesce(public.epoch_models.description, excluded.description);

update public.epoch_benchmark_runs r
set epoch_model_id = m.id
from public.epoch_models m
where r.epoch_model_id is null
  and r.model_version = m.model_version;

commit;
