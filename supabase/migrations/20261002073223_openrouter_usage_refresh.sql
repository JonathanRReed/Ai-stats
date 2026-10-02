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


-- Daily usage is one snapshot record containing many dated model observations.
create or replace function public.publish_catalog_refresh(
 p_source_key text,p_lease_id uuid,p_content_hash text,p_observed_at timestamptz,p_fetched_at timestamptz,
 p_payload jsonb,p_record_count integer,p_etag text,p_last_modified text
) returns bigint language plpgsql security invoker set search_path='' as $$
declare
 v_state private.catalog_refresh_state%rowtype;
 v_now timestamptz:=clock_timestamp();
 v_snapshot bigint;
begin
 select * into v_state from private.catalog_refresh_state where source_key=p_source_key for update;
 if not found or p_lease_id is null or v_state.lease_id is distinct from p_lease_id or
  v_state.lease_until is null or v_state.lease_until<=v_now then raise exception 'Catalog lease is missing, expired or replaced'; end if;
 if p_fetched_at is null or p_fetched_at>v_now+interval '5 minutes' or
  p_fetched_at<v_state.claimed_at-interval '5 minutes' then raise exception 'Invalid catalog fetch receipt'; end if;
 if length(coalesce(p_etag,''))>2048 or length(coalesce(p_last_modified,''))>2048 or
  position(chr(13) in coalesce(p_etag,''))>0 or position(chr(10) in coalesce(p_etag,''))>0 or
  position(chr(13) in coalesce(p_last_modified,''))>0 or position(chr(10) in coalesce(p_last_modified,''))>0 then
  raise exception 'Invalid catalog validator';
 end if;
 v_snapshot:=public.stage_source_snapshot(p_source_key,p_content_hash,p_observed_at,p_fetched_at,p_payload,p_record_count);
 perform public.promote_source_snapshot(v_snapshot);
 update public.source_snapshot_cache set refresh_status='healthy',refresh_message=null where source_key=p_source_key;
 update private.catalog_refresh_state set lease_id=null,lease_until=null,next_allowed_at=null,
  failures=0,etag=p_etag,last_modified=p_last_modified,last_error=null,updated_at=v_now where source_key=p_source_key;
 update public.intelligence_sources set status='healthy',status_message=null,
  coverage_label=case when p_source_key='openrouter-usage' then jsonb_array_length(p_payload#>'{records,0,snapshot,rows}')::text||' daily model observations' else p_record_count::text||' cached catalog models' end,last_observed_at=p_observed_at,
  last_successful_run_at=p_fetched_at,updated_at=v_now where source_key=p_source_key;
 return v_snapshot;
end;
$$;

