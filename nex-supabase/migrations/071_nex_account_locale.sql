-- ============================================================================
-- NEX-native Migration 071 · Bridge 16d · Account locale preference
-- ============================================================================
--
-- Adds `nex_account.locale text` so users can persist their language
-- choice. Bridge 16c introduced request-time locale resolution via
-- URL param + Accept-Language header · this migration adds the third
-- resolution layer: the user's stored preference.
--
-- Locale precedence (highest wins):
--   1. URL ?lang=id|en  · explicit override
--   2. nex_account.locale  · signed-in user's preference
--   3. Accept-Language header  · browser hint
--   4. 'id'  · pilot-market default (Indonesian)
--
-- Locale values are the same two-letter tags used in
-- i18n/safe-trade-strings.ts · 'id' (Bahasa Indonesia) or 'en'
-- (English). More languages queued when we expand markets.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '071';
--     ALTER TABLE nex_account DROP COLUMN IF EXISTS locale;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS locale text
    CHECK (locale IN ('id', 'en'));

COMMENT ON COLUMN nex_account.locale IS
  'Persisted user locale preference · id (Bahasa Indonesia) or en
   (English). NULL means "no preference" · resolveLocale() falls
   back to Accept-Language + market default. Sealed 2026-09-28 ·
   Bridge 16d.';

CREATE INDEX IF NOT EXISTS idx_nex_account_locale
  ON nex_account (locale)
  WHERE locale IS NOT NULL;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '071',
    'Bridge 16d · nex_account.locale for persisted language preference',
    'Founder-authorised 2026-09-28. Values id | en. Falls back to header + Indonesian market default when NULL. Updated via updateAccountLocaleAction from /settings.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_account' AND column_name = 'locale';
