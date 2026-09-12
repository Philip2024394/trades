-- Portable test fixture · replicates production nex.accommodation_business shape.
-- ============================================================================
-- Slice A2 · 2026-09-07 · Philip
--
-- This file mirrors the production nex.accommodation_business schema created
-- by deploy/postgres/init/078_nex_accommodation_business.sql + kos extension
-- from 079 so that portable A2 contract tests can prove the persister works
-- against the production shape.
--
-- Used ONLY by the Slice A2 contract test suite's beforeAll. Never applied to
-- Project B (Project B has no accommodation footprint; see ADR-0119).
--
-- Applied via pool.query at the start of accommodation_persister_contract.test.mjs.

-- ─── prereqs (shared with food fixture · no-ops if already present) ─────────
CREATE SCHEMA IF NOT EXISTS nex;
CREATE SCHEMA IF NOT EXISTS extensions;
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    EXECUTE 'CREATE EXTENSION pgcrypto WITH SCHEMA extensions';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'pgcrypto' AND n.nspname = 'extensions'
  ) THEN
    EXECUTE 'ALTER EXTENSION pgcrypto SET SCHEMA extensions';
  END IF;
END $body$;

-- ─── 1. worker_cycle_run (referenced by accommodation source_snapshot FK) ───
-- Also referenced by food fixture; safe to create here IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS nex.worker_cycle_run (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id      TEXT NOT NULL,
  worker_type    TEXT,
  worker_config  TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT
);

