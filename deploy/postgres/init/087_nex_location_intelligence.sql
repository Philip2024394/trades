-- 087_nex_location_intelligence.sql
--
-- NEX Location Intelligence · Path C · Phase C1 schema
-- 2026-08-23 · WRITTEN BUT NOT APPLIED · awaits Philip greenlight after dry-run review
--
-- Doctrine anchors:
--   project_nex_path_c_location_intelligence_greenlit_2026_08_23
--   project_nex_location_intelligence_2026_08_23
--   project_nex_location_distance_intelligence_precision_matched_to_confidence_2026_08_23
--   project_nex_business_knowledge_object_three_layer_2026_08_23
--
-- What this migration does (all additive · non-breaking):
--   1. Adds 7 location-intelligence columns to nex.food_business and nex.accommodation_business
--   2. Creates nex.meaningful_area registry (Malioboro · Prawirotaman · Kaliurang · Borobudur · Prambanan · Yogya-core)
--   3. Creates nex.geo_landmark registry (~30 Yogyakarta landmarks)
--
-- What this migration does NOT do:
--   · Populate the new columns (that's the enrichment worker's job · gated by separate greenlight)
--   · Modify any existing row
--   · Publish anything to customer directory
--   · Change the ≥90 threshold
--
-- Default `location_confidence = 'CITY'` for existing rows is the honest starting point:
-- we know they're in Yogyakarta but we haven't yet classified any into meaningful areas.
--
-- Rollback path documented at the bottom.

BEGIN;

-- ── 1. Add location-intelligence columns to nex.food_business ──────────
ALTER TABLE nex.food_business
    ADD COLUMN IF NOT EXISTS location_confidence  text NOT NULL DEFAULT 'CITY'
        CHECK (location_confidence IN ('EXACT','STREET','AREA','CITY','UNKNOWN')),
    ADD COLUMN IF NOT EXISTS neighbourhood         text NULL,
    ADD COLUMN IF NOT EXISTS street_line           text NULL,
    ADD COLUMN IF NOT EXISTS in_target_zone        boolean NULL,
    ADD COLUMN IF NOT EXISTS geocode_evidence      jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS location_verified_at  timestamptz NULL,
    ADD COLUMN IF NOT EXISTS location_source       text NULL;

CREATE INDEX IF NOT EXISTS idx_food_business_neighbourhood
    ON nex.food_business (neighbourhood) WHERE neighbourhood IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_food_business_location_confidence
    ON nex.food_business (location_confidence);

COMMENT ON COLUMN nex.food_business.location_confidence IS
    'NEX Location Intelligence 5-state · EXACT (verified precise pin) / STREET (street known + coord precise) / AREA (neighbourhood assigned) / CITY (coord in city only) / UNKNOWN (no coord). Default CITY is honest starting point per project_nex_location_intelligence_2026_08_23.';

-- ── 2. Same columns on nex.accommodation_business ──────────────────────
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

COMMENT ON COLUMN nex.accommodation_business.location_confidence IS
    'NEX Location Intelligence 5-state · same semantics as food_business.location_confidence.';

