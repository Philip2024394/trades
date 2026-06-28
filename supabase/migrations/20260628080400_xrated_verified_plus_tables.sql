-- Xrated Trades — Verified Plus tier tables.
--
-- Two tables:
--
-- 1. hammerex_verified_waitlist  — the shipped waitlist endpoint
--    (POST /api/trade-off/verified-waitlist). Captures pre-launch interest
--    so we can email these tradies first + honour the £19.99/mo-locked-
--    for-life promise via a coupon code at launch. Falls back to admin
--    notify if the table is missing (route.ts:54-83), but this migration
--    codifies it so the route always has a place to land.
--
-- 2. hammerex_trade_off_verified_plus_applications  — the eventual
--    applications table (full verification submission with DBS doc,
--    insurance doc, trade-body certs). Type
--    HammerexTradeOffVerifiedPlusApplication exists in
--    src/lib/supabase.ts:764-779 but no route writes here yet — created
--    for forward-compat so the schema matches the type catalog.
--
-- listing_id is plain uuid (no FK) for the applications table to keep
-- this migration idempotent on schemas without hammerex_trade_off_listings.

CREATE TABLE IF NOT EXISTS public.hammerex_verified_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name text NOT NULL,
  company_name text NOT NULL,
  country text NOT NULL,
  email text NOT NULL UNIQUE,
  whatsapp text,
  price_locked_gbp integer,
  source_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_verified_waitlist_created_idx
  ON public.hammerex_verified_waitlist (created_at DESC);

CREATE TABLE IF NOT EXISTS public.hammerex_trade_off_verified_plus_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  applicant_name text NOT NULL,
  contact_phone text NOT NULL,
  dbs_doc_url text,
  insurance_doc_url text,
  insurance_amount_pence integer,
  trade_body_names text[],
  trade_body_cert_urls text[],
  notes text,
  status text NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied','in_review','approved','rejected')),
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX IF NOT EXISTS hammerex_trade_off_verified_plus_apps_listing_idx
  ON public.hammerex_trade_off_verified_plus_applications (listing_id, status);
