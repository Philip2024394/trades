-- ============================================================================
-- NEX-native Migration 016 · nex_product.gallery_urls · additional images
-- ============================================================================
--
-- Purpose:
--   Add a nullable text[] column for gallery / secondary product images.
--   The single primary image lives on `image_url` (migration 015). Gallery
--   is an OPTIONAL array of extra images shown alongside the primary.
--
-- Doctrine:
--   · Anti-fabrication · nullable · no placeholder gallery invented
--   · Storage-layer size guard: array length ≤ 10 (defence-in-depth; the
--     service layer enforces per-URL length + http(s) prefix)
--   · File-upload storage backend remains deferred · URLs are external
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '016';
--     ALTER TABLE nex_product DROP CONSTRAINT IF EXISTS nex_product_gallery_urls_size;
--     ALTER TABLE nex_product DROP COLUMN IF EXISTS gallery_urls;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_product
  ADD COLUMN IF NOT EXISTS gallery_urls text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_product_gallery_urls_size'
       AND conrelid = 'nex_product'::regclass
  ) THEN
    ALTER TABLE nex_product
      ADD CONSTRAINT nex_product_gallery_urls_size CHECK (
        gallery_urls IS NULL OR array_length(gallery_urls, 1) <= 10
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_product.gallery_urls IS
  'Optional array of additional product image URLs · nullable · max 10 entries (DB CHECK) · per-URL http(s) prefix + 1024 char cap enforced app-side.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '016',
    'nex_product.gallery_urls · nullable text[] · max 10 entries',
    'Wave A Slice 6b · Founder-authorised keypad build 2026-09-24. Optional gallery alongside primary image_url from migration 015. File-upload storage backend still deferred.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'nex_product' AND column_name = 'gallery_urls';
--     -- expect: gallery_urls · ARRAY (text[])
--
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_product'::regclass
--      AND conname = 'nex_product_gallery_urls_size';
--     -- expect: 1 row
-- ============================================================================
