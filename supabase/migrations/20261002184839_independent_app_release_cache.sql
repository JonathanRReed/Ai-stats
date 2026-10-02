-- Bounded derived public app cache. Original source history and user/share tables are unchanged.
create table public.app_release_cache (
 slot smallint primary key check(slot in (0,1)),
 revision text not null unique check(revision ~ '^[a-f0-9]{64}$'),
 generated_at timestamptz not null,
 published_at timestamptz not null default now(),
 active boolean not null default false,
 manifest jsonb not null check(jsonb_typeof(manifest)='object'),
 assets jsonb not null check(jsonb_typeof(assets)='object'),
 source_receipts jsonb not null check(jsonb_typeof(source_receipts)='array')
);
create unique index app_release_one_active on public.app_release_cache((active)) where active;
alter table public.app_release_cache enable row level security;
revoke all on public.app_release_cache from public,anon,authenticated;
grant select on public.app_release_cache to anon,authenticated;
grant select,insert,update on public.app_release_cache to service_role;
create policy app_release_public_read on public.app_release_cache for select to anon,authenticated using(true);
comment on table public.app_release_cache is 'Two replaceable cache slots for validated public AI Stats artifacts. Current and previous app release only; source history is retained separately. Never raw source fetches, user data, or credentials.';

create function public.publish_app_release(p_revision text,p_manifest jsonb,p_assets jsonb,p_source_receipts jsonb)
returns text language plpgsql security invoker set search_path='' as $$
declare
 v_current public.app_release_cache%rowtype;
 v_slot smallint;
 v_generated timestamptz;
begin
 if p_revision is null or p_revision !~ '^[a-f0-9]{64}$'
 or jsonb_typeof(p_manifest) is distinct from 'object'
 or p_manifest->>'schemaVersion' is distinct from 'ai-stats-compare-release.v1'
 or jsonb_typeof(p_assets) is distinct from 'object' or p_assets='{}'::jsonb
 or jsonb_typeof(p_source_receipts) is distinct from 'array' then raise exception 'Invalid app release manifest';end if;
 if jsonb_typeof(p_manifest->'models') is distinct from 'array' or jsonb_array_length(p_manifest->'models')<2
 or jsonb_typeof(p_manifest->'defaultModelIds') is distinct from 'array' or jsonb_array_length(p_manifest->'defaultModelIds')<2
 or jsonb_typeof(p_manifest#>'{delivery,catalog,rows}') is distinct from 'array'
 or jsonb_array_length(p_manifest#>'{delivery,catalog,rows}')<2 then raise exception 'App release seed is empty';end if;
 v_generated:=(p_manifest->>'generatedAt')::timestamptz;
 if v_generated is null or v_generated>clock_timestamp()+interval '5 minutes' then raise exception 'Invalid release date';end if;
 if octet_length(p_manifest::text)+octet_length(p_assets::text)+octet_length(p_source_receipts::text)>20971520 then raise exception 'App release exceeds cache budget';end if;
 if jsonb_path_exists(jsonb_build_array(p_manifest,p_assets,p_source_receipts),
 '$.**.keyvalue() ? (@.key like_regex "^(raw|api[_-]?key|service[_-]?role[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)$" flag "i")',
 '{}'::jsonb,true) then raise exception 'App release contains private fields';end if;
 perform pg_advisory_xact_lock(hashtextextended('ai-stats-app-release',0));
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
create function public.rollback_app_release(p_revision text)
returns text language plpgsql security invoker set search_path='' as $$
declare v_slot smallint;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-stats-app-release',0));
 select slot into v_slot from public.app_release_cache where revision=p_revision for update;
 if v_slot is null then raise exception 'Previous release is not cached';end if;
 update public.app_release_cache set active=false where active;
 update public.app_release_cache set active=true where slot=v_slot;
 return p_revision;
end;
$$;
revoke all on function public.publish_app_release(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.rollback_app_release(text) from public,anon,authenticated;
grant execute on function public.publish_app_release(text,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.rollback_app_release(text) to service_role;
