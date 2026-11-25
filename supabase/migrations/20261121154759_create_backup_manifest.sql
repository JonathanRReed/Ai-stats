create table if not exists private.backup_manifest (
  run_id text not null,
  schema_name text not null,
  table_name text not null,
  chunk integer not null,
  after_key text,
  last_key text,
  row_count integer not null,
  raw_bytes bigint not null,
  gz_bytes bigint not null,
  sha256_raw text not null,
  object_path text not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  verify_ok boolean,
  verify_note text,
  primary key (run_id, schema_name, table_name, chunk)
);
revoke all on private.backup_manifest from anon, authenticated;
comment on table private.backup_manifest is 'One row per exported backup chunk in Storage bucket ai-dex-backup, with row count and sha256 of the uncompressed NDJSON.';