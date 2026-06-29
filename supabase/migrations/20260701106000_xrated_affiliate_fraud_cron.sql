-- Xrated Trades — Affiliate Programme Phase 3 (7/7).
-- Documents the scheduled daily fraud-check cron. Vercel handles the
-- actual scheduling via vercel.json; this migration exists purely to
-- give the Supabase schema a paper trail so anyone restoring from
-- backup knows the cron exists.
--
-- Schedule: 04:00 UTC daily.
-- Endpoint: /api/cron/affiliate-fraud-check
-- Behaviour: scans all active affiliates, evaluates the four fraud
-- rules over the last 30 days, writes any new flags to the
-- fraud_flags array and sets requires_review=true. Does NOT clear
-- existing flags — only the admin "Mark as reviewed" action does that.

comment on column public.hammerex_affiliates.fraud_flags is
  'Append-only JSONB array. Written by /api/cron/affiliate-fraud-check daily at 04:00 UTC. Cleared only by admin "Mark as reviewed" action.';
