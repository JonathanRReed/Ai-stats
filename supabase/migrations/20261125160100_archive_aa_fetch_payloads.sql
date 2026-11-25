-- Old aa_fetches payloads move to the private aa-fetch-archive Storage bucket.
-- The archive-aa-fetches edge function uploads each payload, downloads it again, checks the
-- SHA-256 and only then clears data and raw, recording where the payload lives.
alter table public.aa_fetches
  add column if not exists payload_object_path text,
  add column if not exists payload_sha256 text,
  add column if not exists payload_bytes bigint,
  add column if not exists payload_archived_at timestamptz;

alter table public.aa_fetches drop constraint if exists aa_fetches_payload_archive_check;
alter table public.aa_fetches add constraint aa_fetches_payload_archive_check check (
  payload_object_path is null
  or (payload_sha256 ~ '^[0-9a-f]{64}$' and payload_bytes > 0 and payload_archived_at is not null
      and data is null and raw is null)
);

comment on column public.aa_fetches.payload_object_path is
  'Object in the aa-fetch-archive bucket holding {data, raw, data_is_sql_null, raw_is_sql_null} as gzipped JSON once the payload has been archived.';
comment on column public.aa_fetches.payload_sha256 is 'SHA-256 of the uncompressed archived JSON.';

-- Four runs a day (up to 24 rows), above the 6 fetches a day the ingest adds, with the same vault-held token the Artificial Analysis cron job uses.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
    or not exists (select 1 from pg_extension where extname = 'pg_net')
  then
    return;
  end if;
  if not exists (select 1 from cron.job where jobname = 'archive-aa-fetch-payloads') then
    perform cron.schedule(
      'archive-aa-fetch-payloads',
      '23 3,9,15,21 * * *',
      $job$
select net.http_post(
  url := 'https://bgbqdzmgxkwstjihgeef.supabase.co/functions/v1/archive-aa-fetches',
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
  body := '{"limit":6}'::jsonb,
  timeout_milliseconds := 120000
);
$job$
    );
  end if;
end;
$$;
