-- The Yard v3 — marketplace commerce fields + video attachments.
--
-- Adds the fields buyers care about (currency, condition, warranty,
-- stock, delivery options) so tools-sell / materials-surplus /
-- tools-rent listings render as real product cards, not classifieds.
--
-- Also adds video_urls (paid-tier only, enforced by API not DB — tier
-- can lapse over time and we grandfather existing video on downgrade).

BEGIN;

-- ── Commerce columns ────────────────────────────────────────────────
ALTER TABLE hammerex_trade_off_yard_posts
  ADD COLUMN IF NOT EXISTS price_currency text NOT NULL DEFAULT 'GBP'
    CHECK (price_currency IN ('GBP', 'USD', 'EUR')),
  ADD COLUMN IF NOT EXISTS condition text
    CHECK (condition IN (
      'new',
      'used-like-new',
      'used-good',
      'used-fair',
      'for-parts'
    )),
  ADD COLUMN IF NOT EXISTS warranty_status text
    CHECK (warranty_status IN (
      'manufacturer',
      'seller-warranty',
      'sold-as-seen'
    )),
  ADD COLUMN IF NOT EXISTS stock_qty int NOT NULL DEFAULT 1
    CHECK (stock_qty >= 0),
  ADD COLUMN IF NOT EXISTS delivery_options text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS delivery_free_over_pence int
    CHECK (delivery_free_over_pence IS NULL OR delivery_free_over_pence >= 0);

-- delivery_options entries must be from a fixed vocabulary. Enforced
-- with a per-element check via a trigger-free array containment
-- constraint (all elements must be in the allowed set).
ALTER TABLE hammerex_trade_off_yard_posts
  DROP CONSTRAINT IF EXISTS hammerex_trade_off_yard_posts_delivery_options_check;

ALTER TABLE hammerex_trade_off_yard_posts
  ADD CONSTRAINT hammerex_trade_off_yard_posts_delivery_options_check
  CHECK (
    delivery_options <@ ARRAY[
      'collection',
      'local-delivery',
      'uk-shipping',
      'international'
    ]::text[]
  );


-- ── Video attachments (paid-tier only, enforced by API) ─────────────
ALTER TABLE hammerex_trade_off_yard_posts
  ADD COLUMN IF NOT EXISTS video_urls text[] NOT NULL DEFAULT '{}'::text[];

-- Cap at 1 video per post for v1; widen later if needed.
ALTER TABLE hammerex_trade_off_yard_posts
  DROP CONSTRAINT IF EXISTS hammerex_trade_off_yard_posts_video_urls_check;

ALTER TABLE hammerex_trade_off_yard_posts
  ADD CONSTRAINT hammerex_trade_off_yard_posts_video_urls_check
  CHECK (array_length(video_urls, 1) IS NULL OR array_length(video_urls, 1) <= 1);


-- ── Indexes for buyer-facing filters ────────────────────────────────
CREATE INDEX IF NOT EXISTS yard_posts_marketplace_filter_idx
  ON hammerex_trade_off_yard_posts (kind, condition, status)
  WHERE status = 'live'
    AND kind IN ('tools-sell', 'tools-buy', 'tools-rent', 'materials-surplus', 'product');

COMMIT;
