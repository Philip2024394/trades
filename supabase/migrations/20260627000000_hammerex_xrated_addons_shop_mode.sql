-- Xrated Trades — Add-ons system + Shop Mode (Phase 1)
--
-- 1. addons_enabled JSONB on listings — registry of which add-ons each
--    tradesperson has switched on. Shape: { shop_mode: true, ... }.
--    Trusted Trades is included-by-default-on-paid (not toggled here) so
--    every key in this map represents an opt-in add-on.
--
-- 2. hammerex_xrated_products — per-listing product catalog used by the
--    Shop Mode add-on. Up to 4 images per product (cover + 3 gallery),
--    optional stock count, dispatch days, compare-with sibling list. All
--    monetary values are stored as integer pence (so £34.99 = 3499) to
--    match standard e-commerce precision.
--
-- 3. hammerex_xrated_shipping_zones — per-listing, per-country shipping
--    config. air_price_pence / sea_price_pence are nullable so a tradie
--    can offer only one mode for a given country. ETA is a min/max range
--    in days, surfaced on the cart page as "delivered in 7-12 days".

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS addons_enabled jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS hammerex_xrated_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_pence integer NOT NULL DEFAULT 0 CHECK (price_pence >= 0),
  stock_count integer CHECK (stock_count IS NULL OR stock_count >= 0),
  cover_url text,
  gallery_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  dispatch_days integer CHECK (dispatch_days IS NULL OR dispatch_days >= 0),
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  size_chart_url text,
  size_chart_unit text CHECK (size_chart_unit IS NULL OR size_chart_unit IN ('size','kg','litre','cm','other')),
  compare_with text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','archived')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_products_listing_idx
  ON hammerex_xrated_products (listing_id, status, sort_order);

CREATE TABLE IF NOT EXISTS hammerex_xrated_shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  country_name text NOT NULL,
  air_price_pence integer CHECK (air_price_pence IS NULL OR air_price_pence >= 0),
  sea_price_pence integer CHECK (sea_price_pence IS NULL OR sea_price_pence >= 0),
  eta_min_days integer CHECK (eta_min_days IS NULL OR eta_min_days >= 0),
  eta_max_days integer CHECK (eta_max_days IS NULL OR eta_max_days >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, country_code)
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_shipping_zones_listing_idx
  ON hammerex_xrated_shipping_zones (listing_id, sort_order);

-- updated_at touch triggers — mirrors the pattern used elsewhere in the
-- Hammerex schema so the dashboard "Last edited" stamp stays honest.
CREATE OR REPLACE FUNCTION hammerex_xrated_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hammerex_xrated_products_touch ON hammerex_xrated_products;
CREATE TRIGGER hammerex_xrated_products_touch
  BEFORE UPDATE ON hammerex_xrated_products
  FOR EACH ROW EXECUTE FUNCTION hammerex_xrated_touch_updated_at();

DROP TRIGGER IF EXISTS hammerex_xrated_shipping_zones_touch ON hammerex_xrated_shipping_zones;
CREATE TRIGGER hammerex_xrated_shipping_zones_touch
  BEFORE UPDATE ON hammerex_xrated_shipping_zones
  FOR EACH ROW EXECUTE FUNCTION hammerex_xrated_touch_updated_at();
