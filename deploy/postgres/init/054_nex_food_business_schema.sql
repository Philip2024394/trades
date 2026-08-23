-- 054_nex_food_business_schema.sql
--
-- NEX Food Discovery Yogyakarta V1 · Business record + provenance schema.
-- Phase 1 of the 8-phase Yogyakarta Food Acquisition Pipeline (Philip 2026-08-21
-- greenlight to open Priority 4).
--
-- Motivation
--   Food Directory needs a repeatable acquisition pipeline · not manual card
--   creation for hundreds of restaurants. This migration lands the master
--   business record schema. Subsequent phases (Yogyakarta Open Data importer,
--   dedupe layer, verification workflow, WhatsApp outreach engine, claim flow,
--   owner dashboard, HQ dashboard) all read/write against this table.
--
-- What ships in this migration
--   1  One new schema-qualified table: nex.food_business
--   2  Two enum types: nex_food_claim_status · nex_food_owner_status (per
--      Philip 2026-08-21 · two separate status fields · don't conflate)
--   3  Indexes for dedupe (dedupeHash), city partition, and claim/owner status
--      lookups (used by HQ dashboard funnel in Phase 8)
--   4  updated_at trigger to keep the audit column honest
--
-- Field list (Philip-confirmed 2026-08-21)
--   IDENTITY: internal_id · public_listing_ref (#FL-XXX-YYYY-ZZZZ)
--   BUSINESS: business_name · category · address · city · district ·
--             coordinates · phone (public) · whatsapp_number (outreach only ·
--             NOT the identity per Philip) · website · public_social_links ·
--             opening_information
--   PROVENANCE: source · source_reference · source_ingested_at ·
--               source_checked_at · source_licence_terms
--   DEDUPE: dedupe_hash (indexed)
--   STATUS (two separate fields): claim_status · owner_status
--   IMAGERY (external URLs only · NEVER blobs): hero_image_url ·
--            hero_image_source · hero_image_approved · hero_image_provenance
--   METRICS (source-attributed · never fabricated): rating · rating_source ·
--            review_count · review_count_source
--   AUDIT: created_at · updated_at · created_by
--
-- Doctrine references
--   project_nex_food_discovery_yogyakarta_v1_2026_08_21 (this pipeline is the
--     Priority 4 immediate milestone)
--   project_nex_business_acquisition_pipeline_2026_08_21 (this table implements
--     the universal Business record shape)
--   project_nex_owner_provenanced_pricing_2026_08_20 (dishes/prices ARE NOT
--     in this table · they live in a separate nex.food_dish table in Phase 7,
--     owner-provenanced only)
--   feedback_nex_ram_aware_development_2026_08_21 (hero_image_url is a text
--     column · binaries live external in Supabase Storage / ImageKit · Phase 7
--     wires the Supabase Storage upload flow)
--
-- Behavior gate
--   Table is created empty. No application code reads or writes to it until
--   Phase 2 (the Yogyakarta Open Data importer) lands. Safe to apply repeatedly.
--
-- Reversible
--   BEGIN;
--   DROP TABLE IF EXISTS nex.food_business CASCADE;
--   DROP TYPE IF EXISTS nex_food_owner_status;
--   DROP TYPE IF EXISTS nex_food_claim_status;
--   COMMIT;

-- ---------------------------------------------------------------------------
-- 0 · Schema + extensions
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS nex;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1 · Enum types · two separate status fields (Philip 2026-08-21)
-- ---------------------------------------------------------------------------
--
-- claim_status: listing-side · what NEX sees about the listing
--   discovered → verifying → listed → invited → claimed → paying
--
-- owner_status: owner-side · what NEX knows about the owner directly
--   unknown → contacted → responded → verified
--
-- These are DIFFERENT concerns. An owner can be `contacted` while claim is
-- still `listed` (invitation sent, no claim yet). Don't conflate.

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nex_food_claim_status') THEN
    CREATE TYPE nex_food_claim_status AS ENUM (
      'discovered',
      'verifying',
      'listed',
      'invited',
      'claimed',
      'paying'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nex_food_owner_status') THEN
    CREATE TYPE nex_food_owner_status AS ENUM (
      'unknown',
      'contacted',
      'responded',
      'verified'
    );
  END IF;
END $body$;

-- ---------------------------------------------------------------------------
-- 2 · Table: nex.food_business
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.food_business (
  -- IDENTITY
  internal_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_listing_ref     text UNIQUE NOT NULL,   -- format: #FL-YYYY-XXXXX (Crockford Base32 · shareable)

  -- BUSINESS
  business_name          text NOT NULL,
  category               text NOT NULL,
  address                text,
  city                   text NOT NULL DEFAULT 'Yogyakarta',   -- first-class dimension · V1 = Yogyakarta only
  district               text,
  coordinates_lng        numeric(9,6),           -- longitude (null allowed)
  coordinates_lat        numeric(8,6),           -- latitude  (null allowed)
  phone                  text,                   -- public phone
  whatsapp_number        text,                   -- separate outreach channel · NOT the business identity
  website                text,
  public_social_links    jsonb,                  -- { instagram, facebook, tiktok, ... }
  opening_information    jsonb,                  -- { mon: {open, close}, tue: {...}, ... }

  -- PROVENANCE (per pinned Business Acquisition Pipeline doctrine)
  source                 text NOT NULL,          -- e.g. 'yogyakarta_open_data_2024'
  source_reference       text,                   -- permit ID, URL, etc.
  source_ingested_at     timestamptz NOT NULL DEFAULT now(),
  source_checked_at      timestamptz,
  source_licence_terms   text,                   -- captured verbatim from source ToS

  -- DEDUPE
  dedupe_hash            text NOT NULL,          -- name-norm + address-norm + phone-last-6 + coord-rounded

  -- STATUS (two separate fields · Philip 2026-08-21)
  claim_status           nex_food_claim_status NOT NULL DEFAULT 'discovered',
  owner_status           nex_food_owner_status NOT NULL DEFAULT 'unknown',

  -- IMAGERY (external URLs only · NEVER blobs · per RAM-aware doctrine)
  hero_image_url         text,                   -- ImageKit / Supabase Storage / owner CDN URL
  hero_image_source      text,                   -- 'nex_curated_v1' | 'owner_uploaded' | 'owner_authorised'
  hero_image_approved    boolean NOT NULL DEFAULT false,
  hero_image_provenance  jsonb,                  -- { approved_by_note, approved_at, ... }

  -- METRICS (source-attributed · never fabricated)
  rating                 numeric(2,1),
  rating_source          text,
  review_count           integer,
  review_count_source    text,

  -- AUDIT
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             text,                   -- e.g. 'yogyakarta_open_data_importer_v1'

  -- CONSTRAINTS
  CONSTRAINT nex_food_business_category_check
    CHECK (category IN ('restaurant', 'coffee-cafe', 'ice-cream-dessert', 'fast-food')),
  CONSTRAINT nex_food_business_public_ref_format_check
    CHECK (public_listing_ref ~ '^#FL-[0-9]{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$'),
  CONSTRAINT nex_food_business_rating_range_check
    CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  CONSTRAINT nex_food_business_review_count_nonneg_check
    CHECK (review_count IS NULL OR review_count >= 0)
);

COMMENT ON TABLE nex.food_business IS
  'NEX Food acquisition pipeline · master business record. Feeds the Food Directory + owner claim + HQ funnel. Per pinned doctrine: category-representative imagery only (no forced attribution), owner-provenanced pricing only (dishes live in separate nex.food_dish table in Phase 7).';

COMMENT ON COLUMN nex.food_business.internal_id IS 'Private UUID · never exposed to UI/URL/API/logs.';
COMMENT ON COLUMN nex.food_business.public_listing_ref IS 'Shareable stable reference · format #FL-YYYY-XXXXX Crockford Base32.';
COMMENT ON COLUMN nex.food_business.whatsapp_number IS 'Outreach channel only · MUST NOT be treated as the business identity (Philip 2026-08-21).';
COMMENT ON COLUMN nex.food_business.dedupe_hash IS 'Composite hash: name-normalised + address-normalised + phone-last-6 + coord-rounded. Test case: Tempo Gelato vs Tempo Gelato Jogja must resolve to the same business when address/phone/coord match.';
COMMENT ON COLUMN nex.food_business.claim_status IS 'Listing-side status: discovered/verifying/listed/invited/claimed/paying. Different from owner_status (which tracks owner-side contact state).';
COMMENT ON COLUMN nex.food_business.owner_status IS 'Owner-side status: unknown/contacted/responded/verified. Different from claim_status. Both progress independently.';
COMMENT ON COLUMN nex.food_business.hero_image_url IS 'External URL only · never a blob. Supabase Storage / ImageKit / owner-authorised CDN. Per pinned RAM-aware doctrine.';

-- ---------------------------------------------------------------------------
-- 3 · Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_nex_food_business_dedupe_hash
  ON nex.food_business (dedupe_hash);

CREATE INDEX IF NOT EXISTS idx_nex_food_business_city_category
  ON nex.food_business (city, category);

CREATE INDEX IF NOT EXISTS idx_nex_food_business_claim_status
  ON nex.food_business (claim_status);

CREATE INDEX IF NOT EXISTS idx_nex_food_business_owner_status
  ON nex.food_business (owner_status);

CREATE INDEX IF NOT EXISTS idx_nex_food_business_source
  ON nex.food_business (source);

CREATE INDEX IF NOT EXISTS idx_nex_food_business_business_name_lower
  ON nex.food_business ((lower(business_name)));

-- Coordinate lookup for future "near me" search (Priority 4+ · not V1 substring)
CREATE INDEX IF NOT EXISTS idx_nex_food_business_coords
  ON nex.food_business (coordinates_lat, coordinates_lng)
  WHERE coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4 · updated_at trigger
-- ---------------------------------------------------------------------------

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
