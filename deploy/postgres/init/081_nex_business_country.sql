-- 081_nex_business_country.sql
--
-- Country Foundation Step 3 · 2026-08-22
-- Add explicit `country` column to nex.food_business and nex.accommodation_business.
-- Backfill all existing Yogyakarta rows to 'ID'. Apply NOT NULL + ISO 3166-1 alpha-2 CHECK.
--
-- Doctrine anchors:
--   project_nex_country_foundation_phased_plan_2026_08_22        (Step 3)
--   project_nex_country_scope_from_phone_country_code_2026_08_22 (country upstream · Q6 RESOLVED)
--   project_nex_truth_invariant_2026_08_22                       (explicit country, never assumed)
--   project_nex_walker_stays_pure_acquisition_2026_08_22         (existing invariants preserved)
--
-- Philip 2026-08-22 verbatim:
--   "Right now the registry says: Hotel → ID · but the actual businesses don't
--    explicitly say: Hotel business → ID · After Step 3, we have both sides of the truth."
--
-- Design decisions:
--   · NO DEFAULT on the new column. Every INSERT must explicitly declare country.
--     Per Truth Invariant: a silent DEFAULT could label future non-ID inventory as 'ID'
--     if Walker is misconfigured. Loud error is safer than silent contamination.
--   · Consequence: any code that INSERTs a food/accommodation business row without
--     specifying country will fail after this migration. This is intentional —
--     Step 4 (Walker configs country-aware) fixes the Walker path. Until Step 4,
--     Walker should not be run in production.
--   · Backfill uses hardcoded 'ID' because ALL existing rows are Yogyakarta,
--     verified via SELECT DISTINCT city queries prior to migration.
--   · Existing Yogyakarta city rows preserved bit-for-bit apart from the new column.
--
-- Reversible:
--   BEGIN;
--     ALTER TABLE nex.accommodation_business DROP CONSTRAINT IF EXISTS accommodation_business_country_iso_check;
--     ALTER TABLE nex.accommodation_business DROP COLUMN IF EXISTS country;
--     ALTER TABLE nex.food_business          DROP CONSTRAINT IF EXISTS food_business_country_iso_check;
--     ALTER TABLE nex.food_business          DROP COLUMN IF EXISTS country;
--   COMMIT;

BEGIN;

-- ── Pre-migration snapshot (recorded via RAISE NOTICE for the audit trail) ──
DO $$
DECLARE
  food_count INT;
  acc_count  INT;
BEGIN
  SELECT COUNT(*) INTO food_count FROM nex.food_business;
  SELECT COUNT(*) INTO acc_count  FROM nex.accommodation_business;
  RAISE NOTICE 'Migration 081 pre-state: food_business=% rows · accommodation_business=% rows', food_count, acc_count;
END $$;

-- ═══ FOOD BUSINESS ══════════════════════════════════════════════════

ALTER TABLE nex.food_business
  ADD COLUMN country text;

UPDATE nex.food_business
   SET country = 'ID'
 WHERE country IS NULL;

ALTER TABLE nex.food_business
  ALTER COLUMN country SET NOT NULL;

ALTER TABLE nex.food_business
  ADD CONSTRAINT food_business_country_iso_check
  CHECK (country ~ '^[A-Z]{2}$');

COMMENT ON COLUMN nex.food_business.country IS
  'Country Foundation Step 3 · 2026-08-22 · ISO 3166-1 alpha-2 · required NOT NULL · no DEFAULT (every INSERT must explicitly declare). Backfilled to ''ID'' for pre-Step-3 Yogyakarta rows.';

-- ═══ ACCOMMODATION BUSINESS ═════════════════════════════════════════

ALTER TABLE nex.accommodation_business
  ADD COLUMN country text;

UPDATE nex.accommodation_business
   SET country = 'ID'
 WHERE country IS NULL;

ALTER TABLE nex.accommodation_business
  ALTER COLUMN country SET NOT NULL;

ALTER TABLE nex.accommodation_business
  ADD CONSTRAINT accommodation_business_country_iso_check
  CHECK (country ~ '^[A-Z]{2}$');

COMMENT ON COLUMN nex.accommodation_business.country IS
  'Country Foundation Step 3 · 2026-08-22 · ISO 3166-1 alpha-2 · required NOT NULL · no DEFAULT (every INSERT must explicitly declare). Backfilled to ''ID'' for pre-Step-3 Yogyakarta rows.';

-- ── Post-migration verification (fails the migration if invariants broken) ──
DO $$
DECLARE
  food_total       INT;
  food_id_count    INT;
  food_non_id      INT;
  acc_total        INT;
  acc_id_count     INT;
  acc_non_id       INT;
  food_nn_ok       BOOLEAN;
  acc_nn_ok        BOOLEAN;
BEGIN
  -- Row counts
  SELECT COUNT(*) INTO food_total FROM nex.food_business;
  SELECT COUNT(*) INTO food_id_count FROM nex.food_business WHERE country = 'ID';
  SELECT COUNT(*) INTO food_non_id FROM nex.food_business WHERE country <> 'ID';

  SELECT COUNT(*) INTO acc_total FROM nex.accommodation_business;
  SELECT COUNT(*) INTO acc_id_count FROM nex.accommodation_business WHERE country = 'ID';
  SELECT COUNT(*) INTO acc_non_id FROM nex.accommodation_business WHERE country <> 'ID';

  -- NOT NULL constraint check via information_schema
  SELECT is_nullable = 'NO' INTO food_nn_ok
    FROM information_schema.columns
   WHERE table_schema = 'nex' AND table_name = 'food_business' AND column_name = 'country';
  SELECT is_nullable = 'NO' INTO acc_nn_ok
    FROM information_schema.columns
   WHERE table_schema = 'nex' AND table_name = 'accommodation_business' AND column_name = 'country';

  -- Invariants
  IF food_id_count <> food_total THEN
    RAISE EXCEPTION 'Migration 081 failed: food_business has % rows but only % have country=ID', food_total, food_id_count;
  END IF;
  IF food_non_id <> 0 THEN
    RAISE EXCEPTION 'Migration 081 failed: food_business has % rows with country != ID', food_non_id;
  END IF;
  IF acc_id_count <> acc_total THEN
    RAISE EXCEPTION 'Migration 081 failed: accommodation_business has % rows but only % have country=ID', acc_total, acc_id_count;
  END IF;
  IF acc_non_id <> 0 THEN
    RAISE EXCEPTION 'Migration 081 failed: accommodation_business has % rows with country != ID', acc_non_id;
  END IF;
  IF NOT food_nn_ok THEN
    RAISE EXCEPTION 'Migration 081 failed: food_business.country not NOT NULL';
  END IF;
  IF NOT acc_nn_ok THEN
    RAISE EXCEPTION 'Migration 081 failed: accommodation_business.country not NOT NULL';
  END IF;

  RAISE NOTICE 'Migration 081 complete: food_business=% rows (all ID) · accommodation_business=% rows (all ID) · NOT NULL + ISO-2 CHECK enforced on both', food_total, acc_total;
END $$;

COMMIT;
