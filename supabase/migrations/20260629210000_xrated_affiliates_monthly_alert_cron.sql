-- Xrated Trades — end-of-month payment-details alert.
--
-- pg_cron can't easily call HTTP endpoints, so this cron only flips
-- `payment_alert_flag = true` on any affiliate row whose approved
-- commission total has crossed £50 but who hasn't filled in their
-- payment details yet. The dashboard banner already shows the prompt
-- when (a) the flag is set OR (b) the live approved balance crosses
-- £50, so we don't strictly need the flag — but stamping it lets the
-- scripts/send-monthly-payment-alerts.mjs runner pick up only the
-- rows that need a fresh email (idempotent).
--
-- Also flips a commission's status from 'pending' → 'approved' after
-- the 14-day cooling-off window has passed. This is the auto-promote
-- the spec asks for (admin can still manually approve sooner).
--
-- Schedule: 28th of each month at 09:00 UTC for the payment alerts.
-- Daily at 03:30 UTC for the 14-day pending→approved sweep.
--
-- Idempotent — unschedules previous jobs by name first.
create extension if not exists pg_cron with schema extensions;

do $$
declare existing_jobid bigint;
begin
  -- Monthly payment-details alert flagger.
  select jobid into existing_jobid from cron.job
    where jobname = 'xrated-affiliate-monthly-alert';
  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;

  -- Daily 14-day approve sweep.
  select jobid into existing_jobid from cron.job
    where jobname = 'xrated-affiliate-pending-to-approved';
  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;
end $$;

select cron.schedule(
  'xrated-affiliate-monthly-alert',
  '0 9 28 * *',
  $$
    UPDATE hammerex_affiliates a
    SET payment_alert_flag = true
    WHERE a.payment_details_completed_at IS NULL
      AND (
        SELECT COALESCE(SUM(c.amount_pence), 0)
        FROM hammerex_affiliate_commissions c
        WHERE c.affiliate_id = a.affiliate_id
          AND c.status = 'approved'
      ) >= 5000;
  $$
);

select cron.schedule(
  'xrated-affiliate-pending-to-approved',
  '30 3 * * *',
  $$
    UPDATE hammerex_affiliate_commissions
    SET status = 'approved', approved_at = now()
    WHERE status = 'pending'
      AND created_at < now() - interval '14 days';
  $$
);
