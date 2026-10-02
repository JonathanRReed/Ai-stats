-- Reuse the existing service-only lease and snapshot machinery for official public daily usage.
insert into public.intelligence_sources(source_key,display_name,description,homepage_url,license_name)
values('openrouter-usage','OpenRouter daily usage','Exact daily token totals for public top-50 models and Other','https://openrouter.ai/rankings','CC BY 4.0')
on conflict(source_key) do nothing;

create or replace function public.claim_catalog_refresh(p_source_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_now timestamptz:=clock_timestamp();
 v_day date:=(clock_timestamp() at time zone 'UTC')::date;
 v_state private.catalog_refresh_state%rowtype;
 v_fetched timestamptz;
 v_requests integer;
 v_hours integer;
 v_lease uuid;
begin
 if p_source_key is null or p_source_key not in ('openrouter','huggingface','litellm','openrouter-usage') then
  raise exception 'Unknown public catalog';
 end if;
 v_hours:=case when p_source_key in ('openrouter','openrouter-usage') then 6 else 24 end;
 insert into private.catalog_refresh_state(source_key) values(p_source_key) on conflict do nothing;
 select * into v_state from private.catalog_refresh_state where source_key=p_source_key for update;
 if v_state.lease_until>v_now then return jsonb_build_object('claimed',false,'reason','active'); end if;
 if v_state.next_allowed_at>v_now then return jsonb_build_object('claimed',false,'reason','backoff'); end if;
 select fetched_at into v_fetched from public.source_snapshot_cache where source_key=p_source_key;
 if v_fetched>v_now-make_interval(hours=>v_hours) then return jsonb_build_object('claimed',false,'reason','interval'); end if;
 v_requests:=case when v_state.request_day=v_day then v_state.requests_today else 0 end;
 if v_requests>=8 then return jsonb_build_object('claimed',false,'reason','quota'); end if;
 v_lease:=pg_catalog.gen_random_uuid();
 update private.catalog_refresh_state set lease_id=v_lease,lease_until=v_now+interval '30 minutes',claimed_at=v_now,
  request_day=v_day,requests_today=v_requests+1,updated_at=v_now where source_key=p_source_key;
 return jsonb_build_object('claimed',true,'leaseId',v_lease,'attempts',v_state.failures,
  'etag',v_state.etag,'lastModified',v_state.last_modified);
end;
$$;

