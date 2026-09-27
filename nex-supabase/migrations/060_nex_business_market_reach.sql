-- ============================================================================
-- NEX-native Migration 060 · Business market reach
-- ============================================================================
--
-- Adds market_reach to nex_business so every shop declares whether it
-- serves local buyers, export buyers, or both. Drives two things:
--
--   1. Public shop page renders two "reach" bullets so visitors see at
--      a glance whether the seller ships to them.
--   2. NEX Directory search filters by reach · international buyers
--      searching from outside the seller's region only surface shops
--      whose market_reach includes 'export' (i.e. 'both' or
--      'export_only'). Local buyers see 'both' + 'local_only'.
--
-- Values:
--   'both'         · default · ships locally AND internationally
--   'export_only'  · international shipping only · e.g. a boutique
--                    that doesn't handle domestic pickup
--   'local_only'   · region-locked · pickup or local courier only
--
-- The seller picks this during shop setup. Existing rows default to
-- 'both' so nothing disappears from the current visitor surface.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '060';
--     ALTER TABLE nex_business
--       DROP CONSTRAINT IF EXISTS nex_business_market_reach_check,
--       DROP COLUMN IF EXISTS market_reach;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS market_reach text NOT NULL DEFAULT 'both';

ALTER TABLE nex_business
  DROP CONSTRAINT IF EXISTS nex_business_market_reach_check;

ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_market_reach_check
  CHECK (market_reach IN ('both', 'export_only', 'local_only'));

COMMENT ON COLUMN nex_business.market_reach IS
  'both | export_only | local_only · declares whether the shop
   accepts orders from local buyers, international buyers, or both.
   Default ''both''. Drives Directory search filtering for
   international buyers. Sealed 2026-09-27 · migration 060.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '060',
    'nex_business.market_reach text · both / export_only / local_only · default both',
    'Founder-authorised 2026-09-27. Sellers pick their reach during setup · public shop shows two bullets · Directory filters international searches by reach.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'nex_business' AND column_name = 'market_reach';
