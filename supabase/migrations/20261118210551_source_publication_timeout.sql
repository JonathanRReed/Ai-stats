-- Bound the service-only source publications independently of the default 8s REST timeout.
-- Payload validation that takes about half a second on an idle instance has exceeded 8s
-- when it runs straight after the Epoch publication in the same refresh job.
-- This changes neither execution grants nor payload validation.
alter function public.publish_catalog_refresh(text,uuid,text,timestamptz,timestamptz,jsonb,integer,text,text) set statement_timeout to '30s';
alter function public.stage_source_snapshot(text,text,timestamptz,timestamptz,jsonb,integer) set statement_timeout to '30s';
notify pgrst, 'reload schema';
