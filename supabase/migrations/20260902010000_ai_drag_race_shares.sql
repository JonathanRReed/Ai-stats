-- Private-by-default, unlisted AI Drag Racing result shares.
-- The public table is not directly readable or writable. Anonymous callers use
-- bounded security-definer functions, and every row expires within 30 days.

create table if not exists public.ai_drag_race_shares (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint ai_drag_race_shares_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  constraint ai_drag_race_shares_payload_size_check
    check (octet_length(payload::text) <= 16384),
  constraint ai_drag_race_shares_retention_check
    check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);

create index if not exists idx_ai_drag_race_shares_expires_at
  on public.ai_drag_race_shares(expires_at);

create index if not exists idx_ai_drag_race_shares_created_at
  on public.ai_drag_race_shares(created_at);

alter table public.ai_drag_race_shares enable row level security;

revoke all on table public.ai_drag_race_shares from public, anon, authenticated;
grant select, insert, delete on table public.ai_drag_race_shares to service_role;

create or replace function public.create_ai_drag_race_share(p_payload jsonb)
returns table (share_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted public.ai_drag_race_shares%rowtype;
  lane jsonb;
begin
  if jsonb_typeof(p_payload) <> 'object'
    or p_payload ->> 'schemaVersion' <> 'ai-drag-race-share.v1'
    or jsonb_typeof(p_payload -> 'lanes') <> 'array'
    or jsonb_array_length(p_payload -> 'lanes') < 1
    or jsonb_array_length(p_payload -> 'lanes') > 12
    or octet_length(p_payload::text) > 16384
    or p_payload ?| array['promptText', 'responseText', 'apiKey', 'ipAddress', 'preciseLocation']
    or p_payload::text ~* '"(promptText|responseText|apiKey|ipAddress|preciseLocation|fingerprint)"[[:space:]]*:'
    or exists (
      select 1
      from jsonb_object_keys(p_payload) as key(value)
      where key.value <> all (array['schemaVersion', 'createdAt', 'experience', 'mode', 'prompt', 'environment', 'settings', 'lanes']::text[])
    )
    or jsonb_typeof(p_payload -> 'prompt') <> 'object'
    or jsonb_typeof(p_payload -> 'environment') <> 'object'
    or jsonb_typeof(p_payload -> 'settings') <> 'object'
  then
    raise exception 'invalid race share payload' using errcode = '22023';
  end if;

  for lane in select value from jsonb_array_elements(p_payload -> 'lanes')
  loop
    if jsonb_typeof(lane) <> 'object'
      or exists (
        select 1
        from jsonb_object_keys(lane) as key(value)
        where key.value <> all (array[
          'providerId', 'modelId', 'browser', 'edge', 'inputTokens', 'outputTokens',
          'tokenSource', 'timingSource', 'status', 'errorCode'
        ]::text[])
      )
      or length(coalesce(lane ->> 'providerId', '')) > 80
      or length(coalesce(lane ->> 'modelId', '')) > 240
    then
      raise exception 'invalid race share lane' using errcode = '22023';
    end if;
  end loop;

  -- Shares are anonymous by design. A small global write budget prevents an
  -- untrusted client from consuming the free database through bulk creation.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('ai-drag-race-share-create'));
  if (
    select count(*) >= 20
    from public.ai_drag_race_shares
    where created_at >= pg_catalog.date_trunc('hour', pg_catalog.now())
  ) or (
    select count(*) >= 200
    from public.ai_drag_race_shares
    where created_at >= pg_catalog.date_trunc('day', pg_catalog.now())
  ) then
    raise exception 'race share capacity temporarily reached' using errcode = '54000';
  end if;

  insert into public.ai_drag_race_shares(payload)
  values (p_payload)
  returning * into inserted;

  return query select inserted.id, inserted.expires_at;
end;
$$;

create or replace function public.get_ai_drag_race_share(p_share_id uuid)
returns table (payload jsonb, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select share.payload, share.expires_at
  from public.ai_drag_race_shares as share
  where share.id = p_share_id
    and share.expires_at > now()
  limit 1;
$$;

create or replace function public.purge_expired_ai_drag_race_shares()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.ai_drag_race_shares where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.create_ai_drag_race_share(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.get_ai_drag_race_share(uuid) from public, anon, authenticated, service_role;
revoke all on function public.purge_expired_ai_drag_race_shares() from public, anon, authenticated, service_role;
grant execute on function public.create_ai_drag_race_share(jsonb) to anon, authenticated, service_role;
grant execute on function public.get_ai_drag_race_share(uuid) to anon, authenticated, service_role;
grant execute on function public.purge_expired_ai_drag_race_shares() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
    and not exists (select 1 from cron.job where jobname = 'purge-expired-ai-drag-race-shares')
  then
    perform cron.schedule(
      'purge-expired-ai-drag-race-shares',
      '17 4 * * *',
      'select public.purge_expired_ai_drag_race_shares();'
    );
  end if;
end;
$$;
