-- ============================================================================
-- NEX-native Migration 100 · Bridge 98 · nex_business.cover_layout_id
-- ============================================================================
--
-- Founder-sealed 2026-09-30 · ONE NEX IDENTITY doctrine.
--
-- Adds `cover_layout_id` to nex_business so a seller can pick which of the
-- 10 sealed cover layouts renders on their public shop-window page:
--
--   /nex-native/{businessSlug}
--
-- The LAYOUT provides information architecture. The THEME (nex_chat_theme
-- via nex_account.chat_theme) provides visual identity. The owner's
-- CONTENT provides personality. Together they compose the NEX cover —
-- never a "website template."
--
-- Valid layout ids (Founder-sealed):
--   restaurant · cafe · product · tradesperson · salon ·
--   creator · fashion · street_food · premium_business · personal_brand
--
-- NULL = keep the existing shared /nex-native/[businessSlug] layout.
-- Existing businesses default to NULL · zero regression.
--
-- Applied via scripts/apply-nex-migration-100.mjs or psql.
--
-- Rollback (never in production):
--   BEGIN;
--     ALTER TABLE nex_business
--       DROP CONSTRAINT IF EXISTS nex_business_cover_layout_known,
--       DROP COLUMN IF EXISTS cover_layout_id;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS cover_layout_id text;

ALTER TABLE nex_business
  DROP CONSTRAINT IF EXISTS nex_business_cover_layout_known;

ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_cover_layout_known
    CHECK (
      cover_layout_id IS NULL
      OR cover_layout_id IN (
        'restaurant',
        'cafe',
        'product',
        'tradesperson',
        'salon',
        'creator',
        'fashion',
        'street_food',
        'premium_business',
        'personal_brand'
      )
    );

COMMENT ON COLUMN nex_business.cover_layout_id IS
  'Cover-layout choice · one of 10 Founder-sealed layouts (Bridge 98).
   NULL = existing shared /[businessSlug] layout (backwards compatible).
   Layout provides IA. Theme (via nex_account.chat_theme) provides visual
   identity. Never a website template.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '100',
    'Bridge 98 · nex_business.cover_layout_id · sealed 2026-09-30',
    'Adds optional cover_layout_id per business · Founder-sealed 10 valid ids · doctrine ONE NEX IDENTITY · layout provides IA, theme provides visual identity.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
