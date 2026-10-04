-- nex-supabase/migrations/134_nex_account_profile_discoverable.sql
--
-- NEX Phase 3A · explicit public-discoverability opt-in.
-- Founder-authorised 2026-10-04.
--
-- WHAT THIS DOES
--   1. Adds `nex_account_profile.is_discoverable boolean NOT NULL
--      DEFAULT false` · additive · no existing data touched.
--   2. Swaps the public-read RLS policy on `nex_account_profile`
--      from gating on `is_public = true` to `is_discoverable = true`.
--
-- WHY
--   The sealed Phase 3A boundary requires explicit user opt-in before
--   a profile may be rendered publicly at /nex-native/u/{handle} or
--   surfaced by any future People discovery surface. The existing
--   `is_public` column is not that signal · it was pre-wired for
--   Directory discovery (migration 042) but its semantics have
--   drifted (DB default `true` · Settings UI force-sets `false`).
--   `is_discoverable` is the new authoritative opt-in gate · a clean,
--   additive signal with a clear meaning that cannot be confused with
--   anything else.
--
-- INVARIANTS SEALED WITH THIS MIGRATION
--   · `is_public` is NEVER repurposed, renamed, removed, or
--     reinterpreted. It stays available for its original meaning.
--   · `is_discoverable` defaults FALSE for every row, now and forever.
--     No data migration touches existing values.
--   · RLS is the authoritative privacy boundary · app code may NOT
--     bypass this policy to render a profile publicly.
--   · Owner RLS policies (owner_read, owner_insert, owner_update)
--     are completely untouched · owners always see their own row
--     regardless of the discoverability flag.
--
-- IMMEDIATE EFFECT ON LIVE DATA
--   · 5 existing profiles currently have `is_public = true` and are
--     therefore publicly readable through the live /u/{handle} route.
--     After this migration, the public-read RLS gate requires
--     `is_discoverable = true` · which defaults FALSE for all
--     existing rows · so those 5 profiles immediately cease being
--     publicly readable. This is the intended privacy improvement.
--
-- NOT IN SCOPE (verified)
--   · No change to Search, discovery-service, Vault, Call Center,
--     chat themes, launch flags, Terms, Privacy, or any other RLS
--     policy on any other table.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1 · additive column
-- ----------------------------------------------------------------------------
ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS is_discoverable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN nex_account_profile.is_discoverable IS
  'Phase 3A opt-in gate. TRUE = profile may be rendered publicly at '
  '/nex-native/u/{handle} and included in future People discovery '
  'surfaces. Default FALSE. Never derived · must be set explicitly '
  'by the owner. See migration 134.';

-- ----------------------------------------------------------------------------
-- 2 · swap the public-read policy from is_public to is_discoverable
-- ----------------------------------------------------------------------------
-- The policy name is kept the same so downstream reasoning stays
-- straightforward · only the USING clause changes. Owner policies
-- are not touched by this migration.
DROP POLICY IF EXISTS nex_account_profile_public_read ON nex_account_profile;

CREATE POLICY nex_account_profile_public_read
  ON nex_account_profile
  FOR SELECT
  TO anon, authenticated
  USING (is_discoverable = true);

-- ----------------------------------------------------------------------------
-- 3 · migration-history record
-- ----------------------------------------------------------------------------
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '134',
    'nex_account_profile · is_discoverable opt-in + public-read RLS swap · Phase 3A',
    'Phase 3A founder-authorised 2026-10-04. Adds is_discoverable boolean NOT NULL DEFAULT false. Swaps nex_account_profile_public_read RLS gate from (is_public = true) to (is_discoverable = true). is_public is NOT touched · stays sealed with its original meaning. No data migration · existing rows inherit DEFAULT false · the 5 legacy profiles with is_public = true immediately lose public-read access · owner RLS unchanged.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification queries · run these manually on the live DB
-- (as a check, NOT as part of the migration transaction).
-- ============================================================================
--
-- -- Confirm the column exists with the correct default:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'nex_account_profile' AND column_name = 'is_discoverable';
--
-- -- Confirm no existing row was flipped to true:
-- SELECT COUNT(*) AS discoverable_rows
-- FROM nex_account_profile
-- WHERE is_discoverable = true;
-- -- expected: 0
--
-- -- Confirm the public-read policy now gates on is_discoverable:
-- SELECT polname, pg_get_expr(polqual, polrelid) AS using_clause
-- FROM pg_policy
-- WHERE polrelid = 'nex_account_profile'::regclass
--   AND polname = 'nex_account_profile_public_read';
-- -- expected using_clause: (is_discoverable = true)
--
-- -- Smoke-test anonymous read (should return zero rows after migration):
-- SET ROLE anon;
-- SELECT COUNT(*) FROM nex_account_profile;
-- RESET ROLE;
-- -- expected: 0 (because every row has is_discoverable = false)
