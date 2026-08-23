-- 080_nex_business_image.sql
--
-- Task IMAGE-SYSTEM · Phase 1 · Universal Directory Image storage · 2026-08-22
--
-- Doctrine anchors:
--   project_nex_universal_directory_image_doctrine_2026_08_22
--   project_nex_country_scope_from_phone_country_code_2026_08_22  (country baked in Q6 RESOLVED)
--   project_nex_directory_factory_doctrine_2026_08_22             (Factory Phase 0 will read this table)
--   project_nex_walker_stays_pure_acquisition_2026_08_22          (Direct-Provenance A · cycle_run_id FK)
--
-- Philip 2026-08-22 verbatim (Universal Image Doctrine · locked decisions):
--   "Use Option B — universal polymorphic nex.business_image."
--   "Every customer directory (Food / Coffee / Ice Cream / Hotel / Villa /
--    Guesthouse / Kos / Hostel / Apartment / Homestay / Resort / Car Rental /
--    Motorbike Rental / Services / Trades / future) uses ONE universal image
--    resolver · 3 states OWNER_IMAGE > VERIFIED_REAL > CATEGORY_FALLBACK ·
--    fallback NEVER shown as actual business photograph."
--
-- Philip 2026-08-22 (country three-layer amendment):
--   "Country must be part of the canonical identity from the beginning."
--   Canonical identity = country / city / category_id · never category_id alone.
--
-- Design:
--   · polymorphic — one table serves every current + future vertical (business_type)
--   · country-scoped from day one — business_country ISO alpha-2 required
--   · three image states enforced via CHECK
--   · Direct-Provenance A slot present — cycle_run_id FK for Walker-discovered VERIFIED_REAL
--   · rows are ADVISORY until approved=true (Universal Image Doctrine · mechanical
--     publication via confidence threshold for VERIFIED_REAL; owner-approved gate for OWNER_IMAGE)
--   · UNIQUE(business_type, business_country, business_ref, image_type) — one row per state per business
--
-- Reversible:
--   BEGIN;
--     DROP INDEX IF EXISTS nex.idx_business_image_cycle_run;
--     DROP INDEX IF EXISTS nex.idx_business_image_type;
--     DROP INDEX IF EXISTS nex.idx_business_image_lookup;
--     DROP TABLE IF EXISTS nex.business_image;
--   COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS nex.business_image (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic business reference · scoped by country from day one (Q6 RESOLVED)
  business_type     text NOT NULL,
  business_country  text NOT NULL
                    CHECK (business_country ~ '^[A-Z]{2}$'),          -- ISO 3166-1 alpha-2
  business_ref      text NOT NULL,                                    -- e.g. public_listing_ref

  -- Universal Image Doctrine · 3 states only
  image_type        text NOT NULL
                    CHECK (image_type IN ('OWNER_IMAGE','VERIFIED_REAL','CATEGORY_FALLBACK')),

  -- Image payload
  url               text NOT NULL,
  source            text NOT NULL,                                    -- 'owner_upload' | 'walker:osm' | 'nex.categoryLibrary' | ...
  provenance        jsonb,                                            -- evidence blob (OSM tags · verification chain · etc.)
  confidence        numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  -- Direct-Provenance A · Walker-stamped for VERIFIED_REAL rows discovered by an agent
  cycle_run_id      uuid REFERENCES nex.worker_cycle_run(id),

  -- CATEGORY_FALLBACK metadata (NULL for OWNER_IMAGE / VERIFIED_REAL rows)
  fallback_category text,

  -- Approval gates
  owner_approved    boolean NOT NULL DEFAULT false,                   -- owner-side sign-off (relevant to OWNER_IMAGE)
  approved          boolean NOT NULL DEFAULT false,                   -- system approval · required to go live

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- One row per (business, image_type). Owner-image and verified-real for same
  -- business can coexist; resolver picks owner first.
  UNIQUE (business_type, business_country, business_ref, image_type)
);

CREATE INDEX IF NOT EXISTS idx_business_image_lookup
  ON nex.business_image (business_type, business_country, business_ref);

CREATE INDEX IF NOT EXISTS idx_business_image_type
  ON nex.business_image (image_type);

CREATE INDEX IF NOT EXISTS idx_business_image_cycle_run
  ON nex.business_image (cycle_run_id)
  WHERE cycle_run_id IS NOT NULL;

-- Documentation
COMMENT ON TABLE  nex.business_image                     IS 'Universal Directory Image storage · polymorphic across every NEX vertical · country-scoped identity · doctrine: project_nex_universal_directory_image_doctrine_2026_08_22';
COMMENT ON COLUMN nex.business_image.business_type       IS 'Polymorphic vertical id · food | accommodation | rentals | services | trades | future';
COMMENT ON COLUMN nex.business_image.business_country    IS 'ISO 3166-1 alpha-2 · e.g. ID · GB · US · foundational per country-three-layer doctrine (Q6 RESOLVED 2026-08-22)';
COMMENT ON COLUMN nex.business_image.business_ref        IS 'Vertical-native business reference · e.g. food_business.public_listing_ref';
COMMENT ON COLUMN nex.business_image.image_type          IS 'Universal Image Doctrine · one of OWNER_IMAGE > VERIFIED_REAL > CATEGORY_FALLBACK · fallback NEVER represents the specific business';
COMMENT ON COLUMN nex.business_image.confidence          IS 'Walker/discovery confidence 0-1 · required ≥0.95 for VERIFIED_REAL auto-publish per doctrine';
COMMENT ON COLUMN nex.business_image.cycle_run_id        IS 'Direct-Provenance A · Walker cycle that discovered VERIFIED_REAL rows · NULL for OWNER_IMAGE and CATEGORY_FALLBACK';
COMMENT ON COLUMN nex.business_image.fallback_category   IS 'Canonical category_id from Category Registry · NON-NULL only when image_type=CATEGORY_FALLBACK';
COMMENT ON COLUMN nex.business_image.owner_approved      IS 'Owner has signed off on this specific image (relevant to OWNER_IMAGE rows)';
COMMENT ON COLUMN nex.business_image.approved            IS 'System approval to render publicly · Universal Image Doctrine · never bypass';

-- Sanity check · verify table + constraints in place
DO $$
DECLARE
  tbl_exists BOOLEAN;
  check_count INT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='nex' AND table_name='business_image'
  ) INTO tbl_exists;
  IF NOT tbl_exists THEN
    RAISE EXCEPTION 'Migration 080 failed: nex.business_image not created';
  END IF;

  SELECT COUNT(*) INTO check_count
    FROM information_schema.check_constraints c
    JOIN information_schema.constraint_column_usage u ON c.constraint_name = u.constraint_name
   WHERE u.table_schema='nex' AND u.table_name='business_image'
     AND u.column_name IN ('business_country','image_type','confidence');
  IF check_count < 3 THEN
    RAISE EXCEPTION 'Migration 080 failed: expected CHECKs on business_country/image_type/confidence (found %)', check_count;
  END IF;

  RAISE NOTICE 'Migration 080 complete: nex.business_image created · polymorphic · country-scoped · Direct-Provenance A slot present';
END $$;

COMMIT;
