-- Migration 089 · Themes 7-day free trial · Bridge 56g · sealed 2026-09-29
-- ---------------------------------------------------------------------------
-- Anti-abuse trial mechanic for the NEX Plans page. Every account gets
-- ONE 7-day free trial of premium themes over their lifetime — once
-- consumed, the "Try 7 days free" pill vanishes from the tier page and
-- from the theme picker, and premium features gate on paid tier again.
--
-- Design: single timestamp column `themes_trial_used_at` set ONCE at
-- trial activation. The 7-day expiry is computed in the service layer
-- (account-service.ts) rather than as a Postgres generated column,
-- because `timestamptz + interval` isn't marked immutable in every
-- Postgres release and generated columns require immutable expressions.
-- effectiveTier() reads themes_trial_used_at + adds 7 days in JS.

alter table nex_account
  add column if not exists themes_trial_used_at timestamptz,
  add column if not exists themes_trial_package_id text;

create index if not exists nex_account_themes_trial_used_at_idx
  on nex_account (themes_trial_used_at)
  where themes_trial_used_at is not null;

comment on column nex_account.themes_trial_used_at is
  'Bridge 56g · Sealed 2026-09-29. Timestamp when the buyer activated their one-time 7-day free premium-theme trial. Never reset — one trial per account lifetime. Service layer adds interval 7 days to compute the expiry.';

comment on column nex_account.themes_trial_package_id is
  'Which package the buyer picked as the on-ramp for their trial (buy | ringan | bisnis). Informational only — the trial always grants full Bisnis-tier feature access during the 7-day window.';
