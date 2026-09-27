-- ============================================================================
-- NEX-native Migration 069 · Bridge 16b · Safe-trade consent timestamp
-- ============================================================================
--
-- Adds `safe_trade_consent_at timestamptz` to nex_account so we can
-- record when a buyer/seller acknowledged the safe-trade doctrine +
-- terms. NEX shows a JIT modal the first time a user is about to
-- enter a commerce interaction (open a chat with a seller who owns
-- a business) and stamps this column on Accept.
--
-- Purpose: **legal defensibility**. If a user later complains that
-- they were scammed using an off-doctrine payment path (direct bank
-- transfer to seller before delivery), NEX support can point at this
-- timestamp and say "you acknowledged the terms on <date> · here is
-- what you agreed to". This shifts the responsibility for choosing
-- an unsafe path onto the user, not NEX.
--
-- Doctrine reference: doctrine_nex_never_handles_payments_2026_09_28
--
-- Also stores a hash of the terms version acknowledged so we know
-- WHICH set of terms they agreed to · when the terms materially
-- change we can re-prompt.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '069';
--     ALTER TABLE nex_account DROP COLUMN IF EXISTS safe_trade_consent_at;
--     ALTER TABLE nex_account DROP COLUMN IF EXISTS safe_trade_consent_version;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS safe_trade_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS safe_trade_consent_version text;

COMMENT ON COLUMN nex_account.safe_trade_consent_at IS
  'When the user acknowledged the NEX safe-trade terms via the JIT modal.
   NULL means they haven''t seen it yet · JIT modal fires the first time
   they enter a commerce chat. Sealed 2026-09-28 · Bridge 16b.';

COMMENT ON COLUMN nex_account.safe_trade_consent_version IS
  'The terms version string they acknowledged. Format YYYY-MM-DD (matches
   the doctrine seal date). When the version changes materially, we can
   re-prompt users whose version < current.';

CREATE INDEX IF NOT EXISTS idx_nex_account_safe_trade_consent
  ON nex_account (safe_trade_consent_at);

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '069',
    'Bridge 16b · nex_account.safe_trade_consent_at + safe_trade_consent_version for JIT terms modal',
    'Founder-authorised 2026-09-28. Records when a user acknowledged the safe-trade doctrine + terms. Legal defensibility: users can''t claim they were never warned about off-doctrine payment risks. JIT modal fires on first commerce-chat entry.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_account'
--      AND column_name IN ('safe_trade_consent_at', 'safe_trade_consent_version');
