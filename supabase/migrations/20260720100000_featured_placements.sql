-- Featured Placement — Pro-tier paid boost on Site Interest.
--
-- Trades pay £4.99/mo for a rolling 7-day featured position at the
-- top of Site Interest for a specific trade category. Fixed seat
-- count per category (3 max) so scarcity is real; when all 3 seats
-- are filled the next purchase queues until one expires.
--
-- This migration ships the SURFACE (placement rows + search boost).
-- Actual Stripe billing integration is a follow-up pass — for now
-- admin manually inserts placement rows via the admin dashboard so
-- trades can be featured today and Stripe wires in without a
-- schema change.
--
-- Design decisions (Philip 2026-07-16):
--   • Placement is per trade + per category, not per image. When a
--     trade is featured on "loft ladders" all their approved images
--     tagged with that trade surface first.
--   • Scarcity — max 3 active featured slots per category. Enforced
--     at API level (not table constraint) so admin can override in
--     unusual cases.
--   • Rolling 7-day expiry from `starts_at` — a "monthly" placement
--     is actually four consecutive weekly slots that auto-refresh
--     via Stripe subscription later.

create table if not exists public.networkers_featured_placements (
  id                uuid        primary key default gen_random_uuid(),
  trade_slug        text        not null,   -- the merchant slug being featured
  category          text        not null,   -- keyword the boost applies to (e.g. "loft ladders")
  status            text        not null default 'active'
                                check (status in ('active', 'queued', 'expired', 'refunded', 'cancelled')),
  starts_at         timestamptz not null default now(),
  expires_at        timestamptz not null,
  paid_amount_gbp   int         not null default 0,       -- pence (£4.99 = 499)
  billing_source    text        not null default 'admin', -- 'admin' | 'stripe' | 'trial'
  stripe_session_id text,
  admin_note        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Fast public lookup — "what's featured on category X right now?"
create index if not exists networkers_featured_placements_active_category
  on public.networkers_featured_placements (category, expires_at)
  where status = 'active';

-- Trade inbox — "am I featured anywhere right now?"
create index if not exists networkers_featured_placements_trade_active
  on public.networkers_featured_placements (trade_slug, expires_at desc)
  where status = 'active';

create index if not exists networkers_featured_placements_admin_recent
  on public.networkers_featured_placements (status, created_at desc);

-- Auto-touch updated_at
create or replace function public.networkers_featured_placements_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_networkers_featured_placements_touch on public.networkers_featured_placements;
create trigger trg_networkers_featured_placements_touch
  before update on public.networkers_featured_placements
  for each row execute function public.networkers_featured_placements_touch();
