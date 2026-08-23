-- 079_nex_accommodation_add_kos_category.sql
--
-- Task #89 · Phase A follow-up · Add "kos" as 8th Accommodation category · 2026-08-22
--
-- Philip 2026-08-22 verbatim (Q7 confirmation + Kos addition):
--   "add: kos · to the Accommodation category registry, but mark its Walker
--   classification as conservative / evidence-dependent."
--   "Kos can exist as a legitimate NEX destination even if the initial Walker
--   doesn't confidently classify every potential Kos property."
--
-- Kos (also: kost · kosan · indekos) = Indonesian residential monthly rental.
-- Traditional shared boarding house · common near universities · frequently
-- unlabeled in OSM. Walker uses name-based detection (kos/kost/kosan tokens)
-- to identify. Never inferred from cheap-looking building alone.
--
-- Reversible:
--   BEGIN;
--     -- Note: reverting requires reclassifying any 'kos' rows first · else CHECK fails
--     ALTER TABLE nex.accommodation_business
--       DROP CONSTRAINT accommodation_business_category_check;
--     ALTER TABLE nex.accommodation_business
--       ADD CONSTRAINT accommodation_business_category_check
--         CHECK (category IN ('hotel','villa','guesthouse','homestay','resort','hostel','apartment'));
--   COMMIT;

BEGIN;

ALTER TABLE nex.accommodation_business
  DROP CONSTRAINT IF EXISTS accommodation_business_category_check;

ALTER TABLE nex.accommodation_business
  ADD CONSTRAINT accommodation_business_category_check
    CHECK (category IN ('hotel','villa','guesthouse','homestay','resort','hostel','apartment','kos'));

COMMENT ON COLUMN nex.accommodation_business.category IS
  'Q2 · 8-value taxonomy (Task #89 Phase A + Kos addition 2026-08-22) · determined by conservative classifier from OSM tags + name-based Kos detection (Indonesian residential monthly rental · tokens: kos/kost/kosan/indekos) · never inferred from vague accommodation-related tag or cheap-looking building alone.';

-- Sanity check
DO $$
DECLARE ck TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO ck
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'nex' AND t.relname = 'accommodation_business' AND c.conname = 'accommodation_business_category_check';
  IF ck IS NULL OR position('kos' in ck) = 0 THEN
    RAISE EXCEPTION 'Migration 079 failed: kos not in accommodation category CHECK';
  END IF;
  RAISE NOTICE 'Migration 079 complete: accommodation category CHECK now accepts 8 values (…, kos)';
END $$;

COMMIT;