-- ── 3. Meaningful-area registry ─────────────────────────────────────────
--
-- Character-tagged geographic areas that customers ACTUALLY talk about,
-- distinct from administrative boundaries (which stay in the district column).
--
-- Each area has:
--   · centroid + radius_km (soft boundary · classifier uses 1.0× radius = full-confidence,
--     1.5× = reduced-confidence, >1.5× = not assigned)
--   · character_tags for mood-language translation (per Decision Context doctrine)
CREATE TABLE IF NOT EXISTS nex.meaningful_area (
    area_id           text PRIMARY KEY,
    name              text NOT NULL,
    -- area_kind added per Philip 2026-08-23 verbatim: "Don't call the resulting field
    -- 'neighbourhood' if some of these are actually tourist corridors or destination areas."
    -- Doctrine: project_nex_location_area_kind_semantic_doctrine_2026_08_23
    area_kind         text NOT NULL
        CHECK (area_kind IN ('neighbourhood','corridor','belt','fallback')),
    -- precedence: lower number = higher priority when a coord matches multiple areas.
    -- neighbourhood=1 · corridor/belt=2 · fallback=99. Deterministic assignment.
    precedence        int NOT NULL DEFAULT 50,
    country           text NOT NULL,
    city              text NOT NULL,                   -- primary city association
    centroid_lat      numeric NOT NULL,
    centroid_lng      numeric NOT NULL,
    radius_km         numeric NOT NULL CHECK (radius_km > 0),
    character_tags    text[] NOT NULL DEFAULT '{}',
    description       text NULL,
    -- brain_phrasing_hint: natural-language template hint per kind ·
    -- e.g. "in the Prawirotaman neighbourhood" vs "in the Borobudur corridor".
    brain_phrasing_hint text NULL,
    source            text NOT NULL,
    provenance        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meaningful_area_kind_precedence
    ON nex.meaningful_area (area_kind, precedence);

CREATE INDEX IF NOT EXISTS idx_meaningful_area_country_city
    ON nex.meaningful_area (country, city);

COMMENT ON TABLE nex.meaningful_area IS
    'NEX Location Intelligence · customer-facing meaningful areas (Malioboro · Prawirotaman · etc.) with character tags for mood-language translation. NOT admin boundaries — those stay in nex.food_business.district / nex.accommodation_business.district.';

-- ── 4. Landmark registry ────────────────────────────────────────────────
--
-- Named points travellers reason about (attractions · transport · shopping · universities · hospitals).
-- Distances from business to landmark are COMPUTED on-demand (per Distance Intelligence storage doctrine)
-- · this registry only stores the landmark coords + category + associations.
CREATE TABLE IF NOT EXISTS nex.geo_landmark (
    landmark_id            text PRIMARY KEY,
    name                   text NOT NULL,
    category               text NOT NULL
        CHECK (category IN ('attraction','transport','shopping','religious','medical','education','other')),
    country                text NOT NULL,
    city                   text NOT NULL,
    centroid_lat           numeric NOT NULL,
    centroid_lng           numeric NOT NULL,
    meaningful_area_ids    text[] NOT NULL DEFAULT '{}',
    source                 text NOT NULL,
    provenance             jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_landmark_country_city_category
    ON nex.geo_landmark (country, city, category);

COMMENT ON TABLE nex.geo_landmark IS
    'NEX Location Intelligence · landmark registry for Destination Graph + Distance Intelligence. Distances from business to landmark are computed on-demand, never precomputed combinatorially (per Location Intelligence storage doctrine).';

COMMIT;

-- ── ROLLBACK ─────────────────────────────────────────────────────────────
--   BEGIN;
--   DROP INDEX IF EXISTS nex.idx_geo_landmark_country_city_category;
--   DROP TABLE IF EXISTS nex.geo_landmark;
--   DROP INDEX IF EXISTS nex.idx_meaningful_area_country_city;
--   DROP TABLE IF EXISTS nex.meaningful_area;
--   ALTER TABLE nex.accommodation_business
--       DROP COLUMN IF EXISTS location_source,
--       DROP COLUMN IF EXISTS location_verified_at,
--       DROP COLUMN IF EXISTS geocode_evidence,
--       DROP COLUMN IF EXISTS in_target_zone,
--       DROP COLUMN IF EXISTS street_line,
--       DROP COLUMN IF EXISTS neighbourhood,
--       DROP COLUMN IF EXISTS location_confidence;
--   ALTER TABLE nex.food_business
--       DROP COLUMN IF EXISTS location_source,
--       DROP COLUMN IF EXISTS location_verified_at,
--       DROP COLUMN IF EXISTS geocode_evidence,
--       DROP COLUMN IF EXISTS in_target_zone,
--       DROP COLUMN IF EXISTS street_line,
--       DROP COLUMN IF EXISTS neighbourhood,
--       DROP COLUMN IF EXISTS location_confidence;
--   COMMIT;
