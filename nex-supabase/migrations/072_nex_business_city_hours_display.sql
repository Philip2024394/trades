-- ============================================================================
-- NEX-native Migration 072 · Bridge 16e · City + display hours
-- ============================================================================
--
-- Adds two seller-facing profile columns:
--
--   nex_business.city          · single-line free-text city name
--                                 (Bandung, Jakarta Selatan, Ubud, etc.).
--                                 Cheap to display everywhere · directory
--                                 facet + About panel + landing hero.
--
--   nex_business.hours_display · single-line free-text opening hours
--                                 exactly as the seller wants to say it
--                                 ("Mon-Sat 9am-6pm · closed Sunday" etc.).
--                                 The existing nex_business.hours JSONB
--                                 remains available for structured
--                                 weekly-hours pickers · this column is
--                                 the human-readable version buyers see
--                                 on the About panel.
--
-- Both are optional · sellers can leave them blank and the UI just hides
-- the row. Founder direction 2026-09-28: collect during shop creation
-- and expose on the About page.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '072';
--     ALTER TABLE nex_business
--       DROP COLUMN IF EXISTS city,
--       DROP COLUMN IF EXISTS hours_display;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS city text
    CHECK (city IS NULL OR (length(trim(city)) BETWEEN 1 AND 80));

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS hours_display text
    CHECK (hours_display IS NULL OR length(hours_display) <= 200);

COMMENT ON COLUMN nex_business.city IS
  'Human-readable city / neighbourhood for the shop. Optional · single
   line · 1-80 chars when set. Sealed 2026-09-28 · Bridge 16e.';

COMMENT ON COLUMN nex_business.hours_display IS
  'Free-text opening hours as the seller wants to state them ·
   "Mon-Sat 9am-6pm · closed Sunday". Optional · 0-200 chars.
   Sealed 2026-09-28 · Bridge 16e. Structured weekly-hours JSONB
   lives on nex_business.hours for future picker UIs.';

CREATE INDEX IF NOT EXISTS idx_nex_business_city
  ON nex_business (lower(city))
  WHERE city IS NOT NULL;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '072',
    'Bridge 16e · nex_business.city + hours_display · About-panel signal',
    'Founder-authorised 2026-09-28. Optional text columns collected on shop create and editable via /manage/shop. Structured hours JSONB stays available for future picker UIs.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_business' AND column_name IN ('city','hours_display');
