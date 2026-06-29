-- Xrated Trades — Affiliate Programme Phase 3 (1/7).
-- Level system: Bronze / Silver / Gold / Platinum.
--
-- The `level` column is the canonical badge surfaced on the dashboard
-- and public leaderboard. It is computed from the count of commissions
-- in the `paid` terminal state (NOT pending/approved/cancelled), and
-- promoted automatically by recomputeAffiliateLevel() helper invoked
-- whenever a commission flips to paid. The level_promoted_at column
-- stamps the most recent promotion so the email helper can avoid
-- re-sending the same "you levelled up" message.

alter table public.hammerex_affiliates
  add column if not exists level text not null default 'bronze'
    check (level in ('bronze', 'silver', 'gold', 'platinum'));

alter table public.hammerex_affiliates
  add column if not exists level_promoted_at timestamptz;

create index if not exists hammerex_affiliates_level_idx
  on public.hammerex_affiliates (level);
