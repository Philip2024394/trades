-- Xrated Trades — nightly paid-expiry sweep.
--
-- The marketing copy promises that a paid listing silently downgrades to
-- the free directory tier once the paid subscription window lapses. This
-- migration installs the pg_cron job that delivers on that promise.
--
-- The inline helper `maybeExpireListingTier()` (src/lib/xratedTier.ts)
-- keeps a single dashboard render correct between sweeps; this cron is
-- the bulk safety net so listings that never get hit by a render path
-- still flip on time.
--
-- Schedule: every day at 03:00 (cron is interpreted in the database TZ;
-- Supabase defaults to UTC, which is the closest fixed offset to
-- Europe/London — DST drift of ±1h on a 24h sweep is acceptable).
--
-- Idempotent — re-running the migration unschedules the previous job
-- first, so reapplying is safe.

create extension if not exists pg_cron with schema extensions;

do $$
declare existing_jobid bigint;
begin
  select jobid into existing_jobid from cron.job
    where jobname = 'xrated-paid-expiry-daily';
  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;
end $$;

select cron.schedule(
  'xrated-paid-expiry-daily',
  '0 3 * * *',
  $$ UPDATE hammerex_trade_off_listings SET tier = 'app_expired' WHERE tier = 'app_paid' AND paid_expires_at IS NOT NULL AND paid_expires_at < now(); $$
);
