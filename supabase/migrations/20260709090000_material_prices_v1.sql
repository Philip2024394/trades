-- Live merchant price tickers — shift 2 mechanic.
--
-- Any live listing can publish a live price for an item (free-text
-- slug + human label + unit + amount). Trades query by fuzzy item
-- match + optional postcode prefix and see the range of prices in
-- their area right now.
--
-- No item taxonomy in v1 — merchants use their own labels
-- ("6-inch angle iron"), lookup uses ILIKE on both label and slug.
-- When volume warrants it we layer a controlled vocabulary on top.
--
-- Rows auto-expire after 14 days of no update so stale prices drop
-- off automatically. Merchants can set is_live=false to hide a row
-- without deleting.

BEGIN;

CREATE TABLE IF NOT EXISTS hammerex_material_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,

  -- Item identity — merchant-authored.
  item_slug text NOT NULL CHECK (char_length(item_slug) BETWEEN 1 AND 80),
  item_label text NOT NULL CHECK (char_length(item_label) BETWEEN 1 AND 140),
  unit_label text NOT NULL CHECK (char_length(unit_label) BETWEEN 1 AND 40),

  -- Money — pence + currency + optional "for N units" for bulk pricing.
  price_pence int NOT NULL CHECK (price_pence >= 0),
  currency text NOT NULL DEFAULT 'GBP'
    CHECK (currency IN ('GBP', 'USD', 'EUR')),
  qty_included int NOT NULL DEFAULT 1
    CHECK (qty_included >= 1),

  -- Location — postcode prefix for radius-ish matching. Region kept as
  -- free text for display. Coordinates deferred until PostGIS lands.
  postcode_prefix text CHECK (
    postcode_prefix IS NULL OR char_length(postcode_prefix) <= 6
  ),
  region text CHECK (region IS NULL OR char_length(region) <= 120),

  -- Publishing state.
  is_live boolean NOT NULL DEFAULT true,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 400),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '14 days'),

  -- One row per merchant per item — republishing updates the row.
  UNIQUE (merchant_listing_id, item_slug)
);

-- Lookup index — item ILIKE + postcode prefix filter.
CREATE INDEX IF NOT EXISTS material_prices_lookup_idx
  ON hammerex_material_prices (item_slug, postcode_prefix, updated_at DESC)
  WHERE is_live = true;

-- Merchant dashboard index — list everything they've published.
CREATE INDEX IF NOT EXISTS material_prices_merchant_idx
  ON hammerex_material_prices (merchant_listing_id, updated_at DESC);

-- Public index page — recent updates by currency + region.
CREATE INDEX IF NOT EXISTS material_prices_recent_idx
  ON hammerex_material_prices (updated_at DESC)
  WHERE is_live = true;


-- Trigger — bump updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION material_prices_touch_updated()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS material_prices_touch_updated
  ON hammerex_material_prices;
CREATE TRIGGER material_prices_touch_updated
BEFORE UPDATE ON hammerex_material_prices
FOR EACH ROW EXECUTE FUNCTION material_prices_touch_updated();


-- Cleanup — hard-delete expired rows.
CREATE OR REPLACE FUNCTION material_prices_cleanup_expired()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM hammerex_material_prices WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMIT;
