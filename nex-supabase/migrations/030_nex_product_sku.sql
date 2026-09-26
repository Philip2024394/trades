-- ============================================================================
-- NEX-native Migration 030 · nex_product.sku · Product SKU (Wave B Slice 6f)
-- ============================================================================
--
-- Purpose:
--   Add an optional per-product SKU (stock-keeping unit / product code).
--   Constrained by:
--     · pattern  ^[A-Za-z0-9._-]{1,50}$   (safe punctuation set)
--     · unique   (business_id, lower(sku))   ONLY when sku IS NOT NULL
--                so multiple businesses may legitimately reuse the same
--                short SKU (e.g. two shops both use "SKU-001") but a single
--                business can't have two products with the same SKU.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '030';
--     DROP INDEX IF EXISTS idx_nex_product_sku_unique_per_business;
--     ALTER TABLE nex_product DROP CONSTRAINT IF EXISTS nex_product_sku_pattern;
--     ALTER TABLE nex_product DROP COLUMN IF EXISTS sku;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_product
  ADD COLUMN IF NOT EXISTS sku text;

-- Shape constraint: NULL allowed (opt-in) · when set, must match the pattern.
ALTER TABLE nex_product
  DROP CONSTRAINT IF EXISTS nex_product_sku_pattern;
ALTER TABLE nex_product
  ADD CONSTRAINT nex_product_sku_pattern
    CHECK (sku IS NULL OR sku ~ '^[A-Za-z0-9._-]{1,50}$');

-- Per-business case-insensitive uniqueness · only rows where sku IS NOT NULL
-- participate. Two businesses may share the same SKU.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_product_sku_unique_per_business
  ON nex_product (business_id, lower(sku))
  WHERE sku IS NOT NULL;

COMMENT ON COLUMN nex_product.sku IS
  'Merchant-defined product code · ≤50 · [A-Za-z0-9._-] · case-insensitive unique per business · optional.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '030',
    'nex_product.sku · optional merchant SKU · pattern-checked · unique per business (case-insensitive)',
    'Wave B Slice 6f · Founder-authorised keypad build 2026-09-24 · Products capability polish.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
