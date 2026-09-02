-- Disposable database only. Prove historical malformed shares do not block
-- the upgrade, are preserved for retention, and are no longer publicly read.
do $$ begin
  if exists (select 1 from public.ai_drag_race_shares) then
    raise exception 'migration-path test requires an empty disposable table';
  end if;
end $$;
insert into public.ai_drag_race_shares(id,payload)
values ('00000000-0000-4000-8000-000000000001','{}');
\ir ../migrations/20260902020000_validate_ai_drag_share_payloads.sql
do $$ begin
  if (select count(*) from public.ai_drag_race_shares) <> 1 then
    raise exception 'migration lost historical rows';
  end if;
  if exists (select 1 from public.get_ai_drag_race_share('00000000-0000-4000-8000-000000000001')) then
    raise exception 'malformed historical share exposed';
  end if;
end $$;
delete from public.ai_drag_race_shares where id='00000000-0000-4000-8000-000000000001';
alter table public.ai_drag_race_shares validate constraint ai_drag_race_shares_payload_contract_check;
