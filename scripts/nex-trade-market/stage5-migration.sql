-- COPY-PASTE THIS INTO Supabase Dashboard → SQL Editor → New Query → Run
-- (NEX project · ijvqdvsvwtwxzcqmoqit)
--
-- This is a mirror of deploy/postgres/init/051_directory_seeds_stage5_schema_extension.sql
-- kept alongside the Stage 5B import script for convenience.
-- Idempotent · safe to re-run.

ALTER TABLE directory_seeds
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS internal_verification_state text,
  ADD COLUMN IF NOT EXISTS customer_facing_label text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS provenance jsonb DEFAULT '{}'::jsonb;

ALTER TABLE directory_seeds DROP CONSTRAINT IF EXISTS directory_seeds_business_type_check;
ALTER TABLE directory_seeds ADD CONSTRAINT directory_seeds_business_type_check
  CHECK (business_type IS NULL OR business_type IN (
    'MULTI_SERVICE_COMPANY','STAIRCASE_MANUFACTURER',
    'REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER',
    'REFURBISHMENT_SERVICE_SPECIALIST','REFACING_SERVICE_SPECIALIST',
    'STAIRCASE_INSTALLER'
  ));

ALTER TABLE directory_seeds DROP CONSTRAINT IF EXISTS directory_seeds_internal_verification_state_check;
ALTER TABLE directory_seeds ADD CONSTRAINT directory_seeds_internal_verification_state_check
  CHECK (internal_verification_state IS NULL OR internal_verification_state IN (
    'FULLY_VERIFIED','SERVICE_EVIDENCED','DIRECTLY_REACHABLE','SEARCH_DISCOVERED'
  ));

ALTER TABLE directory_seeds DROP CONSTRAINT IF EXISTS directory_seeds_region_check;
ALTER TABLE directory_seeds ADD CONSTRAINT directory_seeds_region_check
  CHECK (region IS NULL OR region IN (
    'London','SE','SW','E','E Mids','W Mids','NW','NE','Yorkshire','Scotland','Wales','NI'
  ));

CREATE INDEX IF NOT EXISTS directory_seeds_business_type_idx ON directory_seeds(business_type);
CREATE INDEX IF NOT EXISTS directory_seeds_region_idx ON directory_seeds(region);
CREATE INDEX IF NOT EXISTS directory_seeds_internal_verification_state_idx ON directory_seeds(internal_verification_state);
CREATE INDEX IF NOT EXISTS directory_seeds_type_region_idx
  ON directory_seeds(business_type, region)
  WHERE business_type IS NOT NULL AND region IS NOT NULL;

-- Verification (run these AFTER the migration to confirm everything landed):
SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'directory_seeds'
    AND column_name IN ('business_type','internal_verification_state','customer_facing_label','region','provenance')
  ORDER BY column_name;

SELECT conname FROM pg_constraint
  WHERE conrelid = 'directory_seeds'::regclass
    AND conname LIKE '%_check'
  ORDER BY conname;
