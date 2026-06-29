-- Xrated Trades — Affiliate Programme Phase 3 (6/7).
-- Fraud-detection flags + review queue.
--
-- fraud_flags is a JSONB array of { flag, detected_at, reason } items
-- emitted by the daily /api/cron/affiliate-fraud-check job. When any
-- flag is present we also set requires_review=true so the admin can
-- triage at /admin/affiliates/review-queue.
--
-- The four rules implemented (all in pure SQL / TS — no paid APIs):
--   1. duplicate_ip            — >50% of clicks from one IP
--   2. zero_signups_high_clicks — >100 clicks / 0 signups in 30 days
--   3. zero_paid_high_signups  — >100 clicks / 0 paid in 30 days
--   4. self_referral_attempt   — flagged by Stripe webhook on the fly

alter table public.hammerex_affiliates
  add column if not exists fraud_flags jsonb not null default '[]'::jsonb;

alter table public.hammerex_affiliates
  add column if not exists requires_review boolean not null default false;

create index if not exists hammerex_affiliates_requires_review_idx
  on public.hammerex_affiliates (requires_review)
  where requires_review = true;
