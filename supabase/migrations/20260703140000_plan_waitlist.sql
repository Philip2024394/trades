-- Xrated Trades — plan waitlist.
--
-- Captures signups for tiers not yet actionable: STARTER (£9.99/mo)
-- and BUSINESS (£24.99/mo). One row per (email, tier) pair.
--
-- Falls back to admin notification in the API route if this migration
-- hasn't been applied yet.

create table if not exists public.hammerex_plan_waitlist (
  id uuid primary key default gen_random_uuid(),
  tier text not null check (tier in ('starter', 'business')),
  trade_name text not null,
  company_name text,
  country text,
  email text not null,
  whatsapp text,
  source_path text,
  created_at timestamptz not null default now(),
  unique (tier, email)
);

create index if not exists hammerex_plan_waitlist_tier_idx
  on public.hammerex_plan_waitlist (tier, created_at desc);

create index if not exists hammerex_plan_waitlist_email_idx
  on public.hammerex_plan_waitlist (email);
