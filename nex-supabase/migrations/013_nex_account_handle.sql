-- ============================================================================
-- NEX-native Migration 013 · nex_account.nex_handle · public NEX identity handle
-- ============================================================================
--
-- Purpose:
--   Add the sealed NEX public identity handle (nex-XXXXX form · e.g. nex-36474)
--   to nex_account. Downstream services keep FKing to nex_account.id (UUID),
--   which remains the authoritative internal identifier. The handle is a
--   human-readable public identity string used for display · sharing · public
--   URLs · attribution · commerce trails.
--
--   Adds:
--     (a) nex_handle_counter · single-row sequential counter
--     (b) nex_account.nex_handle text UNIQUE · nullable initially · CHECK format
--     (c) nex_allocate_handle(account_id) SECURITY DEFINER atomic allocator
--     (d) Backfill existing accounts
--     (e) idx_nex_account_nex_handle (partial · WHERE NOT NULL)
--
-- Doctrine references:
--   · doctrine_nex_identity_and_capability_constitution_2026_09_24
--       Lock 1 · Public person identity: nex-XXXXX handle · permanent ·
--       used for users · conversations · friends · attribution · commerce.
--       Internal technical identity: UUID/account identifier as required by
--       persistence + auth architecture · UUID is a technical implementation
--       detail · not a public identity.
--   · project_nex_identity_doctrine_phone_is_credential_not_identity_system_2026_09_23
--       Phone/email never become the identity. Handles are the public layer
--       ABOVE the UUID anchor · they DO NOT replace nex_account.id as the
--       relationship key.
--
-- Non-doctrine:
--   · Handle format: nex-<digits> · minimum 5 digits · unbounded upper.
--     Counter starts at 10000 so the smallest handle is nex-10000 · matches
--     the doctrine's nex-36474-style example.
--   · Sequential allocation via a locked single-row counter · guaranteed
--     unique · no collisions.
--   · The allocator is idempotent · a second call for the same account
--     returns the existing handle without touching the counter.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '013';
--     DROP FUNCTION IF EXISTS nex_allocate_handle(uuid);
--     ALTER TABLE nex_account DROP CONSTRAINT IF EXISTS nex_account_handle_format;
--     DROP INDEX IF EXISTS idx_nex_account_nex_handle;
--     ALTER TABLE nex_account DROP COLUMN IF EXISTS nex_handle;
--     DROP TABLE IF EXISTS nex_handle_counter;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Counter table · single row · locked during allocation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_handle_counter (
  id           int  PRIMARY KEY DEFAULT 1,
  next_value   bigint NOT NULL DEFAULT 10000,
  CHECK (id = 1)
);

COMMENT ON TABLE nex_handle_counter IS
  'Single-row sequential counter for nex_account.nex_handle allocation. Row is locked during nex_allocate_handle · guaranteeing collision-free sequential handles.';

INSERT INTO nex_handle_counter (id, next_value)
  VALUES (1, 10000)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE nex_handle_counter ENABLE ROW LEVEL SECURITY;
-- Service-role only. No policies for authenticated · this table is internal.

-- ---------------------------------------------------------------------------
-- 2. nex_account.nex_handle · nullable UNIQUE with format CHECK
-- ---------------------------------------------------------------------------
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS nex_handle text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_account_nex_handle_key'
       AND conrelid = 'nex_account'::regclass
  ) THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_nex_handle_key UNIQUE (nex_handle);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_account_handle_format'
       AND conrelid = 'nex_account'::regclass
  ) THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_handle_format
      CHECK (nex_handle IS NULL OR nex_handle ~ '^nex-[0-9]{5,}$');
  END IF;
END $$;

COMMENT ON COLUMN nex_account.nex_handle IS
  'Public NEX identity handle (nex-XXXXX form · e.g. nex-36474). Permanent · unique · human-readable · used for display / sharing / attribution / commerce. The UUID nex_account.id remains the internal relationship key. Nullable in schema so historical rows and provisioning flows do not fail atomically · allocated via nex_allocate_handle().';

