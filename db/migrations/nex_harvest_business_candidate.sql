-- ═══════════════════════════════════════════════════════════════════
-- NEX 24/7 World Harvest Engine · Wave H3 · Business Candidate table
-- Founder-authorised programme · 2026-09-22.
--
-- This table is the AUDIT-2026-09-22 FIX.
--
-- Before H3: overpassAdapter counts elements and DISCARDS the actual business
-- list. Post H3: every retained element becomes a durable business_candidate
-- row with full provenance to its originating source_probe job.
--
-- Governance:
--   - website_url is NULLABLE and NEVER fabricated (only populated from
--     the source's real tag; missing website stays NULL)
--   - provenance_url is NOT NULL (must record the exact source URL that
--     produced this candidate)
--   - UNIQUE (source_slug, external_ref) makes re-probe idempotent
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS nex.harvest_business_candidate (
  candidate_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_slug              TEXT NOT NULL,                    -- from harvest_source
  source_probe_job_id      UUID REFERENCES nex.harvest_job(job_id),
  programme_id             UUID,
  country_iso              TEXT NOT NULL,
  term                     TEXT,                             -- the term that surfaced this candidate
  external_ref             TEXT,                             -- e.g. "node/12345" for OSM
  business_name            TEXT NOT NULL,                    -- required · no anonymous candidates
  website_url              TEXT,                             -- NULLABLE · NEVER fabricated
  phone                    TEXT,
  address                  TEXT,
  latitude                 NUMERIC(10,7),
  longitude                NUMERIC(10,7),
  raw_tags                 JSONB NOT NULL DEFAULT '{}'::jsonb,  -- full source tags · re-processable
  provenance_url           TEXT NOT NULL,                    -- exact URL of the source that returned this
  provenance_note          TEXT,

  -- H4-populated fields (kept NULLABLE · zero-fabrication)
  website_walk_job_id      UUID REFERENCES nex.harvest_job(job_id),
  website_walk_status      TEXT
                             CHECK (website_walk_status IS NULL OR website_walk_status IN (
                               'not_applicable',      -- no website_url
                               'queued',              -- job enqueued
                               'walked',              -- H4 walked it
                               'walked_zero_pages',   -- fetched but no useful pages
                               'blocked_by_robots',
                               'blocked_by_governance',
                               'unavailable'
                             )),
  website_walked_at        TIMESTAMPTZ,
  emails_discovered_count  INT NOT NULL DEFAULT 0,

  discovered_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency: same OSM node re-probed in a later cycle refers to same candidate
CREATE UNIQUE INDEX IF NOT EXISTS ux_harvest_business_candidate_external
  ON nex.harvest_business_candidate (source_slug, external_ref)
  WHERE external_ref IS NOT NULL;

-- Country + programme drill-in
CREATE INDEX IF NOT EXISTS ix_harvest_business_candidate_scope
  ON nex.harvest_business_candidate (programme_id, country_iso, discovered_at DESC);

-- Provenance drill-in
CREATE INDEX IF NOT EXISTS ix_harvest_business_candidate_source_probe
  ON nex.harvest_business_candidate (source_probe_job_id);

-- Website-walk queue helper (H4 will read this)
CREATE INDEX IF NOT EXISTS ix_harvest_business_candidate_website_pending
  ON nex.harvest_business_candidate (country_iso)
  WHERE website_url IS NOT NULL AND website_walk_job_id IS NULL;

-- Governance: business_name cannot be blank
ALTER TABLE nex.harvest_business_candidate DROP CONSTRAINT IF EXISTS ck_harvest_bc_name_not_blank;
ALTER TABLE nex.harvest_business_candidate ADD CONSTRAINT ck_harvest_bc_name_not_blank
  CHECK (length(trim(business_name)) > 0);

-- Governance: provenance_url must look like a URL
ALTER TABLE nex.harvest_business_candidate DROP CONSTRAINT IF EXISTS ck_harvest_bc_provenance_url_shape;
ALTER TABLE nex.harvest_business_candidate ADD CONSTRAINT ck_harvest_bc_provenance_url_shape
  CHECK (provenance_url ~ '^https?://');

-- Updated-at trigger
CREATE OR REPLACE FUNCTION nex.tg_harvest_business_candidate_touch()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS harvest_bc_touch ON nex.harvest_business_candidate;
CREATE TRIGGER harvest_bc_touch
  BEFORE UPDATE ON nex.harvest_business_candidate
  FOR EACH ROW EXECUTE FUNCTION nex.tg_harvest_business_candidate_touch();

COMMIT;
