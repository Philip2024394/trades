-- Xrated Trades — Affiliate Programme Phase 3 (2/7).
-- Campaign system: monthly competitions, bonus multipliers,
-- seasonal promotions.
--
-- A campaign row attaches additional value to commissions created
-- WHILE the campaign is active. New commissions in that window pick
-- up `amount_pence = (1000 * multiplier) + bonus_pence` and have the
-- `campaign_id` stamped for audit + reporting. Competitions also
-- generate prize_pence × prize_count payouts when ended.

create table if not exists public.hammerex_affiliate_campaigns (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('competition', 'bonus', 'seasonal')),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  bonus_pence integer not null default 0,
  multiplier numeric not null default 1.0,
  prize_pence integer not null default 0,
  prize_count integer not null default 0,
  status text not null default 'active'
    check (status in ('active', 'ended', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists hammerex_affiliate_campaigns_active_idx
  on public.hammerex_affiliate_campaigns (status, starts_at, ends_at);

-- Stamp the campaign that priced each commission. Null = base £10.
alter table public.hammerex_affiliate_commissions
  add column if not exists campaign_id uuid;
create index if not exists hammerex_affiliate_commissions_campaign_idx
  on public.hammerex_affiliate_commissions (campaign_id)
  where campaign_id is not null;
