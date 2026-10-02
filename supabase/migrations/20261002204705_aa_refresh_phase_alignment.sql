-- Four-hour cadence aligned with the 01:37/13:37 UTC source publication jobs.
-- This reduces the age of the AA snapshot at publication while preserving six runs per day.
do $$
declare v_job bigint;
begin
 if to_regprocedure('public.claim_aa_refresh()') is null then raise exception 'AA quota guard is not installed';end if;
 select jobid into strict v_job from cron.job where jobname='ingest_artificialanalysis_every_12h' and active;
 perform cron.alter_job(v_job,schedule:='0 1,5,9,13,17,21 * * *');
end;$$;
