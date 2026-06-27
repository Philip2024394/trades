-- Xrated Trades — Wholesale Mode add-on (£7/mo).
--
-- Bulk pricing tiers per product, free-delivery radius from yard,
-- banded distance-based delivery. Built for builder's merchants,
-- materials yards, tool suppliers.
--
-- 1. hammerex_xrated_products.bulk_tiers — jsonb array of
--    { min_qty, max_qty?, price_pence }. Empty array = no tier
--    pricing. App enforces ascending min_qty + ≤5 tiers + integer
--    pence ≥ 1 on the API side; here we only assert it's an array so
--    a legacy NULL row never blows up reads.
--
-- 2. hammerex_trade_off_listings — yard origin + wholesale toggles.
--    Lat/lng nullable so a listing can enable wholesale_mode and fill
--    in the yard later. Fudge factor 1.0-3.0 (default 1.4) maps
--    straight-line distance to road distance without us calling a
--    routing API.
--
-- 3. hammerex_xrated_wholesale_zones — one row per listing (we keep
--    it as a table rather than a column for headroom: future "zones
--    by named region" / per-product-class banded pricing fit here
--    without a schema break). banded_pricing is a jsonb array of
--    { max_km, price_pence, min_order_pence }. Beyond the largest
--    max_km the customer is told to WhatsApp for a custom quote.

-- 1. Bulk tiers + product-level wholesale flag
ALTER TABLE hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS bulk_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bulk_tiers_is_array'
      AND conrelid = 'hammerex_xrated_products'::regclass
  ) THEN
    ALTER TABLE hammerex_xrated_products
      ADD CONSTRAINT bulk_tiers_is_array
        CHECK (jsonb_typeof(bulk_tiers) = 'array');
  END IF;
END $$;

-- 2. Yard origin + wholesale config on the listing
ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS wholesale_origin_address text,
  ADD COLUMN IF NOT EXISTS wholesale_origin_postcode text,
  ADD COLUMN IF NOT EXISTS wholesale_origin_lat double precision,
  ADD COLUMN IF NOT EXISTS wholesale_origin_lng double precision,
  ADD COLUMN IF NOT EXISTS wholesale_distance_fudge numeric(3,2) NOT NULL DEFAULT 1.40,
  ADD COLUMN IF NOT EXISTS wholesale_allow_pickup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wholesale_currency char(3) NOT NULL DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS wholesale_prices_ex_vat boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wholesale_origin_lat_range'
      AND conrelid = 'hammerex_trade_off_listings'::regclass
  ) THEN
    ALTER TABLE hammerex_trade_off_listings
      ADD CONSTRAINT wholesale_origin_lat_range
        CHECK (wholesale_origin_lat IS NULL
            OR (wholesale_origin_lat BETWEEN -90 AND 90));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wholesale_origin_lng_range'
      AND conrelid = 'hammerex_trade_off_listings'::regclass
  ) THEN
    ALTER TABLE hammerex_trade_off_listings
      ADD CONSTRAINT wholesale_origin_lng_range
        CHECK (wholesale_origin_lng IS NULL
            OR (wholesale_origin_lng BETWEEN -180 AND 180));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wholesale_fudge_range'
      AND conrelid = 'hammerex_trade_off_listings'::regclass
  ) THEN
    ALTER TABLE hammerex_trade_off_listings
      ADD CONSTRAINT wholesale_fudge_range
        CHECK (wholesale_distance_fudge BETWEEN 1.0 AND 3.0);
  END IF;
END $$;

-- 3. Wholesale delivery zones table
CREATE TABLE IF NOT EXISTS hammerex_xrated_wholesale_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  free_radius_km numeric(6,2),
  free_postcodes text[] NOT NULL DEFAULT '{}'::text[],
  banded_pricing jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_order_pence integer NOT NULL DEFAULT 0,
  max_delivery_km numeric(6,2),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT banded_pricing_is_array
    CHECK (jsonb_typeof(banded_pricing) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_wholesale_zones_listing
  ON hammerex_xrated_wholesale_zones(listing_id, sort_order);

-- 4. updated_at touch trigger (function exists from earlier migrations)
DROP TRIGGER IF EXISTS hammerex_xrated_wholesale_zones_touch
  ON hammerex_xrated_wholesale_zones;
CREATE TRIGGER hammerex_xrated_wholesale_zones_touch
  BEFORE UPDATE ON hammerex_xrated_wholesale_zones
  FOR EACH ROW EXECUTE FUNCTION hammerex_xrated_touch_updated_at();
