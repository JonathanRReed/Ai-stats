-- Apply only after the quota-guarded Edge Function is deployed with JWT verification enabled.
-- Keep the existing job identity, command and credentials unchanged.
do $$
declare v_job bigint;
begin
 if to_regprocedure('public.claim_aa_refresh()') is null then raise exception 'AA quota guard is not installed';end if;
 select jobid into strict v_job from cron.job where jobname='ingest_artificialanalysis_every_12h' and active;
 perform cron.alter_job(v_job,schedule:='0 */4 * * *');
end;$$;
