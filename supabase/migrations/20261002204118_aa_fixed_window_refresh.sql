-- No API keys or raw source payloads are stored here.
create table private.aa_refresh_state (
 id boolean primary key default true check(id),
 lease_id uuid,lease_until timestamptz,claimed_at timestamptz,last_success_at timestamptz,
 window_reset_at timestamptz,reset_verified boolean not null default false,requests_used integer not null default 0 check(requests_used>=0),
 upstream_limit integer,remaining integer check(remaining>=0),next_allowed_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table private.aa_refresh_state enable row level security;
revoke all on private.aa_refresh_state from public,anon,authenticated,service_role;
grant select,insert,update on private.aa_refresh_state to service_role;
insert into private.aa_refresh_state(id) values(true);
create function public.claim_aa_refresh() returns jsonb language plpgsql security invoker set search_path='' as $$
declare s private.aa_refresh_state%rowtype;t timestamptz;token uuid;
begin
 select * into s from private.aa_refresh_state where id for update;
 t:=clock_timestamp();
 if s.lease_until>t then return jsonb_build_object('claimed',false,'reason','active');end if;
 if s.next_allowed_at>t then return jsonb_build_object('claimed',false,'reason','backoff');end if;
 -- Five minutes of scheduler jitter must not turn a four-hour cron into eight hours.
 if s.last_success_at>t-interval '3 hours 55 minutes' then return jsonb_build_object('claimed',false,'reason','interval');end if;
 if s.window_reset_at>t and (s.requests_used>=90 or s.remaining<=10) then return jsonb_build_object('claimed',false,'reason','quota');end if;
 token:=pg_catalog.gen_random_uuid();
 update private.aa_refresh_state set lease_id=token,lease_until=t+interval '10 minutes',claimed_at=t,updated_at=t where id;
 return jsonb_build_object('claimed',true,'leaseId',token);
end;$$;
create function public.reserve_aa_request(p_lease uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare s private.aa_refresh_state%rowtype;t timestamptz;
begin
 select * into s from private.aa_refresh_state where id for update;
 t:=clock_timestamp();
 if s.lease_id is distinct from p_lease or s.lease_until is null or s.lease_until<=t then return false;end if;
 if s.next_allowed_at>t then return false;end if;
 if s.window_reset_at is null or s.window_reset_at<=t then
  s.window_reset_at:=t+interval '24 hours';s.reset_verified:=false;s.requests_used:=0;s.remaining:=null;
 end if;
 if s.requests_used>=90 or s.remaining<=10 then return false;end if;
 update private.aa_refresh_state set window_reset_at=s.window_reset_at,reset_verified=s.reset_verified,requests_used=s.requests_used+1,
 remaining=case when s.remaining is null then null else greatest(0,s.remaining-1) end,updated_at=t where id;
 return true;
end;$$;
create function public.record_aa_response(p_lease uuid,p_limit integer,p_remaining integer,p_reset timestamptz,p_not_before timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare s private.aa_refresh_state%rowtype;t timestamptz;v_reset timestamptz;v_remaining integer;v_new_window boolean;
begin
 select * into s from private.aa_refresh_state where id for update;
 t:=clock_timestamp();
 if s.lease_id is distinct from p_lease or s.lease_until is null or s.lease_until<=t then return false;end if;
 if p_limit is not null and p_limit<1 or p_remaining is not null and p_remaining<0 then raise exception 'Invalid quota headers';end if;
 v_reset:=case when p_reset>t then p_reset else s.window_reset_at end;
 v_new_window:=s.reset_verified and p_reset>t and p_reset>s.window_reset_at;
 v_remaining:=case when v_new_window then p_remaining when p_remaining is null then s.remaining when s.remaining is null then p_remaining else least(s.remaining,p_remaining) end;
 update private.aa_refresh_state set upstream_limit=coalesce(p_limit,upstream_limit),remaining=v_remaining,window_reset_at=v_reset,
 reset_verified=case when p_reset>t then true else s.reset_verified end,
 requests_used=case when v_new_window then 1 else s.requests_used end,
 next_allowed_at=greatest(next_allowed_at,p_not_before,case when v_remaining<=10 then v_reset else null end),updated_at=t where id;
 return true;
end;$$;
create function public.finish_aa_refresh(p_lease uuid,p_success boolean) returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 update private.aa_refresh_state set lease_id=null,lease_until=null,
 last_success_at=case when p_success then clock_timestamp() else last_success_at end,
 next_allowed_at=case when p_success then next_allowed_at else greatest(next_allowed_at,clock_timestamp()+interval '5 minutes') end,
 updated_at=clock_timestamp() where id and lease_id=p_lease;
 get diagnostics changed=row_count;return changed=1;
end;$$;
revoke all on function public.claim_aa_refresh() from public,anon,authenticated;
revoke all on function public.reserve_aa_request(uuid) from public,anon,authenticated;
revoke all on function public.record_aa_response(uuid,integer,integer,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.finish_aa_refresh(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_aa_refresh(),public.reserve_aa_request(uuid),
 public.record_aa_response(uuid,integer,integer,timestamptz,timestamptz),public.finish_aa_refresh(uuid,boolean) to service_role;
