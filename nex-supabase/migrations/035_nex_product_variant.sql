-- ============================================================================
-- NEX-native Migration 035 · nex_product_variant · MVP variants
-- ============================================================================
-- Wave B Slice 6c · optional per-product variants (e.g. "Size M", "Black").
-- Scope kept intentionally small:
--   · name (required, 1..200)
--   · price_pence override (nullable · null means "use parent product price")
--   · position (integer sort key · default 0)
--   · CASCADE with parent product (delete parent → drop variants)
--
-- Deferred to future slices:
--   · per-variant SKU (would require joint unique index across product+variant
--     to preserve per-business SKU uniqueness)
--   · per-variant stock status
--   · order references to a specific variant (orders still reference the
--     top-level product · this slice is display-only)
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '035';
--     DROP TABLE IF EXISTS nex_product_variant;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_product_variant (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES nex_product(id) ON DELETE CASCADE,
  name        text NOT NULL,
  price_pence bigint,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_product_variant_name_length CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT nex_product_variant_price_nonneg CHECK (price_pence IS NULL OR price_pence >= 0)
);

COMMENT ON TABLE nex_product_variant IS
  'Optional variants per nex_product · MVP scope: name + price override + position · CASCADE with parent product · orders still reference the top-level product in this slice.';

CREATE INDEX IF NOT EXISTS idx_nex_product_variant_product
  ON nex_product_variant (product_id, position ASC, created_at ASC);

-- Reuse updated_at trigger from migration 002
DROP TRIGGER IF EXISTS nex_product_variant_touch ON nex_product_variant;
CREATE TRIGGER nex_product_variant_touch
  BEFORE UPDATE ON nex_product_variant
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

ALTER TABLE nex_product_variant ENABLE ROW LEVEL SECURITY;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '035',
    'nex_product_variant · MVP variants · name + price override + position · CASCADE product',
    'Wave B Slice 6c · display-only in this slice · orders still reference parent product.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
