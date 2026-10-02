-- Additive cache only: existing canonical data and shared app tables are unchanged.
create table private.source_snapshots (
  id bigint generated always as identity primary key,
  source_key text not null references public.intelligence_sources(source_key),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  observed_at timestamptz,
  fetched_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  record_count integer not null check (record_count > 0),
  status text not null default 'staged' check (status in ('staged','published')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(source_key, content_hash)
);
alter table private.source_snapshots enable row level security;
revoke all on private.source_snapshots from public, anon, authenticated;
grant select, insert, update on private.source_snapshots to service_role;
grant usage, select on sequence private.source_snapshots_id_seq to service_role;

create table public.source_snapshot_cache (
  source_key text primary key references public.intelligence_sources(source_key),
  snapshot_id bigint not null references private.source_snapshots(id),
  content_hash text not null,
  observed_at timestamptz,
  fetched_at timestamptz not null,
  published_at timestamptz not null,
  payload jsonb not null,
  record_count integer not null check (record_count > 0)
);
alter table public.source_snapshot_cache enable row level security;
revoke all on public.source_snapshot_cache from public, anon, authenticated;
grant select on public.source_snapshot_cache to anon, authenticated;
grant select, insert, update on public.source_snapshot_cache to service_role;
create policy public_source_snapshot_read on public.source_snapshot_cache
  for select to anon, authenticated using (true);
comment on table public.source_snapshot_cache is
  'Validated sanitized benchmark/catalog payloads only. No raw source fetches, user data, or credentials.';

create function public.stage_source_snapshot(
  p_source_key text, p_content_hash text, p_observed_at timestamptz,
  p_fetched_at timestamptz, p_payload jsonb, p_record_count integer
) returns bigint language plpgsql security invoker set search_path = '' as $$
declare snapshot_id bigint;
begin
  if p_source_key is null or p_content_hash is null or p_content_hash !~ '^[a-f0-9]{64}$'
    or p_fetched_at is null then raise exception 'Invalid snapshot identity or timestamp'; end if;
  if p_observed_at > p_fetched_at + interval '5 minutes' then
    raise exception 'Source observation is newer than fetch receipt'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload->>'sourceKey' is distinct from p_source_key
    or p_payload->>'schemaVersion' is distinct from '1' then
    raise exception 'Invalid source payload contract'; end if;
  if jsonb_typeof(p_payload->'records') is distinct from 'array' then
    raise exception 'Invalid source records'; end if;
  if p_record_count is null or p_record_count <= 0
    or jsonb_array_length(p_payload->'records') <> p_record_count then
    raise exception 'Snapshot is empty or record count does not match'; end if;
  if (p_payload->>'observedAt')::timestamptz is distinct from p_observed_at then
    raise exception 'Source observation timestamp mismatch'; end if;
  if exists (select 1 from jsonb_array_elements(p_payload->'records') r
    where jsonb_typeof(r) <> 'object' or jsonb_typeof(r->'id') is distinct from 'string'
      or btrim(r->>'id') = '') then raise exception 'Source record identity missing'; end if;
  if (select count(distinct r->>'id') from jsonb_array_elements(p_payload->'records') r) <> p_record_count then
    raise exception 'Source records have duplicate identities'; end if;
  if jsonb_path_exists(p_payload,
    '$.**.keyvalue() ? (@.key like_regex "^(raw|api[_-]?key|service[_-]?role[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)$" flag "i")',
    '{}'::jsonb, true) then raise exception 'Payload contains private fields'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_source_key, 0));
  insert into private.source_snapshots(source_key, content_hash, observed_at, fetched_at, payload, record_count)
  values (p_source_key, p_content_hash, p_observed_at, p_fetched_at, p_payload, p_record_count)
  on conflict (source_key, content_hash) do update
    set fetched_at = greatest(private.source_snapshots.fetched_at, excluded.fetched_at)
    where private.source_snapshots.payload = excluded.payload
      and private.source_snapshots.observed_at is not distinct from excluded.observed_at
  returning id into snapshot_id;
  if snapshot_id is null then raise exception 'Snapshot hash conflicts with stored evidence'; end if;
  return snapshot_id;
end;
$$;

create function public.promote_source_snapshot(p_snapshot_id bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare staged private.source_snapshots%rowtype; current_fetched timestamptz; current_observed timestamptz;
begin
  select * into staged from private.source_snapshots where id = p_snapshot_id;
  if not found then raise exception 'Unknown source snapshot'; end if;
  perform pg_advisory_xact_lock(hashtextextended(staged.source_key, 0));
  select fetched_at, observed_at into current_fetched, current_observed from public.source_snapshot_cache
    where source_key = staged.source_key for update;
  if current_fetched > staged.fetched_at then raise exception 'Cannot promote an older source snapshot'; end if;
  if current_observed is not null and (staged.observed_at is null or current_observed > staged.observed_at) then
    raise exception 'Cannot promote older or undated source evidence'; end if;
  insert into public.source_snapshot_cache(source_key,snapshot_id,content_hash,observed_at,fetched_at,published_at,payload,record_count)
  values (staged.source_key,staged.id,staged.content_hash,staged.observed_at,staged.fetched_at,now(),staged.payload,staged.record_count)
  on conflict(source_key) do update set
    snapshot_id = excluded.snapshot_id, content_hash = excluded.content_hash,
    observed_at = excluded.observed_at, fetched_at = excluded.fetched_at,
    published_at = case when public.source_snapshot_cache.snapshot_id = excluded.snapshot_id
      then public.source_snapshot_cache.published_at else excluded.published_at end,
    payload = excluded.payload, record_count = excluded.record_count;
  update private.source_snapshots set status = 'published', published_at = coalesce(published_at, now())
    where id = staged.id;
  return staged.id;
end;
$$;
revoke all on function public.stage_source_snapshot(text,text,timestamptz,timestamptz,jsonb,integer)
  from public, anon, authenticated;
revoke all on function public.promote_source_snapshot(bigint) from public, anon, authenticated;
grant execute on function public.stage_source_snapshot(text,text,timestamptz,timestamptz,jsonb,integer) to service_role;
grant execute on function public.promote_source_snapshot(bigint) to service_role;
