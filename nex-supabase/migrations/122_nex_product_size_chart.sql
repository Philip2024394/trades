-- ============================================================================
-- NEX-native Migration 122 · nex_product.size_chart_url
-- ============================================================================
--
-- Sealed 2026-10-01 · Phase 1 of Shoppe-grade variant input.
--
-- Adds a nullable size_chart_url column so sellers can attach their own
-- size chart image (jpg/png/webp) alongside size-attributed variants.
-- The seller uploads via uploadSizeChartAction (reuses the onboarding
-- storage helper); the public URL lands on this column. Buyers see a
-- "Size chart" link on the product detail that opens the image in a
-- lightbox.
--
--  · Nullable · most products don't need a size chart
--  · Text (URL string · validated app-side as a public storage URL)
--  · No new table · just a column on nex_product
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '122';
--     ALTER TABLE nex_product DROP COLUMN IF EXISTS size_chart_url;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_product
  ADD COLUMN IF NOT EXISTS size_chart_url text;

COMMENT ON COLUMN nex_product.size_chart_url IS
  'Optional seller-uploaded size chart image URL (public storage). Shown as a "Size chart" link on the product detail when the product carries size-attributed variants. Sealed 2026-10-01 · Phase 1 Shoppe-grade variants.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '122',
    'nex_product.size_chart_url · optional seller-uploaded size chart image',
    'Phase 1 of Shoppe-grade variant input. Nullable text column holding a public storage URL. Buyers see "Size chart" link on product detail when set.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_product' AND column_name = 'size_chart_url';
