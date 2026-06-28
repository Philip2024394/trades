-- Xrated Trades — codify schema drift on hammerex_trade_off_listings.
--
-- Every column below is written by API routes in src/app/api/trade-off/* but
-- has no migration in this repo. The columns most likely live in the shared
-- Hammerex side's migrations (the Supabase project is shared with hammerex).
-- This file makes the trades repo self-sufficient: a fresh DB built only
-- from supabase/migrations/ in this repo gets every column the code needs.
--
-- All ADD COLUMN IF NOT EXISTS — safe to re-run; if the column already
-- exists with a different type, Postgres no-ops (we accept the existing
-- type rather than risk an ALTER TYPE).
--
-- Sources:
--   socials             : src/app/api/trade-off/update/route.ts:68-71
--   payment_methods     : src/app/api/trade-off/payment-methods/route.ts
--   retail_shipping_*   : src/app/api/trade-off/listings/retail-shipping/route.ts
--   *_url legal links   : src/app/api/trade-off/listings/legal-links/route.ts
--   paid_expires_at +   : src/app/api/stripe/webhook/route.ts:82-83,108
--     last_payment_plan
--   recommendations     : src/app/api/trade-off/update/route.ts:165,387

ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS twitter text,
  ADD COLUMN IF NOT EXISTS snapchat text,
  ADD COLUMN IF NOT EXISTS reddit text,
  ADD COLUMN IF NOT EXISTS google text;

ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS payment_methods text[];

ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS retail_shipping_uk_pence integer,
  ADD COLUMN IF NOT EXISTS retail_shipping_uk_areas jsonb,
  ADD COLUMN IF NOT EXISTS retail_shipping_international jsonb;

ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS terms_url text,
  ADD COLUMN IF NOT EXISTS privacy_url text,
  ADD COLUMN IF NOT EXISTS returns_url text,
  ADD COLUMN IF NOT EXISTS about_url text;

ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS paid_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_payment_plan text;

ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS recommendations jsonb NOT NULL DEFAULT '[]'::jsonb;
