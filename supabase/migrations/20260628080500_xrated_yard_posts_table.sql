-- Xrated Trades — The Yard board.
--
-- Paid-tier-only (with builder-grade free access) trades-to-trades
-- bulletin board. Type HammerexTradeOffYardPost in
-- src/lib/supabase.ts:807-845. Routes:
--   GET   /api/trade-off/yard/posts
--   POST  /api/trade-off/yard/posts
--   PATCH /api/trade-off/yard/posts/:id
--   DELETE/api/trade-off/yard/posts/:id
--   GET   /api/trade-off/yard/posts/:id/contact   (302 + counter bump)
--
-- listing_id is plain uuid (no FK) — Hammerex side may own the listings
-- table; consuming code validates via edit_token already.
--
-- 14-day auto-expire is applied by the API on insert (route.ts:276-278).
-- We do not declare a default expires_at column-default so DB never auto-
-- expires without the route's chosen window.

CREATE TABLE IF NOT EXISTS public.hammerex_trade_off_yard_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('available','needed','chat','product')),
  trade_slug text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  country text NOT NULL DEFAULT 'UK',
  region text,
  start_date date,
  end_date date,
  crew_size_needed integer,
  day_rate_pence integer,
  is_sample boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'live'
    CHECK (status IN ('live','archived')),
  parent_id uuid,
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachment_url text,
  attachment_name text,
  attachment_kind text CHECK (attachment_kind IS NULL OR attachment_kind IN ('pdf','file')),
  link_url text,
  link_title text,
  contact_count integer NOT NULL DEFAULT 0,
  product_price_pence integer,
  source_product_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS hammerex_trade_off_yard_posts_listing_idx
  ON public.hammerex_trade_off_yard_posts (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS hammerex_trade_off_yard_posts_feed_idx
  ON public.hammerex_trade_off_yard_posts (country, status, expires_at);
