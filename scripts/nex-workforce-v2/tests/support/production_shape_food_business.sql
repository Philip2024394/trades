-- Portable test fixture · replicates Project B nex.food_business shape.
-- ============================================================================
-- Slice 1h R2 · Production-Reality Reconciliation · 2026-09-04
--
-- This file mirrors Project B's actual nex.food_business schema (50 columns,
-- CHECK constraints, defaults, FK to worker_cycle_run) so that portable tests
-- can prove Slice 1h R2 works against the production shape, not the reduced
-- portable subset that the older 054 base migration created.
--
-- Used ONLY by the portable Slice 1h R2 test suite's beforeAll. Never applied
-- to Project B (Project B already has this schema).
--
-- Applied via psql at the start of the Slice 1h R2 test file.

-- ─── prereqs ────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS nex;
-- Slice 4.1 (2026-09-04): pgcrypto must live in `extensions` (matches Supabase
-- Project B convention). Portable rehearsals installed pgcrypto into `public`
-- historically · which masked the production-shape defect that surfaced in
-- Gate 5A cycle #3 (`function public.digest(text, unknown) does not exist`).
-- This fixture now reproduces the Supabase layout so the class of defect is
-- caught permanently.
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

-- ─── enums (from 054) ───────────────────────────────────────────────────────
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='nex_food_claim_status' AND n.nspname='nex') THEN
    CREATE TYPE nex.nex_food_claim_status AS ENUM (
      'discovered','verifying','listed','invited','claimed','paying'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='nex_food_owner_status' AND n.nspname='nex') THEN
    CREATE TYPE nex.nex_food_owner_status AS ENUM (
      'unknown','contacted','responded','verified'
    );
  END IF;
END $body$;

-- ─── worker_cycle_run FK target (production has this from older workforce v1) ─
-- Minimal fixture so the FK is satisfiable; production has richer columns.
CREATE TABLE IF NOT EXISTS nex.worker_cycle_run (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id    text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);

-- ─── food_business drop + recreate at production shape (50 columns) ─────────
DROP TABLE IF EXISTS nex.food_business CASCADE;

CREATE TABLE nex.food_business (
  internal_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_listing_ref     text NOT NULL,
  business_name          text NOT NULL,
  category               text NOT NULL,
  address                text,
  city                   text NOT NULL DEFAULT 'Yogyakarta',
  district               text,
  coordinates_lng        numeric,
  coordinates_lat        numeric,
  phone                  text,
  whatsapp_number        text,
  website                text,
  public_social_links    jsonb,
  opening_information    jsonb,
  source                 text NOT NULL,
  source_reference       text,
  source_ingested_at     timestamptz NOT NULL DEFAULT now(),
  source_checked_at      timestamptz,
  source_licence_terms   text,
  dedupe_hash            text NOT NULL,
  claim_status           nex.nex_food_claim_status NOT NULL DEFAULT 'discovered',
  owner_status           nex.nex_food_owner_status NOT NULL DEFAULT 'unknown',
  hero_image_url         text,
  hero_image_source      text,
  hero_image_approved    boolean NOT NULL DEFAULT false,
  hero_image_provenance  jsonb,
  rating                 numeric,
  rating_source          text,
  review_count           integer,
  review_count_source    text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             text,
  -- Additional production columns (from migrations 075, 105, and others · portable-shape mirror)
  source_updated_at      timestamptz,
  last_verified_at       timestamptz,
  verification_source    text,
  categories             text[] NOT NULL DEFAULT '{}',
  country                text NOT NULL,
  location_confidence    text NOT NULL DEFAULT 'CITY',
  neighbourhood          text,
  street_line            text,
  in_target_zone         boolean,
  geocode_evidence       jsonb NOT NULL DEFAULT '{}'::jsonb,
  location_verified_at   timestamptz,
  location_source        text,
  recovered_evidence     jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_recovered_at  timestamptz,
  evidence_source        text,
  worker_id              text,
  cycle_run_id           uuid REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL,

  -- Constraints (from 054 + later migrations)
  CONSTRAINT food_business_public_listing_ref_key UNIQUE (public_listing_ref),
  CONSTRAINT nex_food_business_category_check
    CHECK (category IN ('restaurant', 'coffee-cafe', 'ice-cream-dessert', 'fast-food')),
  CONSTRAINT nex_food_business_public_ref_format_check
    CHECK (public_listing_ref ~ '^#FL-[0-9]{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$'),
  CONSTRAINT nex_food_business_rating_range_check
    CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  CONSTRAINT nex_food_business_review_count_nonneg_check
    CHECK (review_count IS NULL OR review_count >= 0),
  CONSTRAINT food_business_country_iso_check
    CHECK (country ~ '^[A-Z]{2}$'),
  CONSTRAINT food_business_location_confidence_check
    CHECK (location_confidence IN ('EXACT', 'STREET', 'AREA', 'CITY', 'UNKNOWN'))
);

-- Production-shape indexes
CREATE INDEX idx_nex_food_business_dedupe_hash          ON nex.food_business (dedupe_hash);
CREATE INDEX idx_nex_food_business_city_category        ON nex.food_business (city, category);
CREATE INDEX idx_nex_food_business_claim_status         ON nex.food_business (claim_status);
CREATE INDEX idx_nex_food_business_owner_status         ON nex.food_business (owner_status);
CREATE INDEX idx_nex_food_business_source               ON nex.food_business (source);
CREATE INDEX idx_nex_food_business_business_name_lower  ON nex.food_business ((lower(business_name)));
CREATE INDEX idx_nex_food_business_coords ON nex.food_business (coordinates_lat, coordinates_lng)
  WHERE coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL;
CREATE INDEX ix_food_business_source_ref ON nex.food_business (source, source_reference)
  WHERE source_reference IS NOT NULL;
CREATE INDEX idx_food_business_categories_gin ON nex.food_business USING gin (categories);
CREATE INDEX idx_food_business_cycle_run
  ON nex.food_business (cycle_run_id) WHERE cycle_run_id IS NOT NULL;
CREATE INDEX idx_food_business_worker_id
  ON nex.food_business (worker_id) WHERE worker_id IS NOT NULL;
CREATE INDEX idx_food_business_location_confidence     ON nex.food_business (location_confidence);
CREATE INDEX idx_food_business_neighbourhood
  ON nex.food_business (neighbourhood) WHERE neighbourhood IS NOT NULL;
CREATE INDEX idx_food_business_evidence_source
  ON nex.food_business (evidence_source) WHERE evidence_source IS NOT NULL;

-- updated_at trigger (from 054)
CREATE OR REPLACE FUNCTION nex.food_business_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $body$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS trg_nex_food_business_touch_updated_at ON nex.food_business;
CREATE TRIGGER trg_nex_food_business_touch_updated_at
  BEFORE UPDATE ON nex.food_business
  FOR EACH ROW EXECUTE FUNCTION nex.food_business_touch_updated_at();

-- ─── application roles (portable fixture · mirrors Project B pattern) ───────
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_brain_app') THEN
    CREATE ROLE nex_brain_app NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_social_app') THEN
    CREATE ROLE nex_social_app NOLOGIN NOBYPASSRLS;
  END IF;
END $body$;

-- Existing production-style unrestricted CRUD grants (must survive Slice 1h R2 apply)
GRANT USAGE ON SCHEMA nex TO nex_brain_app, nex_social_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex.food_business TO nex_brain_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex.food_business TO nex_social_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA nex TO nex_brain_app, nex_social_app;

-- Seed data lives in the test's beforeEach so it can be re-seeded after
-- TRUNCATE. This DDL-only fixture must remain idempotent across test runs.
