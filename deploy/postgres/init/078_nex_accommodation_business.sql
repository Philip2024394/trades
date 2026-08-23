-- 078_nex_accommodation_business.sql
--
-- Task #89 · Phase A · Yogyakarta Accommodation vertical · 2026-08-22
--
-- Doctrine anchors:
--   project_nex_local_directory_engine_architecture_2026_08_22
--   project_nex_task89_accommodation_spec_2026_08_22
--   project_nex_focused_category_directory_architecture_2026_08_22
--   project_nex_walker_stays_pure_acquisition_2026_08_22
--   project_nex_architecture_replaceable_plumbing_and_provable_causality_2026_08_22
--
-- Philip 2026-08-22 Phase A0 decisions (locked · verbatim):
--   Q1 · Data model = A · separate nex.accommodation_business table
--   Q2 · Taxonomy   = B · 7 categories (hotel · villa · guesthouse · homestay · resort · hostel · apartment)
--   Q3 · OSM scope  = extended (tourism=* family + building=hotel · hotel=resort · hotel=villa)
--                     · conservative classification · raw tags preserved as evidence
--
-- Creates FOUR tables (mirrors Food's shape · same six-criteria pipeline pattern):
--   1. nex.accommodation_business                     · canonical record (parallel to nex.food_business)
--   2. nex.accommodation_business_source_snapshot     · raw OSM tags preserved (Task #85 evidence pattern)
--   3. nex.accommodation_business_field_provenance    · per-field trust (Direct-Provenance A · Task #74 pattern)
--   4. nex.accommodation_enrichment_evidence          · candidate evidence (Task #88 Phase 2 pattern)
--
-- What this migration does NOT do:
--   · Does NOT touch nex.food_business or ANY Food-adjacent table
--   · Does NOT auto-populate anything (Walker fills · Phase A first-batch controlled)
--   · Does NOT create promotion tables yet (Phase C · after Walker proves)
--   · Does NOT add HQ pages · category-wheel entries · Brain intents (Phase B)
--
-- Reversible:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.accommodation_enrichment_evidence;
--     DROP TABLE IF EXISTS nex.accommodation_business_field_provenance;
--     DROP TABLE IF EXISTS nex.accommodation_business_source_snapshot;
--     DROP TABLE IF EXISTS nex.accommodation_business;
--   COMMIT;

BEGIN;

-- ── 1. Canonical accommodation record ─────────────────────────────
-- Deliberately uses TEXT + CHECK (not the Food ENUM types) so Accommodation
-- can iterate on its state machine without coupling to Food's enum evolution.
-- Same six-value claim_status pipeline (Phase 4B doctrine binds every vertical).
CREATE TABLE IF NOT EXISTS nex.accommodation_business (
  internal_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Public reference · #AC-YYYY-XXXXX (AC = ACcommodation · parallel to #FL for Food).
  public_listing_ref     TEXT NOT NULL UNIQUE
                           CHECK (public_listing_ref ~ '^#AC-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$'),

  business_name          TEXT NOT NULL,

  -- Q2 · 7 categories · determined by classifier from OSM raw tags with provenance.
  -- Conservative default: 'hotel' when OSM says tourism=hotel with no subtype ·
  -- 'villa' ONLY when tourism=chalet or hotel=villa explicit · never inferred.
  category               TEXT NOT NULL
                           CHECK (category IN ('hotel','villa','guesthouse','homestay','resort','hostel','apartment')),

  -- Task #85 pattern · secondary tokens capture evidence without forcing primary reclassification.
  categories             TEXT[] NOT NULL DEFAULT '{}',

  -- Location · OSM city truth preserved (some Yogyakarta-market rows will be Sleman/Bantul/Magelang).
  address                TEXT,
  city                   TEXT NOT NULL,
  district               TEXT,
  coordinates_lng        NUMERIC,
  coordinates_lat        NUMERIC,

  -- Contact channels (evidence-only · Walker never fabricates).
  phone                  TEXT,
  whatsapp_number        TEXT,
  website                TEXT,
  public_social_links    JSONB,

  -- Accommodation-specific attributes (populated ONLY when OSM provides · never inferred).
  -- Booking availability · price · promotional attributes deliberately EXCLUDED here ·
  -- they would need per-source evidence + admin verification · Phase C+ decision.
  star_rating            INTEGER CHECK (star_rating IS NULL OR (star_rating BETWEEN 1 AND 5)),
  star_rating_source     TEXT,
  room_count             INTEGER CHECK (room_count IS NULL OR room_count > 0),
  amenities              TEXT[] NOT NULL DEFAULT '{}',   -- ["wifi","pool","breakfast"] from OSM tags

  -- Source + provenance (standard NEX pattern).
  source                 TEXT NOT NULL,
  source_reference       TEXT NOT NULL,
  source_ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_checked_at      TIMESTAMPTZ,
  source_licence_terms   TEXT,
  source_updated_at      TIMESTAMPTZ,   -- when OSM element was last edited (Freshness Doctrine)
  last_verified_at       TIMESTAMPTZ,   -- seeded from source_updated_at · updated by re-verify/admin/owner
  verification_source    TEXT,

  dedupe_hash            TEXT NOT NULL,

  -- Pipeline state (same six-value shape as Food · Phase 4B doctrine universal).
  claim_status           TEXT NOT NULL DEFAULT 'discovered'
                           CHECK (claim_status IN ('discovered','verifying','listed','invited','claimed','paying')),
  owner_status           TEXT NOT NULL DEFAULT 'unknown'
                           CHECK (owner_status IN ('unknown','contacted','responded','verified')),

  -- Hero image + rating (evidence-only · never fabricated · same pattern as Food).
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

COMMENT ON TABLE nex.accommodation_business IS
  'Task #89 Phase A · Yogyakarta Accommodation vertical · canonical record. Parallel to nex.food_business · same shape · isolated so Accommodation state machine evolves independently. Populated by Walker (Universal Acquisition Engine · Task #50) via scripts/nex-acquisition/configs/accommodation-yogyakarta.mjs. Every new row lands at claim_status=discovered · never auto-published · admin promotion required to reach listed.';
COMMENT ON COLUMN nex.accommodation_business.category IS
  'Q2 · 7-value taxonomy · determined by conservative classifier from OSM tags · never inferred from vague accommodation-related tag alone.';
COMMENT ON COLUMN nex.accommodation_business.categories IS
  'Task #85 secondary-token pattern · evidence-based tags (e.g. luxury · budget · family · boutique) that never override primary category.';
COMMENT ON COLUMN nex.accommodation_business.amenities IS
  'OSM-sourced amenity tags (wifi · pool · breakfast · air_conditioning) · empty by default · never fabricated · never inferred.';

-- ── 2. Source snapshot · raw OSM tags preserved (Task #85 evidence pattern) ──
CREATE TABLE IF NOT EXISTS nex.accommodation_business_source_snapshot (
  snapshot_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref       TEXT NOT NULL REFERENCES nex.accommodation_business(public_listing_ref) ON DELETE CASCADE,
  source             TEXT NOT NULL,
  source_reference   TEXT NOT NULL,
  captured_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload        JSONB NOT NULL,           -- full OSM element (tags · lat · lng · meta)
  cycle_run_id       UUID REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_accommodation_snapshot_business ON nex.accommodation_business_source_snapshot (business_ref, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_accommodation_snapshot_cycle    ON nex.accommodation_business_source_snapshot (cycle_run_id) WHERE cycle_run_id IS NOT NULL;

COMMENT ON TABLE nex.accommodation_business_source_snapshot IS
  'Task #89 Phase A · raw OSM/source payload preserved · never mutated · Phase C enrichment reads from here (star_rating · room_count · amenities extraction from tags without re-querying OSM).';

-- ── 3. Per-field provenance · Direct-Provenance A (Task #74 pattern) ──────
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
CREATE INDEX IF NOT EXISTS idx_accommodation_provenance_cycle ON nex.accommodation_business_field_provenance (cycle_run_id) WHERE cycle_run_id IS NOT NULL;

COMMENT ON TABLE nex.accommodation_business_field_provenance IS
  'Task #89 Phase A · per-field trust layer + cycle_run_id FK (Direct-Provenance A · Task #74). Trust hierarchy: source_import < nex_curated < admin_verified/owner_verified. admin_rejected recorded but never applied to canonical field (queue suppresses future re-suggestion).';

-- ── 4. Enrichment evidence · Task #88 Phase 2 pattern ─────────────
CREATE TABLE IF NOT EXISTS nex.accommodation_enrichment_evidence (
  evidence_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref       TEXT NOT NULL REFERENCES nex.accommodation_business(public_listing_ref) ON DELETE CASCADE,
  field_name         TEXT NOT NULL,
  value              TEXT,
  value_normalised   TEXT,
  source             TEXT NOT NULL,
  source_type        TEXT NOT NULL,     -- 'official_website' · 'booking_com' · 'other' · etc.
  source_url         TEXT,
  confidence         NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  agent_name         TEXT NOT NULL,
  discovered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  provenance_layer   TEXT NOT NULL DEFAULT 'source_import',
  raw_snippet        TEXT,
  raw_payload        JSONB,
  cycle_run_id       UUID REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_accommodation_evidence_business_field ON nex.accommodation_enrichment_evidence (business_ref, field_name, discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_accommodation_evidence_agent          ON nex.accommodation_enrichment_evidence (agent_name, discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_accommodation_evidence_cycle          ON nex.accommodation_enrichment_evidence (cycle_run_id) WHERE cycle_run_id IS NOT NULL;

COMMENT ON TABLE nex.accommodation_enrichment_evidence IS
  'Task #89 Phase A · candidate evidence (mirrors Task #88 Phase 2 pattern for Food). Phase C admin queue will read from here for adjudication. Empty on Phase A ship · Phase C fills.';

-- ── touch trigger for updated_at on canonical record ──────────────
CREATE OR REPLACE FUNCTION nex.trg_accommodation_business_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accommodation_business_touch_updated_at ON nex.accommodation_business;
CREATE TRIGGER trg_accommodation_business_touch_updated_at
  BEFORE UPDATE ON nex.accommodation_business
  FOR EACH ROW EXECUTE FUNCTION nex.trg_accommodation_business_touch_updated_at();

-- ── Sanity check ──────────────────────────────────────────────────
DO $$
DECLARE t1 BOOLEAN; t2 BOOLEAN; t3 BOOLEAN; t4 BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='accommodation_business')                    INTO t1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='accommodation_business_source_snapshot')    INTO t2;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='accommodation_business_field_provenance')   INTO t3;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='accommodation_enrichment_evidence')         INTO t4;
  IF NOT t1 THEN RAISE EXCEPTION 'Migration 078 failed: accommodation_business missing'; END IF;
  IF NOT t2 THEN RAISE EXCEPTION 'Migration 078 failed: accommodation_business_source_snapshot missing'; END IF;
  IF NOT t3 THEN RAISE EXCEPTION 'Migration 078 failed: accommodation_business_field_provenance missing'; END IF;
  IF NOT t4 THEN RAISE EXCEPTION 'Migration 078 failed: accommodation_enrichment_evidence missing'; END IF;
  RAISE NOTICE 'Migration 078 complete: 4 accommodation tables + indexes + touch trigger in place';
END $$;

COMMIT;
