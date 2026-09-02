-- Only for a fresh disposable PostgreSQL database, never production.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema private;
-- The base migration inspects cron.job even when pg_cron is not installed.
-- This empty test catalog lets the migration skip its optional scheduling branch.
-- Actual production job execution is verified separately in Supabase.
create schema cron;
create table cron.job(jobname text);
