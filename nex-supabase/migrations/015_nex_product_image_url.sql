-- ============================================================================
-- NEX-native Migration 015 · nex_product.image_url · single primary image URL
-- ============================================================================
--
-- Purpose:
--   Add a nullable image_url column so merchants can attach a primary image
--   to each product. Mirrors nex_business.logo_url pattern from migration 014:
--   accept an external URL (validated app-side for http/https prefix), defer
--   file-upload storage backend decisions to a later slice. A gallery /
--   multiple-images slice can layer on top without changing this column.
--
-- Doctrine:
--   · Anti-fabrication · nullable · no placeholder image invented
--   · No third-party image copy (ADR-0022) is a POLICY, not a schema
--     concern · this column simply stores whatever URL the merchant
--     provides
--   · CHECK: length ≤ 1024
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '015';
--     ALTER TABLE nex_product DROP COLUMN IF EXISTS image_url;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_product
  ADD COLUMN IF NOT EXISTS image_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_product_image_url_length'
       AND conrelid = 'nex_product'::regclass
  ) THEN
    ALTER TABLE nex_product
      ADD CONSTRAINT nex_product_image_url_length CHECK (
        image_url IS NULL OR char_length(image_url) <= 1024
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_product.image_url IS
  'Primary product image URL · nullable · validated app-side for http/https prefix · gallery/multi-image reserved for a later slice.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '015',
    'nex_product.image_url · nullable text · 1024 char cap',
    'Wave A Slice 6a · Founder-authorised keypad build 2026-09-24. Single primary image URL matching business.logo_url pattern. File-upload storage backend deferred.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_product' AND column_name = 'image_url';
--     -- expect: image_url · text · YES
--
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_product'::regclass
--      AND conname = 'nex_product_image_url_length';
--     -- expect: 1 row
-- ============================================================================
