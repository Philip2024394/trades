-- 110_nex_service_business.sql
--
-- NEX Workforce Phase 1 · Philip 2026-08-27 · service business table.
--
-- Doctrine:
--   · One row per public service business (gyms, salons, dentists, opticians,
--     pharmacies, car-repair, ...) discovered by the parametric category walker
--     from public OSM data.
--   · Discovery ≠ Outreach · zero automatic contact · owner-status guard on
--     enrichment writes.
--   · Same persistence contract as food_business / accommodation_business:
--     worker_id + cycle_run_id attribution · public_listing_ref natural key ·
--     ON CONFLICT DO NOTHING · Universal Image Doctrine for hero_image_url.
--
-- Categories in scope (Phase 1 · registered in data/nex-job-registry.json):
--   gyms · salons · dentists · opticians · pharmacies · car-repair
--
-- Adding a service category = one entry in data/nex-job-registry.json plus
-- (if the CHECK constraint below rejects it) one added value to the category
-- CHECK list. New categories in the same category-family need NO schema change.
--
-- Reversible:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.service_business_field_provenance;
--     DROP TABLE IF EXISTS nex.service_business_source_snapshot;
--     DROP TABLE IF EXISTS nex.service_business;
--   COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS nex.service_business (
  internal_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Public reference · #SB-YYYY-XXXXX (SB = ServiceBusiness · parallel to #FL / #AC).
  public_listing_ref     TEXT NOT NULL UNIQUE
                           CHECK (public_listing_ref ~ '^#SB-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$'),

  business_name          TEXT NOT NULL,

  -- Job Registry category slug · MUST match data/nex-job-registry.json entries.
  -- Extend the CHECK when adding new service categories (Phase 2+).
  category_slug          TEXT NOT NULL
                           CHECK (category_slug IN (
                             'gyms', 'salons', 'dentists', 'opticians',
                             'pharmacies', 'car-repair'
                           )),

  -- Secondary evidence tags (OSM raw tags · never fabricated).
  categories             TEXT[] NOT NULL DEFAULT '{}',

  -- Location.
  address                TEXT,
  city                   TEXT NOT NULL,
  district               TEXT,
  coordinates_lng        NUMERIC,
  coordinates_lat        NUMERIC,

  -- Contact channels (evidence-only · walker never fabricates).
  phone                  TEXT,
  whatsapp_number        TEXT,
  website                TEXT,
  public_social_links    JSONB,

  -- Provenance.
  source                 TEXT NOT NULL,            -- 'osm_overpass' etc.
  source_reference       TEXT,                     -- OSM element ref e.g. "node/12345"
  source_licence_terms   TEXT,
  source_updated_at      TIMESTAMPTZ,              -- when source last edited the underlying record

  -- Freshness doctrine.
  last_verified_at       TIMESTAMPTZ,
  verification_source    TEXT,

  -- Discovery ≠ Outreach guard · enrichment MUST NOT overwrite when 'verified'.
  owner_status           TEXT,                     -- NULL | 'contacted' | 'verified' | 'declined'

  -- Denormalised hero image · fast HQ/directory lookup · full history in nex.business_image.
  hero_image_url         TEXT,

  -- Attribution (Task #48 P1 pattern).
  worker_id              TEXT,
  cycle_run_id           UUID,

  -- Listing lifecycle (Task #23 ADR-0023 defaults · seeds are `listed / unclaimed / unverified / public`).
  status                 TEXT NOT NULL DEFAULT 'listed'
                           CHECK (status IN ('listed', 'archived', 'suspended')),
  claimed                BOOLEAN NOT NULL DEFAULT false,
  verified               BOOLEAN NOT NULL DEFAULT false,
  visibility             TEXT NOT NULL DEFAULT 'public'
                           CHECK (visibility IN ('public', 'admin_only', 'hidden')),

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query patterns (Phase 1 · HQ workforce page + admin directory):
--   · WHERE category_slug = 'gyms' AND city = 'Jakarta' → per-job-per-city browse
--   · WHERE cycle_run_id = ... → walker's own newly-inserted rows
--   · WHERE last_verified_at < now() - interval '30d' → re-verify candidates
CREATE INDEX IF NOT EXISTS idx_service_business_category_city
  ON nex.service_business (category_slug, city);
CREATE INDEX IF NOT EXISTS idx_service_business_cycle_run
  ON nex.service_business (cycle_run_id);
CREATE INDEX IF NOT EXISTS idx_service_business_last_verified
  ON nex.service_business (last_verified_at NULLS FIRST);

-- Duplicate-source guard: same source + source_reference (OSM element) can only
-- exist once regardless of what public_listing_ref is chosen for it. Matches the
-- ON CONFLICT DO NOTHING pattern used by walkers.
--
-- Philip 2026-08-27 · MUST be a real UNIQUE CONSTRAINT (not a partial index)
-- because Postgres ON CONFLICT (source, source_reference) does not automatically
-- select partial indexes. Walkers always populate source_reference so the
-- practical difference is nil, but a real constraint lets ON CONFLICT resolve.
ALTER TABLE nex.service_business
  DROP CONSTRAINT IF EXISTS ux_service_business_source_ref;
ALTER TABLE nex.service_business
  ADD CONSTRAINT ux_service_business_source_ref
  UNIQUE (source, source_reference);

COMMENT ON TABLE nex.service_business IS
  'NEX Workforce Phase 1 · public service businesses discovered by the parametric category walker (data/nex-job-registry.json). Doctrine mirrors food_business + accommodation_business: Discovery ≠ Outreach · owner_status guard · worker attribution · natural-key dedup.';

-- Raw source-snapshot table (matches accommodation/food pattern · preserves
-- untouched OSM tags for later re-classification without re-fetching).
CREATE TABLE IF NOT EXISTS nex.service_business_source_snapshot (
  snapshot_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref           TEXT NOT NULL,             -- FK-ish to service_business.public_listing_ref
  source                 TEXT NOT NULL,
  source_reference       TEXT NOT NULL,
  raw_payload            JSONB NOT NULL,            -- Overpass element or provider raw response
  captured_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  worker_id              TEXT,
  cycle_run_id           UUID
);
CREATE INDEX IF NOT EXISTS idx_sb_snapshot_business_ref
  ON nex.service_business_source_snapshot (business_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sb_snapshot_source_ref
  ON nex.service_business_source_snapshot (source, source_reference);

COMMENT ON TABLE nex.service_business_source_snapshot IS
  'Preserved raw payloads · one row per (source, source_reference) · enables future re-classification without re-fetching. Same pattern as food_business_source_snapshot / accommodation_business_source_snapshot.';

COMMIT;
