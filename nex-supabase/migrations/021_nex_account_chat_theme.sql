-- ============================================================================
-- NEX-native Migration 021 · nex_account.chat_theme · sealed Theme doctrine
-- ============================================================================
--
-- Purpose:
--   Wave B Slice 7a · first cut of the "Chat Theme" keypad capability.
--   Persists a merchant / customer chosen theme identifier as an ACCOUNT
--   preference on nex_account (per sealed doctrine · never URL parameter ·
--   survives reload / sign-out / sign-in).
--
--   Adds a nullable text column with a CHECK against 5 initial theme IDs.
--   Adding a new theme = adding to the CHECK in a subsequent migration.
--
-- Doctrine references:
--   · doctrine_nex_identity_and_capability_constitution_2026_09_24
--     Lock 2 · Capability 5 "Chat Theme" · persisted as account preference ·
--     survives reload/sign-out/sign-in · NOT URL parameter state
--   · Anti-fabrication · nullable · null means "use default" · not "invented
--     preference"
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '021';
--     ALTER TABLE nex_account DROP CONSTRAINT IF EXISTS nex_account_chat_theme_known;
--     ALTER TABLE nex_account DROP COLUMN IF EXISTS chat_theme;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS chat_theme text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_account_chat_theme_known'
       AND conrelid = 'nex_account'::regclass
  ) THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_chat_theme_known CHECK (
        chat_theme IS NULL
        OR chat_theme IN ('default', 'titanium', 'pink', 'gold', 'night')
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_account.chat_theme IS
  'Account-scoped chat theme id · nullable (null = default) · CHECK-constrained to a known set · persisted preference per sealed capability doctrine · never URL parameter state.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '021',
    'nex_account.chat_theme · account-scoped theme preference · CHECK against 5 known IDs',
    'Wave B Slice 7a · Founder-authorised keypad build 2026-09-24. Opens the Chat Theme keypad capability. Adding a new theme = new migration to extend the CHECK.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_account' AND column_name = 'chat_theme';
--     -- expect: chat_theme · text · YES
--
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_account'::regclass
--      AND conname = 'nex_account_chat_theme_known';
--     -- expect: 1 row
--
--   -- All existing rows have NULL by default
--   SELECT count(*) FROM nex_account WHERE chat_theme IS NOT NULL;
--     -- expect: 0
-- ============================================================================
