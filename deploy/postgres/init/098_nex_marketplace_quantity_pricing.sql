-- deploy/postgres/init/098_nex_marketplace_quantity_pricing.sql
--
-- NEX MARKET · Quantity Pricing (signature behaviour #2).
--
-- Doctrine (per project_nex_market_quantity_pricing_and_bundles_2026_08_24.md):
--   · Seller sets absolute Rp-per-unit at qty tiers (NOT %). Matches how
--     Indonesian sellers already price.
--   · Applies only to products WITHOUT variants in this MVP slice · variant
--     products keep per-variant pricing (tier composition on variants deferred).
--   · CHECK constraint enforces shape at DB level · seller UI + server action
--     also validate · triple defence.
--   · Empty array = no tiers active = base price for all quantities.
--
-- Additive · reversible.

BEGIN;

ALTER TABLE nex.mp_product
  ADD COLUMN IF NOT EXISTS qty_price_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Shape:
--   [] · or ·
--   [{"minQty": 2, "pricePerUnitIdr": 142500}, {"minQty": 3, "pricePerUnitIdr": 135000}]
--
-- IMMUTABLE validator (Postgres forbids subqueries in CHECK · use a function):
--   · array of objects
--   · every element has integer minQty >= 2
--   · every element has integer pricePerUnitIdr > 0
--   · minQty values strictly ascending across the array
--   · pricePerUnitIdr values strictly descending across the array
CREATE OR REPLACE FUNCTION nex.qty_price_tiers_wellformed(v jsonb)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
AS $fn$
DECLARE
  el          jsonb;
  min_qty     int;
  price_idr   int;
  prev_min    int := NULL;
  prev_price  int := NULL;
BEGIN
  IF jsonb_typeof(v) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(v) = 0 THEN RETURN true; END IF;

  FOR el IN SELECT * FROM jsonb_array_elements(v) LOOP
    IF jsonb_typeof(el) <> 'object' THEN RETURN false; END IF;
    IF jsonb_typeof(el->'minQty')          <> 'number' THEN RETURN false; END IF;
    IF jsonb_typeof(el->'pricePerUnitIdr') <> 'number' THEN RETURN false; END IF;

    min_qty   := (el->>'minQty')::int;
    price_idr := (el->>'pricePerUnitIdr')::int;
    IF min_qty   < 2 THEN RETURN false; END IF;
    IF price_idr <= 0 THEN RETURN false; END IF;

    IF prev_min IS NOT NULL AND min_qty <= prev_min THEN RETURN false; END IF;
    IF prev_price IS NOT NULL AND price_idr >= prev_price THEN RETURN false; END IF;

    prev_min   := min_qty;
    prev_price := price_idr;
  END LOOP;

  RETURN true;
END;
$fn$;

ALTER TABLE nex.mp_product
  DROP CONSTRAINT IF EXISTS qty_price_tiers_wellformed;

ALTER TABLE nex.mp_product
  ADD CONSTRAINT qty_price_tiers_wellformed
  CHECK (nex.qty_price_tiers_wellformed(qty_price_tiers));

-- Doctrine restriction · MVP slice: quantity pricing only meaningful for
-- non-variant products. Variant products carry per-variant price already.
ALTER TABLE nex.mp_product
  DROP CONSTRAINT IF EXISTS qty_tiers_only_when_no_variants;

ALTER TABLE nex.mp_product
  ADD CONSTRAINT qty_tiers_only_when_no_variants CHECK (
    qty_price_tiers = '[]'::jsonb OR has_variants = false
  );

COMMENT ON COLUMN nex.mp_product.qty_price_tiers IS
  'Quantity pricing tiers (signature behaviour #2). Absolute IDR per unit at qty>=minQty. '
  'Shape: [{"minQty":int>=2,"pricePerUnitIdr":int>0}]. Ascending minQty, descending price. '
  'Empty array = no tiers = base_price_idr applies to all quantities. Only valid on non-variant products.';

COMMIT;

-- Rollback:
--   BEGIN;
--     ALTER TABLE nex.mp_product DROP CONSTRAINT IF EXISTS qty_tiers_only_when_no_variants;
--     ALTER TABLE nex.mp_product DROP CONSTRAINT IF EXISTS qty_price_tiers_wellformed;
--     DROP FUNCTION IF EXISTS nex.qty_price_tiers_wellformed(jsonb);
--     ALTER TABLE nex.mp_product DROP COLUMN IF EXISTS qty_price_tiers;
--   COMMIT;
