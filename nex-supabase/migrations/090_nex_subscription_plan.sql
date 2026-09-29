-- Migration 090 · Subscription plan column · Bridge 57 · sealed 2026-09-29
-- ---------------------------------------------------------------------------
-- Adds nex_account.subscription_plan to track WHICH package the buyer
-- is paying for. Separate from `tier` (which is the effective feature
-- gate = gratis | bisnis | pro).
--
-- Values match the sealed pricing ladder:
--   · null      → no active paid plan (gratis default)
--   · 'buy'     → Rp 25k one-time · a single theme unlocked forever
--   · 'ringan'  → Rp 15k/mo · rotating 5 premium themes
--   · 'bisnis'  → Rp 39k/mo · full catalog + shop slider + verified
--   · 'custom'  → Rp 1jt one-time · Own Theme Request (bespoke)
--
-- For 'buy' plans, the specific theme_id lives elsewhere (a follow-up
-- bridge will add a nex_theme_ownership table so a buyer can own many
-- one-time themes). For subscription plans (ringan/bisnis/custom) the
-- effective tier and bisnis_expires_at drive permissions.

alter table nex_account
  add column if not exists subscription_plan text;

alter table nex_account
  drop constraint if exists nex_account_subscription_plan_known;

alter table nex_account
  add constraint nex_account_subscription_plan_known
  check (
    subscription_plan is null
    or subscription_plan = any (
      array['buy'::text, 'ringan'::text, 'bisnis'::text, 'custom'::text]
    )
  );

create index if not exists nex_account_subscription_plan_idx
  on nex_account (subscription_plan)
  where subscription_plan is not null;

comment on column nex_account.subscription_plan is
  'Bridge 57 · Sealed 2026-09-29. Which paid package the buyer holds (buy / ringan / bisnis / custom) · NULL = gratis default. Distinct from tier which is the effective feature gate. Set by admin on payment confirmation.';
