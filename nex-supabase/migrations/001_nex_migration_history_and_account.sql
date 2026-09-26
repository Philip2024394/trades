-- ============================================================================
-- NEX-native Migration 001 · nex_migration_history + nex_account
-- ============================================================================
--
-- Purpose:
--   Bootstrap the NEX-native schema. Creates:
--     (a) nex_migration_history · authoritative record of applied migrations
--     (b) nex_account · identity anchor referenced by every downstream table
--
-- Doctrine:
--   · project_nex_identity_doctrine_phone_is_credential_not_identity_system_2026_09_23
--     nex_account.id (UUID) is the identity anchor. supabase_user_id is a
--     credential-link only. email/phone are attributes, never relationship keys.
--   · project_nex_reframed_wave_2_native_foundation_storage_audit_2026_09_24
--     NEX-native · clean slate · no legacy dependencies.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '001';
--     DROP TABLE IF EXISTS nex_account;
--     DROP TABLE IF EXISTS nex_migration_history;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. nex_migration_history
-- ---------------------------------------------------------------------------
-- Every applied migration inserts a row here on success. Provides
-- authoritative NEX-native migration history separate from any legacy
-- Supabase schema_migrations tracking.

CREATE TABLE IF NOT EXISTS nex_migration_history (
  version       text PRIMARY KEY,
  applied_at    timestamptz NOT NULL DEFAULT now(),
  description   text NOT NULL,
  notes         text
);

COMMENT ON TABLE nex_migration_history IS
  'Authoritative record of NEX-native migrations applied to this database. Sequential version numbers (001, 002, ...). Never mutated after insert.';

-- ---------------------------------------------------------------------------
-- 2. nex_account
-- ---------------------------------------------------------------------------
-- The NEX identity anchor. Every downstream table (business, product,
-- conversation, message, order, ledger, ...) references nex_account.id via
-- UUID FK. Phone/email/WhatsApp are NEVER relationship keys · they may
-- appear as credential inputs at signup (see supabase_user_id linkage) or
-- as private contact attributes but never as FKs.

CREATE TABLE IF NOT EXISTS nex_account (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id    uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Nullable: anonymous NEX accounts allowed at future date. When set,
    -- authenticates the account via Supabase auth. Never used as a
    -- relationship key downstream · downstream FKs always reference
    -- nex_account.id.
  display_name        text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_account IS
  'NEX identity anchor. Every downstream NEX-native table references this via UUID FK. Phone/email are attributes only · never relationship keys (per Identity Doctrine 2026-09-23).';

COMMENT ON COLUMN nex_account.id IS
  'Primary NEX identity UUID. This is what downstream tables FK to.';

COMMENT ON COLUMN nex_account.supabase_user_id IS
  'Optional link to auth.users for authenticated accounts. Nullable to allow future anonymous accounts. NEVER treat as the NEX identity · nex_account.id is the anchor.';

CREATE INDEX IF NOT EXISTS idx_nex_account_supabase_user_id
  ON nex_account (supabase_user_id)
  WHERE supabase_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. RLS · self-only reads
-- ---------------------------------------------------------------------------
-- Service-role bypasses RLS naturally (Supabase pattern). Authenticated
-- users can read their own nex_account row only. No public read.

ALTER TABLE nex_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_migration_history ENABLE ROW LEVEL SECURITY;

-- nex_account · self read
CREATE POLICY nex_account_self_read
  ON nex_account
  FOR SELECT
  TO authenticated
  USING (supabase_user_id = auth.uid());

-- nex_migration_history · service-role only (no policy for authenticated
-- means authenticated users get no rows · which is correct · this table
-- is internal accounting)
-- Intentionally no CREATE POLICY here.

-- ---------------------------------------------------------------------------
-- 4. Record this migration
-- ---------------------------------------------------------------------------
INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '001',
  'Bootstrap · nex_migration_history + nex_account',
  'Wave 2 NEX-Native Foundation · Founder-authored directive 2026-09-24. First migration on the clean-slate NEX Supabase project.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification (run these · not part of migration):
--
--   SELECT * FROM nex_migration_history WHERE version = '001';
--     -- expect: 1 row · description=Bootstrap...
--
--   SELECT count(*) FROM nex_account;
--     -- expect: 0
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--     WHERE table_name = 'nex_account' ORDER BY ordinal_position;
--     -- expect: id/uuid/NO · supabase_user_id/uuid/YES · display_name/text/NO
--     --         created_at/timestamptz/NO
--
--   SELECT policyname FROM pg_policies WHERE tablename = 'nex_account';
--     -- expect: nex_account_self_read
-- ============================================================================
