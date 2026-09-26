-- ============================================================================
-- NEX-native Migration 017 · nex_product.tags · slug-style discovery tags
-- ============================================================================
--
-- Purpose:
--   Add a nullable text[] column for slug-style product tags. Enables
--   future NEX Discovery (per keypad constitution) to surface products by
--   category / material / style / trade without needing a separate
--   taxonomy table on day one.
--
-- Doctrine:
--   · Anti-fabrication · nullable · no invented tags
--   · Slug-style tokens only: lowercase alphanumeric + hyphens · 1..40 chars
--     · normalisation + pattern enforced app-side · storage-layer size
--     guard: array length ≤ 20 (DB CHECK)
--   · No cross-tenant coupling · these are per-product labels · NOT a
--     shared taxonomy
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '017';
--     ALTER TABLE nex_product DROP CONSTRAINT IF EXISTS nex_product_tags_size;
--     ALTER TABLE nex_product DROP COLUMN IF EXISTS tags;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_product
  ADD COLUMN IF NOT EXISTS tags text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_product_tags_size'
       AND conrelid = 'nex_product'::regclass
  ) THEN
    ALTER TABLE nex_product
      ADD CONSTRAINT nex_product_tags_size CHECK (
        tags IS NULL OR array_length(tags, 1) <= 20
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_product.tags IS
  'Optional array of slug-style product tags · nullable · max 20 entries (DB CHECK) · per-tag pattern (^[a-z0-9]([-a-z0-9]{0,38}[a-z0-9])?$) + 40 char cap enforced app-side · dedup case-insensitive at service layer.';

CREATE INDEX IF NOT EXISTS idx_nex_product_tags_gin
  ON nex_product USING gin (tags)
  WHERE tags IS NOT NULL;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '017',
    'nex_product.tags · nullable text[] · max 20 entries · GIN index',
    'Wave A Slice 6d · Founder-authorised keypad build 2026-09-24. Foundation for NEX Discovery keypad capability. Slug-style tokens only · normalised app-side. Partial GIN index on non-null arrays for future @> containment queries.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'nex_product' AND column_name = 'tags';
--     -- expect: tags · ARRAY (text[])
--
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_product'::regclass
--      AND conname = 'nex_product_tags_size';
--     -- expect: 1 row
--
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'nex_product' AND indexname = 'idx_nex_product_tags_gin';
--     -- expect: 1 row
-- ============================================================================
