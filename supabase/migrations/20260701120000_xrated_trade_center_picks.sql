-- Xrated Trades — Trade Center Picks add-on (£4/mo).
--
-- One-table model. Lets merchant-grade trades (building merchants,
-- tool hire, stair / window / kitchen fitters, etc.) pin status
-- banners onto products they sell: on_promo / new_arrival /
-- just_arrived / in_stock / pre_order. Each pick borrows the
-- underlying product's image so there's no image-upload surface.
--
-- Status banners auto-fall-off when expires_at < now() — the public
-- profile teaser filters expired rows out so a forgotten promo
-- doesn't go stale on the customer-facing page.
--
-- 24 picks max per listing — enforced at the API layer (no DB-level
-- count check; matches the Job Diary / Materials Network style of
-- soft-cap at insert time).
--
-- UNIQUE (listing_id, product_id) — one pick per product per listing.
-- Updating a product's status replaces the existing row's status +
-- timestamps; there is no history table (Phase 2 if we add audit).
--
-- The shared hammerex_xrated_touch_updated_at() trigger function
-- already exists (created in the Shop Mode migration).

CREATE TABLE IF NOT EXISTS hammerex_xrated_trade_center_picks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  product_id       uuid NOT NULL
    REFERENCES hammerex_xrated_products(id) ON DELETE CASCADE,
  status           text NOT NULL
    CHECK (status IN ('on_promo','new_arrival','just_arrived','in_stock','pre_order')),
  effective_at     timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,
  arrival_at       timestamptz,                 -- for pre_order / new_arrival
  note             text
    CHECK (note IS NULL OR char_length(note) <= 200),
  sort_order       int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, product_id)
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_trade_center_picks_listing_idx
  ON hammerex_xrated_trade_center_picks (listing_id, sort_order, effective_at DESC);

DROP TRIGGER IF EXISTS hammerex_xrated_trade_center_picks_touch ON hammerex_xrated_trade_center_picks;
CREATE TRIGGER hammerex_xrated_trade_center_picks_touch
  BEFORE UPDATE ON hammerex_xrated_trade_center_picks
  FOR EACH ROW EXECUTE FUNCTION hammerex_xrated_touch_updated_at();