CREATE INDEX IF NOT EXISTS idx_nex_account_nex_handle
  ON nex_account (nex_handle)
  WHERE nex_handle IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. nex_allocate_handle · atomic allocator · SECURITY DEFINER · idempotent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION nex_allocate_handle(p_account_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing  text;
  v_counter   bigint;
  v_candidate text;
BEGIN
  -- Idempotency · if account already has a handle · return it and DO NOT
  -- touch the counter.
  SELECT nex_handle INTO v_existing
    FROM nex_account
   WHERE id = p_account_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Sanity · account must exist. Never fabricate.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'nex_allocate_handle: nex_account % not found', p_account_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Atomic bump + read of the counter. UPDATE ... RETURNING captures the
  -- pre-increment value we should hand out. Row lock serialises concurrent
  -- callers.
  LOOP
    UPDATE nex_handle_counter
       SET next_value = next_value + 1
     WHERE id = 1
    RETURNING (next_value - 1) INTO v_counter;

    v_candidate := 'nex-' || v_counter::text;

    -- Try to claim. Format constraint validates. UNIQUE guards collisions.
    -- Only claim when this account still has no handle (race guard).
    UPDATE nex_account
       SET nex_handle = v_candidate
     WHERE id = p_account_id
       AND nex_handle IS NULL;

    IF FOUND THEN
      RETURN v_candidate;
    END IF;

    -- Race lost · another caller assigned to the same account meanwhile.
    -- Return whatever was assigned.
    SELECT nex_handle INTO v_existing
      FROM nex_account
     WHERE id = p_account_id;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;

    -- Unexpected · loop and retry (bounded by counter progress · safe).
  END LOOP;
END;
$$;

COMMENT ON FUNCTION nex_allocate_handle(uuid) IS
  'Atomic + idempotent allocator for nex_account.nex_handle. Returns the existing handle if already assigned · otherwise takes the next sequential counter value and writes nex-<counter>. SECURITY DEFINER because the counter table is service-role-only under RLS.';

-- ---------------------------------------------------------------------------
-- 4. Backfill · assign a handle to every existing account
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM nex_account WHERE nex_handle IS NULL ORDER BY created_at
  LOOP
    PERFORM nex_allocate_handle(r.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Record this migration
-- ---------------------------------------------------------------------------
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '013',
    'nex_account.nex_handle · public NEX identity handle (nex-XXXXX)',
    'Wave A Slice 1 · Founder Decision Pass 2026-09-24 · sealed identity model. Adds a nullable UNIQUE handle column with format CHECK · sequential counter table nex_handle_counter · atomic SECURITY DEFINER allocator nex_allocate_handle · backfill of existing rows. Downstream FKs continue to reference nex_account.id UUID · unchanged.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification (run these · not part of migration):
--
--   SELECT * FROM nex_migration_history WHERE version = '013';
--     -- expect: 1 row
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--     WHERE table_name = 'nex_account' AND column_name = 'nex_handle';
--     -- expect: nex_handle / text / YES
--
--   SELECT conname, contype
--     FROM pg_constraint
--    WHERE conrelid = 'nex_account'::regclass
--      AND conname IN ('nex_account_nex_handle_key', 'nex_account_handle_format');
--     -- expect: two rows · UNIQUE (u) + CHECK (c)
--
--   SELECT id, nex_handle FROM nex_account WHERE nex_handle IS NULL;
--     -- expect: 0 rows post-backfill
--
--   SELECT nex_handle FROM nex_account ORDER BY created_at LIMIT 3;
--     -- expect: nex-10000 · nex-10001 · nex-10002 (or similar sequential)
--
--   -- Idempotency check ·  running twice returns the same handle:
--   SELECT nex_allocate_handle(id) = nex_handle AS ok
--     FROM nex_account
--    LIMIT 1;
--     -- expect: t
-- ============================================================================
