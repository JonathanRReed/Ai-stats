-- Cover the existing foreign key without changing cached rows or access policy.
-- Production baseline: five cache rows, sequential lookup about 1.97 ms; no speedup is assumed.
do $$
begin
 perform set_config('lock_timeout','5s',true);
 create index if not exists idx_source_snapshot_cache_snapshot_id
  on public.source_snapshot_cache(snapshot_id);
end;$$;
