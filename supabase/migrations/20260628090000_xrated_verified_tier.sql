-- Xrated Trades — add the `app_verified` tier value.
--
-- The `tier` column on hammerex_trade_off_listings is stored as TEXT with
-- a CHECK constraint (see 20260625120000_hammerex_xratedtrades_mini_app.sql).
-- The Verified tier (£19.99/mo) is on a waitlist until Q3 2026; this
-- migration prepares the storage so flipping WAITLIST_MODE off has a
-- valid tier value to land on.
--
-- Safe to re-run: we DROP the old CHECK constraint and ADD the new one
-- with the expanded value list. No data migration is needed — existing
-- rows continue to satisfy the new constraint (the value set is a
-- strict superset).
--
-- Naming: Postgres auto-named the original constraint
-- `hammerex_trade_off_listings_tier_check` (standard
-- `<table>_<column>_check` pattern). Drop IF EXISTS keeps this idempotent
-- even if a future migration renames the constraint.

-- Live state (verified 2026-06-28): the live CHECK constraint already
-- contains 'verified' and 'verified_plus' from in-flight beacon code,
-- and 3 rows have tier='verified'. To stay non-destructive we keep
-- those values in the new constraint (strict superset of the current
-- definition) and simply ADD 'app_verified' alongside them. The
-- TypeScript canonical name is 'app_verified' (matches app_trial,
-- app_paid, app_expired); 'verified' / 'verified_plus' remain DB-valid
-- so existing rows + the beacon route continue to work, and a future
-- pass can migrate them once the beacon code is rewritten.

alter table public.hammerex_trade_off_listings
  drop constraint if exists hammerex_trade_off_listings_tier_check;

alter table public.hammerex_trade_off_listings
  add constraint hammerex_trade_off_listings_tier_check
  check (
    tier in (
      'standard',
      'app_trial',
      'app_paid',
      'app_expired',
      'app_verified',
      'verified',
      'verified_plus'
    )
  );
