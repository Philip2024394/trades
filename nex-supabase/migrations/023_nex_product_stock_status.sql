-- ============================================================================
-- NEX-native Migration 023 · nex_product.stock_status
-- ============================================================================
--
-- Purpose:
--   Wave B Slice 6e · give buyers a quick stock signal on each product.
--   Four possible values:
--     · in_stock       · ready to ship / fulfil immediately
--     · low_stock      · limited stock warning
--     · made_to_order  · will be produced after purchase
--     · sold_out       · currently unavailable
--   Nullable · null means "no signal" · buyer sees no badge.
--
-- Doctrine:
--   · Anti-fabrication · nullable · null = no claim
--   · CHECK-constrained to a known set · adding a value requires a new migration
--   · Independent of nex_product.status (draft/live/archived) which governs
--     visibility. stock_status governs availability once visible.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '023';
--     ALTER TABLE nex_product DROP CONSTRAINT IF EXISTS nex_product_stock_status_known;
--     ALTER TABLE nex_product DROP COLUMN IF EXISTS stock_status;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_product
  ADD COLUMN IF NOT EXISTS stock_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_product_stock_status_known'
       AND conrelid = 'nex_product'::regclass
  ) THEN
    ALTER TABLE nex_product
      ADD CONSTRAINT nex_product_stock_status_known CHECK (
        stock_status IS NULL
        OR stock_status IN ('in_stock', 'low_stock', 'made_to_order', 'sold_out')
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_product.stock_status IS
  'Optional stock signal to buyers · nullable (null = no claim) · CHECK against 4 known values · adding a value requires a new migration.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '023',
    'nex_product.stock_status · nullable · CHECK against 4 known values',
    'Wave B Slice 6e · Founder-authorised keypad build 2026-09-24. Independent of nex_product.status (visibility vs availability).'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_product' AND column_name = 'stock_status';
--     -- expect: 1 row
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'nex_product'::regclass
--      AND conname = 'nex_product_stock_status_known';
--     -- expect: CHECK containing all 4 values
-- ============================================================================
