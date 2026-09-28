-- ============================================================================
-- NEX-native Migration 075 · Bridge 20 · Product spec + typed variants
-- ============================================================================
--
-- Two seller-facing upgrades to the physical-goods listing model.
--
-- 1) `nex_product.spec jsonb`
--    A structured specification block rendered as the "Specifications"
--    section on the buyer product-detail page. Common keys across
--    physical goods:
--       condition · origin · brand · model · authenticity · materials
--       dimensions · weight · included · warranty · certifications
--       age_rating · year_produced · care_instructions
--    Service-specific (populated when business_category is a service
--    vertical):
--       duration · service_location · advance_booking · age_range
--    Manufacturer-specific:
--       hs_code · export_markets · factory_location · production_capacity
--       lead_time
--    Free-form extras stored under an `additional` object · never
--    validated on write · seller keeps their own schema per shop.
--
--    Stored as jsonb (not per-column) so we can add new keys without
--    schema migrations · every reader is a defensive TS type on the
--    boundary.
--
-- 2) `nex_product_variant.attribute` + `nex_product_variant.stock_status`
--    Variants get a typed attribute so buyers can pick Size and
--    Colour independently instead of hunting through a flat list.
--    Canonical attributes: size · colour · material · package ·
--    duration · style · finish · fit · pack_size.
--    Legacy variants (attribute IS NULL) keep working · UI falls
--    back to the flat-list renderer for them.
--    Per-variant stock_status lets a seller mark just "size L · sold
--    out" without archiving the product.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '075';
--     ALTER TABLE nex_product DROP COLUMN IF EXISTS spec;
--     ALTER TABLE nex_product_variant
--       DROP COLUMN IF EXISTS attribute,
--       DROP COLUMN IF EXISTS stock_status;
--   COMMIT;
-- ============================================================================

BEGIN;

-- 1) Product spec column
ALTER TABLE nex_product
  ADD COLUMN IF NOT EXISTS spec jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN nex_product.spec IS
  'Structured product specifications · rendered as the buyer-facing
   Specifications section on the product detail page. JSONB so we can
   evolve keys per vertical without schema migrations. Canonical keys:
   condition · origin · brand · model · authenticity · materials[] ·
   dimensions{w,h,d,unit} · weight{value,unit} · included[] ·
   warranty · certifications[] · age_rating · year_produced ·
   care_instructions · duration · service_location · advance_booking ·
   age_range · hs_code · export_markets[] · factory_location ·
   production_capacity · lead_time · additional{...}. Sealed
   2026-09-28 · Bridge 20.';

-- Small GIN index so future search facets (e.g. materials, origin)
-- can filter by spec keys.
CREATE INDEX IF NOT EXISTS idx_nex_product_spec_gin
  ON nex_product USING gin (spec);

-- 2) Typed variant columns
ALTER TABLE nex_product_variant
  ADD COLUMN IF NOT EXISTS attribute text,
  ADD COLUMN IF NOT EXISTS stock_status text;

-- Canonical attribute values · legacy NULL is allowed so existing
-- variants keep working.
ALTER TABLE nex_product_variant
  DROP CONSTRAINT IF EXISTS nex_product_variant_attribute_check;
ALTER TABLE nex_product_variant
  ADD CONSTRAINT nex_product_variant_attribute_check
  CHECK (
    attribute IS NULL OR attribute IN (
      'size',
      'colour',
      'material',
      'package',
      'duration',
      'style',
      'finish',
      'fit',
      'pack_size',
      'other'
    )
  );

-- Per-variant stock status · same vocabulary as nex_product.stock_status.
ALTER TABLE nex_product_variant
  DROP CONSTRAINT IF EXISTS nex_product_variant_stock_status_check;
ALTER TABLE nex_product_variant
  ADD CONSTRAINT nex_product_variant_stock_status_check
  CHECK (
    stock_status IS NULL OR stock_status IN (
      'in_stock',
      'low_stock',
      'made_to_order',
      'sold_out'
    )
  );

CREATE INDEX IF NOT EXISTS idx_nex_product_variant_attribute
  ON nex_product_variant (product_id, attribute, position);

COMMENT ON COLUMN nex_product_variant.attribute IS
  'Canonical variant axis · size / colour / material / package /
   duration / style / finish / fit / pack_size / other. Groups the
   variant so the buyer picker renders separate rows per attribute
   instead of a flat list. NULL for legacy variants (flat rendering
   fallback). Sealed 2026-09-28 · Bridge 20.';

COMMENT ON COLUMN nex_product_variant.stock_status IS
  'Per-variant stock override · when NULL, the product-level
   stock_status applies to this variant. Allows "size L · sold out"
   without archiving the whole product. Sealed 2026-09-28 · Bridge 20.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '075',
    'Bridge 20 · nex_product.spec jsonb + nex_product_variant.attribute + stock_status',
    'Founder-authorised 2026-09-28. World-class product spec + typed variants. Adds structured spec JSONB (open schema · common keys per vertical) and typed variant axes (size / colour / material / etc.) with per-variant stock override. Legacy variants (attribute NULL) keep working. GIN index on spec for future search facets.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
