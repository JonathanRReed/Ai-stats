-- Run with psql -v ON_ERROR_STOP=1 after applying share migrations.
-- All diagnostic rows and helper objects are rolled back.
begin;
create temporary table share_fixture as select '{
  "schemaVersion":"ai-drag-race-share.v1","createdAt":"2026-09-02T00:00:00.000Z",
  "experience":"quick","mode":"drag","prompt":{"characters":0},
  "environment":{"edgeRegion":null,"userAgentFamily":null},
  "settings":{"temperature":0.7,"maxTokens":2048,"topP":1,"repetitions":1,"concurrency":1},
  "lanes":[{"providerId":"verification","modelId":"Verification only, not a benchmark",
    "browser":{"ttftMs":null,"totalMs":null},"edge":{"ttftMs":null,"totalMs":null},
    "inputTokens":null,"outputTokens":null,"tokenSource":"estimated","timingSource":"browser-measured",
    "status":"failed","errorCode":"aborted"}]
}'::jsonb as payload;

do $$
declare p jsonb; bad jsonb; key text; nested text; clock text; metric text; n integer;
begin
  select payload into p from share_fixture;
  if not private.ai_drag_share_payload_valid(p) then raise exception 'valid control rejected'; end if;
  for key in select jsonb_object_keys(p) loop
    if private.ai_drag_share_payload_valid(p - key) then raise exception 'missing root field accepted: %',key; end if;
  end loop;
  foreach nested in array array['prompt','environment','settings'] loop
    for key in select jsonb_object_keys(p -> nested) loop
      if private.ai_drag_share_payload_valid(jsonb_set(p,array[nested],(p -> nested) - key)) then
        raise exception 'missing nested field accepted: %.%',nested,key;
      end if;
    end loop;
    if private.ai_drag_share_payload_valid(jsonb_set(p,array[nested],(p -> nested) || '{"secret":"private"}')) then
      raise exception 'nested extra accepted: %',nested;
    end if;
  end loop;
  for key in select jsonb_object_keys(p #> '{lanes,0}') loop
    if private.ai_drag_share_payload_valid(jsonb_set(p,'{lanes,0}',(p #> '{lanes,0}') - key)) then
      raise exception 'missing lane field accepted: %',key;
    end if;
  end loop;
  foreach clock in array array['browser','edge'] loop
    foreach metric in array array['ttftMs','totalMs'] loop
      if private.ai_drag_share_payload_valid(jsonb_set(p,array['lanes','0',clock],(p #> array['lanes','0',clock]) - metric)) then
        raise exception 'missing clock metric accepted';
      end if;
    end loop;
    if private.ai_drag_share_payload_valid(jsonb_set(p,array['lanes','0',clock],(p #> array['lanes','0',clock]) || '{"apiKey":"private"}')) then
      raise exception 'clock extra accepted';
    end if;
  end loop;
  foreach bad in array array[
    null::jsonb,'{}'::jsonb,'[]'::jsonb,'null'::jsonb,
    jsonb_set(p,'{lanes}','[]'), jsonb_set(p,'{experience}','null'),
    jsonb_set(p,'{createdAt}','"2026-02-31T00:00:00.000Z"'),
    jsonb_set(p,'{lanes,0,tokenSource}','"demo"'),
    jsonb_set(p,'{lanes,0,providerId}',to_jsonb(E'\t'::text)),
    jsonb_set(p,'{lanes,0,modelId}',to_jsonb(E'\n'::text)),
    jsonb_set(p,'{environment,edgeRegion}',to_jsonb(E'\r'::text)),
    jsonb_set(p,'{environment,userAgentFamily}',to_jsonb(U&'\FEFF\00A0'::text)),
    jsonb_set(p,'{lanes,0,outputTokens}','-1'),
    jsonb_set(p,'{lanes,0,inputTokens}','0.5'),
    jsonb_set(p,'{lanes,0,browser,ttftMs}','"100"'),
    jsonb_set(p,'{settings,temperature}','3'), jsonb_set(p,'{settings,topP}','2'),
    jsonb_set(p,'{settings,repetitions}','0'), jsonb_set(p,'{settings,concurrency}','0'),
    jsonb_set(p,'{prompt,characters}','9007199254740992')
  ] loop
    if private.ai_drag_share_payload_valid(bad) then raise exception 'malformed control accepted'; end if;
    begin
      perform * from public.create_ai_drag_race_share(bad);
      raise exception 'invalid payload reached insert';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  if has_table_privilege('anon','public.ai_drag_race_shares','SELECT,INSERT,UPDATE,DELETE')
    or has_function_privilege('anon','public.purge_expired_ai_drag_race_shares()','EXECUTE') then
    raise exception 'anonymous privileged access';
  end if;
  select count(*) into n from public.ai_drag_race_shares;
  if n <> 0 then raise exception 'test requires an empty disposable share table'; end if;
end;
$$;

grant select on share_fixture to anon, service_role;
savepoint service_write;
set local role service_role;
insert into public.ai_drag_race_shares(payload) select payload from share_fixture;
reset role;
rollback to service_write;
set local role anon;
create temporary table created_share as select * from public.create_ai_drag_race_share((select payload from share_fixture));
do $$
declare id uuid; expiry timestamptz;
begin
  select share_id,expires_at into id,expiry from created_share;
  if expiry <> now() + interval '30 days' then raise exception 'wrong retention'; end if;
  if (select count(*) from public.get_ai_drag_race_share(id)) <> 1 then raise exception 'valid share unreadable'; end if;
end;
$$;
reset role;
update public.ai_drag_race_shares set created_at=now()-interval '31 days',expires_at=now()-interval '1 day';
set local role anon;
do $$
begin
  if (select count(*) from public.get_ai_drag_race_share((select share_id from created_share))) <> 0 then
    raise exception 'expired share still readable';
  end if;
end;
$$;
reset role;
do $$
begin
  if public.purge_expired_ai_drag_race_shares() <> 1 then raise exception 'purge did not remove expired share'; end if;
end;
$$;
rollback;
