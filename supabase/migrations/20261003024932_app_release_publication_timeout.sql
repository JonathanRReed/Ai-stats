-- Bound the service-only bulk publication independently of the default 8s REST timeout.
-- This changes neither execution grants nor the 20 MiB payload cap.
alter function public.publish_app_release(text,jsonb,jsonb,jsonb) set statement_timeout to '30s';
notify pgrst, 'reload schema';
