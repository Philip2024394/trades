-- ============================================================================
-- NEX-native Migration 024 · nex_account.phone_country_code + phone_national_number
-- ============================================================================
--
-- Purpose:
--   Wave B Slice 1b · Founder directive 2026-09-24 "email phone number with
--   country prefix and password - with password confirm twice". Collect
--   phone at signup as a credential attribute · NEVER as a relationship key.
--
--   Two fields:
--     · phone_country_code · text · e.g. '+44' · shape ^\+[0-9]{1,4}$
--     · phone_national_number · text · digits only · 5..15 chars
--
--   Both nullable · so historical accounts and future anonymous accounts
--   can exist without phone.
--
-- Doctrine references:
--   · doctrine_nex_identity_and_capability_constitution_2026_09_24 Lock 1:
--       "Phone number may be used at registration where required, but MUST
--        NOT become the core NEX identity."
--       "Do NOT redesign core NEX relationships around phone numbers."
--   · Identity Doctrine 2026-09-23: phone/email are ATTRIBUTES · NEVER
--     relationship keys · nex_account.id UUID remains the anchor · public
--     nex_handle remains the display identity.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '024';
--     ALTER TABLE nex_account DROP CONSTRAINT IF EXISTS nex_account_phone_country_code_shape;
--     ALTER TABLE nex_account DROP CONSTRAINT IF EXISTS nex_account_phone_national_number_shape;
--     ALTER TABLE nex_account DROP COLUMN IF EXISTS phone_country_code;
--     ALTER TABLE nex_account DROP COLUMN IF EXISTS phone_national_number;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS phone_country_code   text,
  ADD COLUMN IF NOT EXISTS phone_national_number text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_account_phone_country_code_shape'
       AND conrelid = 'nex_account'::regclass
  ) THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_phone_country_code_shape CHECK (
        phone_country_code IS NULL
        OR phone_country_code ~ '^\+[0-9]{1,4}$'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_account_phone_national_number_shape'
       AND conrelid = 'nex_account'::regclass
  ) THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_phone_national_number_shape CHECK (
        phone_national_number IS NULL
        OR phone_national_number ~ '^[0-9]{5,15}$'
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_account.phone_country_code IS
  'Optional signup credential · country calling code with leading + (e.g. +44) · ATTRIBUTE only · never a relationship key · Identity Doctrine sealed.';
COMMENT ON COLUMN nex_account.phone_national_number IS
  'Optional signup credential · national digits only (no spaces / dashes / brackets) · 5-15 chars · ATTRIBUTE only.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '024',
    'nex_account · phone_country_code + phone_national_number · shape CHECKs',
    'Wave B Slice 1b · Founder directive 2026-09-24. Phone collected at signup as ATTRIBUTE · never a relationship key. UUID id + nex_handle remain the identity anchors.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_account'
--      AND column_name IN ('phone_country_code', 'phone_national_number');
--     -- expect: 2 rows
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_account'::regclass
--      AND conname IN ('nex_account_phone_country_code_shape',
--                       'nex_account_phone_national_number_shape');
--     -- expect: 2 rows
-- ============================================================================
