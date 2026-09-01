begin;

insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name,
  created_by
)
values
  (
    '20260901000100',
    '{}'::text[],
    'model_intelligence_foundation',
    'dashboard-baseline-20260901'
  ),
  (
    '20260901000200',
    '{}'::text[],
    'backfill_legacy_intelligence',
    'dashboard-baseline-20260901'
  ),
  (
    '20260901000300',
    '{}'::text[],
    'register_intelligence_migrations',
    'dashboard-baseline-20260901'
  )
on conflict (version) do update set
  name = excluded.name,
  created_by = excluded.created_by;

commit;
