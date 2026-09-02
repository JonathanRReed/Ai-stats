-- Supabase projects can assign explicit function grants through role defaults.
-- Reset each RPC to the exact role set required by the private share boundary.

revoke all on function public.create_ai_drag_race_share(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.get_ai_drag_race_share(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.purge_expired_ai_drag_race_shares()
  from public, anon, authenticated, service_role;

grant execute on function public.create_ai_drag_race_share(jsonb)
  to anon, authenticated, service_role;
grant execute on function public.get_ai_drag_race_share(uuid)
  to anon, authenticated, service_role;
grant execute on function public.purge_expired_ai_drag_race_shares()
  to service_role;
