begin;

do $$
declare
  target_job_id bigint;
  target_command text;
  legacy_token text;
  existing_secret_id uuid;
  replacement_command text;
  queued_requests bigint;
  extension_schema text;
begin
  select jobid, command
  into target_job_id, target_command
  from cron.job
  where command like '%/functions/v1/ingest-artificialanalysis%'
  order by jobid
  limit 1;

  if target_job_id is null or target_command is null then
    raise exception 'cron credential migration failed';
  end if;

  legacy_token := substring(target_command from 'Bearer ([A-Za-z0-9._-]+)');
  if legacy_token is null or legacy_token = '' then
    raise exception 'cron credential migration failed';
  end if;

  select id
  into existing_secret_id
  from vault.decrypted_secrets
  where name = 'ai-stats-ingest-service-role'
  order by created_at desc
  limit 1;

  if existing_secret_id is null then
    perform vault.create_secret(
      legacy_token,
      'ai-stats-ingest-service-role',
      'Privileged token used only by the Artificial Analysis ingestion cron job.'
    );
  else
    perform vault.update_secret(
      existing_secret_id,
      legacy_token,
      'ai-stats-ingest-service-role',
      'Privileged token used only by the Artificial Analysis ingestion cron job.'
    );
  end if;

  replacement_command := $job$
select net.http_post(
  url := 'https://bgbqdzmgxkwstjihgeef.supabase.co/functions/v1/ingest-artificialanalysis',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'ai-stats-ingest-service-role'
      order by created_at desc
      limit 1
    )
  ),
  body := '{"source":"cron"}'::jsonb,
  timeout_milliseconds := 20000
);
$job$;

  perform cron.alter_job(target_job_id, command := replacement_command);

  if exists (
    select 1
    from cron.job
    where jobid = target_job_id
      and command like '%' || legacy_token || '%'
  ) then
    raise exception 'cron credential migration failed';
  end if;

  select n.nspname
  into extension_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_net';

  if extension_schema = 'public' then
    select count(*) into queued_requests from net.http_request_queue;
    if queued_requests <> 0 then
      raise exception 'pg_net request queue must be empty before relocation';
    end if;
    execute 'drop extension pg_net';
    execute 'create extension pg_net with schema extensions';
  end if;

  select n.nspname
  into extension_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'http';

  if extension_schema = 'public' then
    execute 'drop extension http';
    execute 'create extension http with schema extensions';
  end if;

  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname in ('http', 'pg_net')
      and n.nspname = 'public'
  ) then
    raise exception 'extension relocation failed';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'extensions'
      and p.proname = 'http_get'
  ) then
    raise exception 'http extension verification failed';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'net'
      and p.proname = 'http_post'
  ) then
    raise exception 'pg_net extension verification failed';
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements)
values (
  '20260901170000',
  'harden_cron_secrets_and_extensions',
  array['see repository migration 20260901170000_harden_cron_secrets_and_extensions.sql']::text[]
)
on conflict (version) do update
set name = excluded.name,
    statements = excluded.statements;

commit;
