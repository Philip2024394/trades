-- ============================================================================
-- NEX-native Migration 083 · Bridge 30 · Verified real businesses
-- ============================================================================
--
-- Adds an admin-only verification signal to nex_business:
--
--   nex_business.verified_at   · TIMESTAMPTZ · NULL when unverified.
--                                When set, the row represents a real,
--                                admin-checked business (paperwork or
--                                other evidence reviewed).
--
--   nex_business.verified_note · TEXT · optional admin note about the
--                                verification event (e.g. "checked NPWP
--                                + physical address 2026-09-28").
--                                Never shown to buyers · admin-only.
--
-- Founder doctrine 2026-09-28: the Business tab of /nex-native/chat is
-- reserved for verified businesses only. Unverified shops still exist
-- on the platform, still get their public /nex-native/[slug] landing,
-- still receive chat via product/menu inquiry · they just don't appear
-- in the buyer-facing "trusted directory" that the Business tab is.
--
-- No public RLS change: the column is world-readable via the existing
-- nex_business select policy, so buyers CAN read who is verified. The
-- WRITE side is admin-only (via nex_supabase_service_role · not a
-- signed-in user's key). Founder marks businesses verified out-of-band
-- (SQL, admin CLI, or a future /nex-appadmin action).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '083';
--     ALTER TABLE nex_business
--       DROP COLUMN IF EXISTS verified_at,
--       DROP COLUMN IF EXISTS verified_note;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS verified_note text
    CHECK (verified_note IS NULL OR length(verified_note) <= 500);

COMMENT ON COLUMN nex_business.verified_at IS
  'Admin verification timestamp · NULL = unverified · set when an
   admin has confirmed the business is a real trading entity. Drives
   the "Business" tab visibility on /nex-native/chat. Sealed
   2026-09-28 · Bridge 30.';

COMMENT ON COLUMN nex_business.verified_note IS
  'Optional admin-only note about the verification event · never
   shown to buyers. 0-500 chars. Sealed 2026-09-28 · Bridge 30.';

CREATE INDEX IF NOT EXISTS idx_nex_business_verified_at
  ON nex_business (verified_at)
  WHERE verified_at IS NOT NULL;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '083',
    'Bridge 30 · nex_business.verified_at + verified_note · Business-tab trust signal',
    'Founder-authorised 2026-09-28. Admin-set only · buyers see the flag but do not write it. Business tab of /nex-native/chat filters to verified_at IS NOT NULL.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_business' AND column_name IN ('verified_at','verified_note');
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'nex_business' AND indexname = 'idx_nex_business_verified_at';
