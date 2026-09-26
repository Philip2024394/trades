-- ============================================================================
-- NEX-native Migration 044 · nex_account_profile.kind · add 'reseller'
-- ============================================================================
--
-- Purpose:
--   Extend the "what best describes what you do?" answer set to include
--   `reseller` for users who sell products they didn't make themselves
--   (drop-shippers, retailers of other brands, resellers of second-hand
--   or refurbished goods, affiliate-style resellers etc.).
--
--   Introduced 2026-09-27 · Founder direction: NEX identity needs to
--   distinguish resellers from full business owners so the future NEX
--   Directory / commerce surfaces can address them differently
--   (verification path · commission structure · shop presentation).
--
-- Approach:
--   Postgres CHECK constraints can't be additively extended in place ·
--   drop the old constraint and re-add it with the new value included.
--   Existing rows are unaffected (all current values remain valid).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '044';
--     ALTER TABLE nex_account_profile
--       DROP CONSTRAINT IF EXISTS nex_account_profile_kind_known;
--     ALTER TABLE nex_account_profile
--       ADD CONSTRAINT nex_account_profile_kind_known CHECK (
--         kind IS NULL OR kind IN (
--           'professional', 'business_owner', 'student',
--           'seeking_work', 'exploring', 'other'
--         )
--       );
--     -- If any row has kind='reseller' at rollback time, migrate them
--     -- to 'business_owner' first · they're the closest equivalent.
--     -- UPDATE nex_account_profile SET kind='business_owner' WHERE kind='reseller';
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_account_profile
  DROP CONSTRAINT IF EXISTS nex_account_profile_kind_known;

ALTER TABLE nex_account_profile
  ADD CONSTRAINT nex_account_profile_kind_known CHECK (
    kind IS NULL OR kind IN (
      'professional',
      'business_owner',
      'student',
      'seeking_work',
      'exploring',
      'reseller',
      'other'
    )
  );

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '044',
    'nex_account_profile.kind CHECK · add reseller',
    'Founder-authorised 2026-09-27. Adds "reseller" to the seven-value kind enum. Users who sell products they did not manufacture themselves. Existing rows unaffected · additive-only.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'nex_account_profile'::regclass
--      AND conname = 'nex_account_profile_kind_known';
--     -- expect: CHECK clause includes 'reseller'
--   SELECT * FROM nex_migration_history WHERE version = '044';
