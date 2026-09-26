-- ============================================================================
-- NEX-native Migration 028 · nex_banner · Social Banner MVP
-- ============================================================================
--
-- Purpose:
--   Wave B Slice 12a · opens the "Social Banner" sealed keypad capability.
--   A banner is a short marketing card owned by a business · optionally
--   tied to one of that business's products. Text-only MVP · no image
--   composition · palette selects the visual treatment on the public
--   page. Later slices can layer on image generation + share-to-external.
--
--   Schema decisions:
--     · id           · UUID primary key (matches other NEX-native tables)
--     · business_id  · FK to nex_business(id) ON DELETE CASCADE (banner
--                      dies with the business)
--     · product_id   · FK to nex_product(id) ON DELETE SET NULL (product
--                      going archived doesn't wipe the banner · orphaning
--                      converts it to a "generic business banner")
--     · headline     · required · ≤ 80 chars
--     · subline      · optional · ≤ 160 chars
--     · palette      · CHECK IN ('ink','blush','gold','night','ivory')
--                      · default 'ink' (neutral)
--     · status       · CHECK IN ('draft','live','archived') · default 'draft'
--     · created_at + updated_at with touch trigger
--
-- Doctrine references:
--   · doctrine_nex_identity_and_capability_constitution_2026_09_24 Lock 2
--       Capability 4 "Social Banner" · product-connected (nullable) ·
--       shareable · NOT a generic image editor
--   · Anti-fabrication · nullable fields default null · never invented
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '028';
--     DROP TABLE IF EXISTS nex_banner;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_banner (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES nex_product(id) ON DELETE SET NULL,
  headline     text NOT NULL,
  subline      text,
  palette      text NOT NULL DEFAULT 'ink',
  status       text NOT NULL DEFAULT 'draft',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_banner_headline_length CHECK (char_length(headline) BETWEEN 1 AND 80),
  CONSTRAINT nex_banner_subline_length  CHECK (subline IS NULL OR char_length(subline) <= 160),
  CONSTRAINT nex_banner_palette_known   CHECK (palette IN ('ink','blush','gold','night','ivory')),
  CONSTRAINT nex_banner_status_known    CHECK (status  IN ('draft','live','archived'))
);

COMMENT ON TABLE nex_banner IS
  'Social Banner (sealed keypad capability #4) · text-only MVP · owner via business_id · optional product tie via product_id (SET NULL on product delete) · palette + status enums.';

CREATE INDEX IF NOT EXISTS idx_nex_banner_business
  ON nex_banner (business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_banner_live
  ON nex_banner (business_id, updated_at DESC)
  WHERE status = 'live';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'nex_touch_updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_nex_banner_touch_updated_at ON nex_banner';
    EXECUTE 'CREATE TRIGGER trg_nex_banner_touch_updated_at
             BEFORE UPDATE ON nex_banner
             FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at()';
  END IF;
END $$;

ALTER TABLE nex_banner ENABLE ROW LEVEL SECURITY;
-- Service-role only for now · authenticated policies land when the manage UI ships.

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '028',
    'nex_banner · Social Banner MVP · palette/status enums · optional product FK SET NULL',
    'Wave B Slice 12a · Founder-authorised keypad build 2026-09-24. Text-only · no image composition. Image workflow arrives in a later slice.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply:
--   SELECT tablename FROM pg_tables WHERE tablename = 'nex_banner';
--   SELECT conname FROM pg_constraint WHERE conrelid = 'nex_banner'::regclass;
