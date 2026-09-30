-- ============================================================================
-- NEX-native Migration 109 · nex_business.info_pages
-- ============================================================================
--
-- Purpose:
--   Persist the seller's answers to the "curiosity questions" that surface
--   from the cover-composer + button (About / Delivery / Custom orders /
--   Services scope / seller-added custom buttons).
--
-- Founder direction 2026-09-30:
--   Every cover MUST have a way to surface About Us + delivery specifics +
--   custom orders. Existing columns already carry a bunch of this (see
--   src/lib/nex-native/info-pages-service.ts INFO_PAGE_SOURCES for the
--   full map) — this migration adds a single nullable jsonb blob for the
--   handful of new free-text answers + up to 3 seller-defined custom
--   buttons. One column keeps the schema tidy and the blob edits atomic.
--
-- Shape (validated at service layer, not in Postgres):
--
--   {
--     "delivery_details": "text · 0-400 chars",
--     "custom_orders":    "text · 0-400 chars",
--     "services_scope":   "text · 0-400 chars",
--     "custom_buttons": [
--       {
--         "icon":         "one of the 30 curated emoji glyphs",
--         "label":        "1-24 chars",
--         "body":         "0-400 chars",
--         "image_url":    "https:// or null",
--         "external_url": "https:// or null"
--       },
--       ...max 3
--     ]
--   }
--
-- NULL = no info-pages set. Cover renders only the sealed buttons whose
-- backing data (description / accepted_payment_methods / return_policy /
-- events_profile / venue_gallery / hours_display) is populated.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '109';
--     ALTER TABLE nex_business DROP COLUMN IF EXISTS info_pages;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS info_pages jsonb;

COMMENT ON COLUMN nex_business.info_pages IS
  'Seller-authored free-text answers + custom buttons that back the cover-composer + info tray. Nullable · shape validated in src/lib/nex-native/info-pages-service.ts. Sealed 2026-09-30.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '109',
    'nex_business.info_pages jsonb · seller-authored info tray content',
    'Founder-authorised 2026-09-30. Backs the cover-composer + info tray. Shape validated at service layer · max 3 custom buttons · curated icon set · 24/400 char caps.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'nex_business' AND column_name = 'info_pages';