-- ─── 2. accommodation_business · canonical table (mirror of migration 078) ──
CREATE TABLE IF NOT EXISTS nex.accommodation_business (
  internal_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_listing_ref     TEXT NOT NULL UNIQUE
                           CHECK (public_listing_ref ~ '^#AC-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$'),
  business_name          TEXT NOT NULL,
  -- 078 + 079 (kos): 8-value taxonomy
  category               TEXT NOT NULL
                           CHECK (category IN ('hotel','villa','guesthouse','homestay','resort','hostel','apartment','kos')),
  categories             TEXT[] NOT NULL DEFAULT '{}',
  address                TEXT,
  city                   TEXT NOT NULL,
  district               TEXT,
  coordinates_lng        NUMERIC,
  coordinates_lat        NUMERIC,
  phone                  TEXT,
  whatsapp_number        TEXT,
  website                TEXT,
  public_social_links    JSONB,
  star_rating            INTEGER CHECK (star_rating IS NULL OR (star_rating BETWEEN 1 AND 5)),
  star_rating_source     TEXT,
  room_count             INTEGER CHECK (room_count IS NULL OR room_count > 0),
  amenities              TEXT[] NOT NULL DEFAULT '{}',
  source                 TEXT NOT NULL,
  source_reference       TEXT NOT NULL,
  source_ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_checked_at      TIMESTAMPTZ,
  source_licence_terms   TEXT,
  source_updated_at      TIMESTAMPTZ,
  last_verified_at       TIMESTAMPTZ,
  verification_source    TEXT,
  dedupe_hash            TEXT NOT NULL,
  claim_status           TEXT NOT NULL DEFAULT 'discovered'
                           CHECK (claim_status IN ('discovered','verifying','listed','invited','claimed','paying')),
  owner_status           TEXT NOT NULL DEFAULT 'unknown'
                           CHECK (owner_status IN ('unknown','contacted','responded','verified')),
  hero_image_url         TEXT,
  hero_image_source      TEXT,
  hero_image_approved    BOOLEAN NOT NULL DEFAULT false,
  hero_image_provenance  JSONB,
  rating                 NUMERIC(3,2) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  rating_source          TEXT,
  review_count           INTEGER CHECK (review_count IS NULL OR review_count >= 0),
  review_count_source    TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accommodation_business_dedupe ON nex.accommodation_business (dedupe_hash);
CREATE INDEX IF NOT EXISTS idx_accommodation_business_city_category  ON nex.accommodation_business (city, category);
CREATE INDEX IF NOT EXISTS idx_accommodation_business_claim_status   ON nex.accommodation_business (claim_status);
CREATE INDEX IF NOT EXISTS idx_accommodation_business_owner_status   ON nex.accommodation_business (owner_status);
CREATE INDEX IF NOT EXISTS idx_accommodation_business_categories_gin ON nex.accommodation_business USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_accommodation_business_amenities_gin  ON nex.accommodation_business USING GIN (amenities);

-- ─── 3. field_provenance (mirror of migration 078 § 3) ──────────────────────
CREATE TABLE IF NOT EXISTS nex.accommodation_business_field_provenance (
  business_ref       TEXT NOT NULL REFERENCES nex.accommodation_business(public_listing_ref) ON DELETE CASCADE,
  field_name         TEXT NOT NULL,
  trust_layer        TEXT NOT NULL CHECK (trust_layer IN ('source_import','nex_curated','admin_verified','owner_verified','admin_rejected')),
  written_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  written_by         TEXT,
  source_reference   TEXT,
  cycle_run_id       UUID REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL,
  PRIMARY KEY (business_ref, field_name)
);
CREATE INDEX IF NOT EXISTS idx_accommodation_provenance_trust ON nex.accommodation_business_field_provenance (business_ref, trust_layer);

-- ─── 4. source_snapshot + enrichment_evidence (skeletons — A2 tests do not
--     mutate these, but the FK from source_snapshot exists in production so we
--     mirror it for shape fidelity) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.accommodation_business_source_snapshot (
  snapshot_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref       TEXT NOT NULL REFERENCES nex.accommodation_business(public_listing_ref) ON DELETE CASCADE,
  source             TEXT NOT NULL,
  source_reference   TEXT NOT NULL,
  captured_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload        JSONB NOT NULL,
  cycle_run_id       UUID REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS nex.accommodation_enrichment_evidence (
  evidence_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref       TEXT NOT NULL REFERENCES nex.accommodation_business(public_listing_ref) ON DELETE CASCADE,
  field_name         TEXT NOT NULL,
  value              TEXT,
  value_normalised   TEXT,
  source             TEXT NOT NULL,
  source_type        TEXT NOT NULL,
  source_url         TEXT,
  confidence         NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  agent_name         TEXT NOT NULL,
  discovered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  provenance_layer   TEXT NOT NULL DEFAULT 'source_import',
  raw_snippet        TEXT,
  raw_payload        JSONB,
  cycle_run_id       UUID REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL
);

-- ─── 5. touch trigger for updated_at (mirror of 078) ────────────────────────
CREATE OR REPLACE FUNCTION nex.trg_accommodation_business_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accommodation_business_touch_updated_at ON nex.accommodation_business;
CREATE TRIGGER trg_accommodation_business_touch_updated_at
  BEFORE UPDATE ON nex.accommodation_business
  FOR EACH ROW EXECUTE FUNCTION nex.trg_accommodation_business_touch_updated_at();

-- ─── 6. identity constraint from migration 114 ─────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS ux_accommodation_business_source_ref
  ON nex.accommodation_business (source, source_reference)
  WHERE source_reference IS NOT NULL;

-- ─── 7. Migration 106 shape · walker attribution columns ────────────────────
-- worker_id + cycle_run_id · additive, NULL for pre-contract rows.
ALTER TABLE nex.accommodation_business
  ADD COLUMN IF NOT EXISTS worker_id     TEXT,
  ADD COLUMN IF NOT EXISTS cycle_run_id  UUID
    REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accommodation_business_cycle_run
  ON nex.accommodation_business (cycle_run_id) WHERE cycle_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accommodation_business_worker_id
  ON nex.accommodation_business (worker_id) WHERE worker_id IS NOT NULL;

-- ─── 8. Migration 087 shape · location intelligence columns ─────────────────
-- 7 location-intelligence columns on accommodation_business + registries.
ALTER TABLE nex.accommodation_business
  ADD COLUMN IF NOT EXISTS location_confidence  text NOT NULL DEFAULT 'CITY'
    CHECK (location_confidence IN ('EXACT','STREET','AREA','CITY','UNKNOWN')),
  ADD COLUMN IF NOT EXISTS neighbourhood         text NULL,
  ADD COLUMN IF NOT EXISTS street_line           text NULL,
  ADD COLUMN IF NOT EXISTS in_target_zone        boolean NULL,
  ADD COLUMN IF NOT EXISTS geocode_evidence      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS location_verified_at  timestamptz NULL,
  ADD COLUMN IF NOT EXISTS location_source       text NULL;

CREATE INDEX IF NOT EXISTS idx_accom_business_neighbourhood
  ON nex.accommodation_business (neighbourhood) WHERE neighbourhood IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accom_business_location_confidence
  ON nex.accommodation_business (location_confidence);

-- meaningful_area registry (subset of 087 · minimum shape for backward-compat tests)
CREATE TABLE IF NOT EXISTS nex.meaningful_area (
  area_id           text PRIMARY KEY,
  name              text NOT NULL,
  area_kind         text NOT NULL CHECK (area_kind IN ('neighbourhood','corridor','belt','fallback')),
  precedence        int NOT NULL DEFAULT 50,
  country           text NOT NULL,
  city              text NOT NULL,
  centroid_lat      numeric NOT NULL,
  centroid_lng      numeric NOT NULL,
  radius_km         numeric NOT NULL CHECK (radius_km > 0),
  character_tags    text[] NOT NULL DEFAULT '{}',
  description       text NULL,
  source            text NOT NULL,
  provenance        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- geo_landmark registry (subset of 087)
CREATE TABLE IF NOT EXISTS nex.geo_landmark (
  landmark_id       text PRIMARY KEY,
  name              text NOT NULL,
  country           text NOT NULL,
  city              text NOT NULL,
  lat               numeric NOT NULL,
  lng               numeric NOT NULL,
  landmark_type     text NULL,
  source            text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── 9. Migration 088 shape · recovered_evidence JSONB column ───────────────
ALTER TABLE nex.accommodation_business
  ADD COLUMN IF NOT EXISTS recovered_evidence   jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_recovered_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS evidence_source      text NULL;

-- ─── 10. Migration 080 shape · universal business_image (polymorphic) ───────
-- Not accommodation-specific · designed to serve every vertical.
-- Included so A3 tests can prove backward-compat integration.
CREATE TABLE IF NOT EXISTS nex.business_image (
  image_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type        TEXT NOT NULL,
  business_country     TEXT NOT NULL CHECK (business_country ~ '^[A-Z]{2}$'),
  business_ref         TEXT NOT NULL,
  image_type           TEXT NOT NULL
                         CHECK (image_type IN ('OWNER_IMAGE','VERIFIED_REAL','CATEGORY_FALLBACK')),
  image_url            TEXT NOT NULL,
  image_source         TEXT,
  confidence           NUMERIC(3,2) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  approved             BOOLEAN NOT NULL DEFAULT false,
  provenance           JSONB NOT NULL DEFAULT '{}'::jsonb,
  cycle_run_id         UUID REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_type, business_country, business_ref, image_type)
);
CREATE INDEX IF NOT EXISTS idx_business_image_ref
  ON nex.business_image (business_type, business_ref);

-- ─── 11. Migration 081 shape · country column ───────────────────────────────
-- Minimal shape · A2 persister does not depend on this but 080 references it.
ALTER TABLE nex.accommodation_business
  ADD COLUMN IF NOT EXISTS country TEXT NULL;

-- End of fixture. A3 migration adds source_type/source_subtype/language columns
-- + accommodation_room_type + accommodation_attribute_vocabulary + accommodation_attribute
-- + updated persister function on top of this shape.
-- Migration 089 (business_knowledge) is deliberately NOT included — that is
-- A5 evidence-engine territory per Founder resolution 2026-09-07.
