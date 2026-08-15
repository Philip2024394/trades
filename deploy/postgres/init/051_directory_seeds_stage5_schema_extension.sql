-- 051 · Trade Centre schema extension for UK Staircase Trade Market Stage 5B
-- ─────────────────────────────────────────────────────────────────────────
-- Adds Philip's two-dimension classification + verification state + provenance
-- to directory_seeds. Approved 2026-08-15 as Option A (proper schema, not tags).
--
-- Applies to the NEX Supabase project (ijvqdvsvwtwxzcqmoqit).
-- Run via Supabase Dashboard → SQL Editor OR via psql with the direct DB URL.
-- Idempotent · safe to re-run.
--
-- Rules encoded:
--   · business_type · SINGLE value, controlled enum (Philip's 6 groups)
--   · internal_verification_state · SINGLE value, controlled enum (Philip's 4 states)
--   · customer_facing_label · free text (soft label per language caution)
--   · region · SINGLE value, controlled enum (12 UK regions)
--   · provenance · jsonb bundle (discovery + verification audit trail)
--
-- The controlled-value CHECK constraints prevent future agents from
-- accidentally creating variants like "multi-service", "manufacturer2", etc.

ALTER TABLE directory_seeds
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS internal_verification_state text,
  ADD COLUMN IF NOT EXISTS customer_facing_label text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS provenance jsonb DEFAULT '{}'::jsonb;

-- Controlled enum for business_type (Philip's 6-group taxonomy, 2026-08-15)
-- Drop-then-add pattern makes the constraint evolvable: to add a new
-- business_type in future, drop this constraint and re-add with the extended list.
ALTER TABLE directory_seeds
  DROP CONSTRAINT IF EXISTS directory_seeds_business_type_check;

ALTER TABLE directory_seeds
  ADD CONSTRAINT directory_seeds_business_type_check
  CHECK (business_type IS NULL OR business_type IN (
    'MULTI_SERVICE_COMPANY',
    'STAIRCASE_MANUFACTURER',
    'REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER',
    'REFURBISHMENT_SERVICE_SPECIALIST',
    'REFACING_SERVICE_SPECIALIST',
    'STAIRCASE_INSTALLER'
  ));

-- Controlled enum for internal_verification_state (Philip's 4-state, 2026-08-15)
ALTER TABLE directory_seeds
  DROP CONSTRAINT IF EXISTS directory_seeds_internal_verification_state_check;

ALTER TABLE directory_seeds
  ADD CONSTRAINT directory_seeds_internal_verification_state_check
  CHECK (internal_verification_state IS NULL OR internal_verification_state IN (
    'FULLY_VERIFIED',
    'SERVICE_EVIDENCED',
    'DIRECTLY_REACHABLE',
    'SEARCH_DISCOVERED'
  ));

-- Controlled enum for region (12 UK regions from Stage 2 discovery agents)
ALTER TABLE directory_seeds
  DROP CONSTRAINT IF EXISTS directory_seeds_region_check;

ALTER TABLE directory_seeds
  ADD CONSTRAINT directory_seeds_region_check
  CHECK (region IS NULL OR region IN (
    'London', 'SE', 'SW', 'E', 'E Mids', 'W Mids',
    'NW', 'NE', 'Yorkshire', 'Scotland', 'Wales', 'NI'
  ));

-- Indexes for the new query axes (Trade Centre filter UI will use these)
CREATE INDEX IF NOT EXISTS directory_seeds_business_type_idx
  ON directory_seeds(business_type);

CREATE INDEX IF NOT EXISTS directory_seeds_region_idx
  ON directory_seeds(region);

CREATE INDEX IF NOT EXISTS directory_seeds_internal_verification_state_idx
  ON directory_seeds(internal_verification_state);

-- Composite index for the most common Trade Centre query:
-- "find companies of business_type X in region Y"
CREATE INDEX IF NOT EXISTS directory_seeds_type_region_idx
  ON directory_seeds(business_type, region)
  WHERE business_type IS NOT NULL AND region IS NOT NULL;

-- Verification query · run after migration to confirm everything landed
-- (comment out for production apply · uncomment locally to check):
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'directory_seeds'
--     AND column_name IN ('business_type', 'internal_verification_state', 'customer_facing_label', 'region', 'provenance');
-- SELECT conname FROM pg_constraint WHERE conrelid = 'directory_seeds'::regclass AND conname LIKE '%_check';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'directory_seeds' AND indexname LIKE 'directory_seeds_%_idx';
