-- Xrated Trades — auto-publish pending reviews when the 24h cool-down
-- expires. Runs every 15 minutes via pg_cron (Supabase Pro pre-installs
-- the extension under the `extensions` schema). The job is idempotent —
-- it only touches rows still in `pending` status.
--
-- Run `select cron.unschedule('publish-pending-xrated-reviews');` to
-- pause if you ever need to. The job-name pattern (kebab) matches the
-- existing Hammerex cron naming.

create extension if not exists pg_cron with schema extensions;

-- Cleanly re-schedule (drops any previous version so the migration is
-- safely re-runnable).
do $$
declare existing_jobid bigint;
begin
  select jobid into existing_jobid from cron.job
    where jobname = 'publish-pending-xrated-reviews';
  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;
end $$;

select cron.schedule(
  'publish-pending-xrated-reviews',
  '*/15 * * * *',
  $$
    update public.hammerex_xrated_reviews
    set status = 'live', updated_at = now()
    where status = 'pending' and goes_live_at <= now();
  $$
);
