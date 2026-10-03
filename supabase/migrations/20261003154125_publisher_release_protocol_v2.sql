create or replace function public.publish_app_release(p_revision text,p_manifest jsonb,p_assets jsonb,p_source_receipts jsonb)
returns text language plpgsql security invoker set search_path='' set statement_timeout='30s' as $
declare
 v_current public.app_release_cache%rowtype;
 v_existing public.app_release_cache%rowtype;
 v_slot smallint;
 v_generated timestamptz;
begin
 if p_revision is null or p_revision !~ '^[a-f0-9]{64}$'
 or jsonb_typeof(p_manifest) is distinct from 'object'
 or coalesce(p_manifest->>'schemaVersion','') not in ('ai-stats-compare-release.v1','ai-stats-compare-release.v2')
 or jsonb_typeof(p_assets) is distinct from 'object' or p_assets='{}'::jsonb
 or jsonb_typeof(p_source_receipts) is distinct from 'array' then raise exception 'Invalid app release manifest';end if;
 if jsonb_typeof(p_manifest->'models') is distinct from 'array' or jsonb_array_length(p_manifest->'models')<2
 or jsonb_typeof(p_manifest->'defaultModelIds') is distinct from 'array' or jsonb_array_length(p_manifest->'defaultModelIds')<2
 or jsonb_typeof(p_manifest#>'{delivery,catalog,rows}') is distinct from 'array'
 or jsonb_array_length(p_manifest#>'{delivery,catalog,rows}')<2 then raise exception 'App release seed is empty';end if;
 if exists(select 1 from jsonb_array_elements(p_manifest->'models') item where jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') is distinct from 'string' or btrim(item->>'id')='')
 or (select count(distinct item->>'id') from jsonb_array_elements(p_manifest->'models') item)<>jsonb_array_length(p_manifest->'models')
 then raise exception 'Invalid release seed identity';end if;
 if exists(select 1 from jsonb_array_elements(p_manifest->'defaultModelIds') id where jsonb_typeof(id) is distinct from 'string'
 or not exists(select 1 from jsonb_array_elements(p_manifest->'models') item where item->'id'=id))
 or (select count(distinct id) from jsonb_array_elements(p_manifest->'defaultModelIds') id)<>jsonb_array_length(p_manifest->'defaultModelIds')
 then raise exception 'Invalid default model identity';end if;
 if exists(select 1 from jsonb_array_elements(p_manifest#>'{delivery,catalog,rows}') item where jsonb_typeof(item) is distinct from 'array' or jsonb_typeof(item->0) is distinct from 'string')
 or exists(select 1 from jsonb_each(p_assets) item where jsonb_typeof(item.value) is distinct from 'object')
 then raise exception 'Invalid catalog or asset shape';end if;
 v_generated:=(p_manifest->>'generatedAt')::timestamptz;
 if v_generated is null or v_generated>clock_timestamp()+interval '5 minutes' then raise exception 'Invalid release date';end if;
 if octet_length(p_manifest::text)+octet_length(p_assets::text)+octet_length(p_source_receipts::text)>20971520 then raise exception 'App release exceeds cache budget';end if;
 if jsonb_path_exists(jsonb_build_array(p_manifest,p_assets,p_source_receipts),
 '$.**.keyvalue() ? (@.key like_regex "^(raw(?:[_-]?(?:response|body|fetch))?|api[_-]?key|service[_-]?role[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|password|secret)$" flag "i")',
 '{}'::jsonb,true) then raise exception 'App release contains private fields';end if;
 perform pg_advisory_xact_lock(hashtextextended('ai-stats-app-release',0));
 select * into v_existing from public.app_release_cache where revision=p_revision for update;
 if v_existing.revision is not null and (v_existing.manifest<>p_manifest or v_existing.assets<>p_assets or v_existing.source_receipts<>p_source_receipts) then raise exception 'Release revision conflicts with cached payload';end if;
 select * into v_current from public.app_release_cache where active for update;
 if v_current.revision=p_revision then
  if v_current.manifest<>p_manifest or v_current.assets<>p_assets or v_current.source_receipts<>p_source_receipts then raise exception 'Release revision conflicts with cached payload';end if;
  return p_revision;
 end if;
 if v_current.generated_at>v_generated then raise exception 'Cannot publish an older app release';end if;
 v_slot:=case when v_current.slot=0 then 1 else 0 end;
 update public.app_release_cache set active=false where active;
 insert into public.app_release_cache(slot,revision,generated_at,published_at,active,manifest,assets,source_receipts)
 values(v_slot,p_revision,v_generated,clock_timestamp(),true,p_manifest,p_assets,p_source_receipts)
 on conflict(slot) do update set revision=excluded.revision,generated_at=excluded.generated_at,
 published_at=excluded.published_at,active=true,manifest=excluded.manifest,assets=excluded.assets,source_receipts=excluded.source_receipts;
 return p_revision;
end;
$$;

revoke all on function public.publish_app_release(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_app_release(text,jsonb,jsonb,jsonb) to service_role;
