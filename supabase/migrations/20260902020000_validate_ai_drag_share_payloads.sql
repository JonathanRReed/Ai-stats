-- Preserve the share RPCs, quotas and retention, but validate the complete
-- private receipt contract at both the RPC and table write boundaries.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function private.ai_drag_share_exact_keys(value jsonb, keys text[])
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'object' then
    value ?& keys and not exists (
      select 1 from jsonb_object_keys(value) as k(name) where not (name = any(keys))
    ) else false end;
$$;

create or replace function private.ai_drag_share_payload_valid(payload jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  lane jsonb;
  object_value jsonb;
  field text;
  metric jsonb;
  amount numeric;
  observed timestamptz;
  -- ECMAScript trim whitespace, matching the browser validator exactly.
  trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if not private.ai_drag_share_exact_keys(payload, array[
    'schemaVersion','createdAt','experience','mode','prompt','environment','settings','lanes'
  ]) then return false; end if;
  if payload ->> 'schemaVersion' is distinct from 'ai-drag-race-share.v1'
    or coalesce(payload ->> 'experience','') not in ('quick','lab')
    or coalesce(payload ->> 'mode','') not in ('drag','token_limit','time_limit','free_for_all')
    or jsonb_typeof(payload -> 'lanes') is distinct from 'array'
    or octet_length(payload::text) > 16384
    or jsonb_typeof(payload -> 'createdAt') is distinct from 'string'
    or (payload ->> 'createdAt') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
  then return false; end if;
  observed := (payload ->> 'createdAt')::timestamptz;
  if to_char(observed at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> payload ->> 'createdAt'
    or jsonb_array_length(payload -> 'lanes') not between 1 and 12
    or not private.ai_drag_share_exact_keys(payload -> 'prompt',array['characters'])
    or not private.ai_drag_share_exact_keys(payload -> 'environment',array['edgeRegion','userAgentFamily'])
    or not private.ai_drag_share_exact_keys(payload -> 'settings',array['temperature','maxTokens','topP','repetitions','concurrency'])
  then return false; end if;
  metric := payload #> '{prompt,characters}';
  if jsonb_typeof(metric) is distinct from 'number' then return false; end if;
  amount := metric::text::numeric;
  if amount < 0 or amount > 9007199254740991 or trunc(amount) <> amount then return false; end if;
  foreach field in array array['edgeRegion','userAgentFamily'] loop
    metric := payload -> 'environment' -> field;
    if jsonb_typeof(metric) = 'null' then continue; end if;
    if jsonb_typeof(metric) is distinct from 'string'
      or length(btrim(payload -> 'environment' ->> field,trim_chars)) = 0
      or length(payload -> 'environment' ->> field) > 100 then return false; end if;
  end loop;
  foreach field in array array['temperature','maxTokens','topP','repetitions','concurrency'] loop
    metric := payload -> 'settings' -> field;
    if jsonb_typeof(metric) is distinct from 'number' then return false; end if;
    amount := metric::text::numeric;
    if amount < 0 or amount > 9007199254740991 then return false; end if;
    if field = 'temperature' and amount > 2 then return false; end if;
    if field = 'topP' and amount > 1 then return false; end if;
    if field in ('maxTokens','repetitions','concurrency') and (amount < 1 or trunc(amount) <> amount) then return false; end if;
  end loop;
  for lane in select value from jsonb_array_elements(payload -> 'lanes') loop
    if not private.ai_drag_share_exact_keys(lane,array[
      'providerId','modelId','browser','edge','inputTokens','outputTokens','tokenSource','timingSource','status','errorCode'
    ]) then return false; end if;
    foreach field in array array['providerId','modelId'] loop
      if jsonb_typeof(lane -> field) is distinct from 'string'
        or length(btrim(lane ->> field,trim_chars)) = 0
        or length(lane ->> field) > (case when field = 'providerId' then 80 else 240 end) then return false; end if;
    end loop;
    foreach field in array array['tokenSource','timingSource'] loop
      if coalesce(lane ->> field,'') not in (
        'provider-reported','edge-measured','browser-measured','browser-synthetic','stream-events','estimated'
      ) then return false; end if;
    end loop;
    if coalesce(lane ->> 'status','') not in ('completed','failed') then return false; end if;
    if lane -> 'errorCode' <> 'null'::jsonb and coalesce(lane ->> 'errorCode','') not in (
      'aborted','timeout','rate_limited','authentication','provider_error'
    ) then return false; end if;
    foreach field in array array['inputTokens','outputTokens'] loop
      metric := lane -> field;
      if jsonb_typeof(metric) = 'null' then continue; end if;
      if jsonb_typeof(metric) is distinct from 'number' then return false; end if;
      amount := metric::text::numeric;
      if amount < 0 or amount > 9007199254740991 or trunc(amount) <> amount then return false; end if;
    end loop;
    foreach object_value in array array[lane -> 'browser',lane -> 'edge'] loop
      if not private.ai_drag_share_exact_keys(object_value,array['ttftMs','totalMs']) then return false; end if;
      foreach field in array array['ttftMs','totalMs'] loop
        metric := object_value -> field;
        if jsonb_typeof(metric) = 'null' then continue; end if;
        if jsonb_typeof(metric) is distinct from 'number' then return false; end if;
        amount := metric::text::numeric;
        if amount < 0 or amount > 9007199254740991 then return false; end if;
      end loop;
    end loop;
  end loop;
  return true;
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
  return false;
end;
$$;

revoke all on function private.ai_drag_share_exact_keys(jsonb,text[]),
  private.ai_drag_share_payload_valid(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.ai_drag_share_exact_keys(jsonb,text[]),
  private.ai_drag_share_payload_valid(jsonb) to service_role;
grant usage on schema private to service_role;

alter table public.ai_drag_race_shares
  add constraint ai_drag_race_shares_payload_contract_check
  check (private.ai_drag_share_payload_valid(payload)) not valid;
-- Legacy malformed rows must not prevent hardening new writes. Keep those
-- rows until normal retention purges them, but never return them to clients.
do $$ begin
  if not exists (select 1 from public.ai_drag_race_shares where not private.ai_drag_share_payload_valid(payload)) then
    alter table public.ai_drag_race_shares validate constraint ai_drag_race_shares_payload_contract_check;
  end if;
end $$;

create or replace function public.create_ai_drag_race_share(p_payload jsonb)
returns table (share_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare inserted public.ai_drag_race_shares%rowtype;
begin
  if not private.ai_drag_share_payload_valid(p_payload) then
    raise exception 'invalid race share payload' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('ai-drag-race-share-create'));
  if (select count(*) >= 20 from public.ai_drag_race_shares where created_at >= date_trunc('hour',now()))
    or (select count(*) >= 200 from public.ai_drag_race_shares where created_at >= date_trunc('day',now())) then
    raise exception 'race share capacity temporarily reached' using errcode = '54000';
  end if;
  insert into public.ai_drag_race_shares(payload) values(p_payload) returning * into inserted;
  return query select inserted.id,inserted.expires_at;
end;
$$;
revoke all on function public.create_ai_drag_race_share(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.create_ai_drag_race_share(jsonb) to anon, authenticated, service_role;

create or replace function public.get_ai_drag_race_share(p_share_id uuid)
returns table (payload jsonb, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select share.payload, share.expires_at
  from public.ai_drag_race_shares as share
  where share.id = p_share_id and share.expires_at > now()
    and private.ai_drag_share_payload_valid(share.payload)
  limit 1;
$$;
revoke all on function public.get_ai_drag_race_share(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_ai_drag_race_share(uuid) to anon, authenticated, service_role;
commit;
