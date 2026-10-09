-- db/migrations/nex_harvest_territory_state.sql
--
-- NEX Discovery Frontier Throughput Fix · additive migration
-- Founder-authorised programme · 2026-09-22.
--
-- Purpose: persistent state for the discovery frontier · replaces the
-- hardcoded rotation loop with a governed queue of
-- (country × region × trade_term × source) tuples that can be prioritised
-- by freshness/productivity and suppressed when exhausted.
--
-- ADDITIVE ONLY. Zero modification to existing tables. Zero effect on
-- G3-24h endurance run (which continues writing to nex.aof_cycle with
-- triggered_by='wave_g3_endurance' · frontier will use
-- triggered_by='wave_frontier_throughput_fix' for its own cycles).

CREATE TABLE IF NOT EXISTS nex.harvest_territory_state (
  territory_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id       UUID NOT NULL,
  country_iso        TEXT NOT NULL,             -- ISO 3166-1 alpha-2
  region_code        TEXT,                       -- optional region/subdivision (e.g. 'GB-SCT' · 'DE-BY')
  region_name        TEXT,                       -- human-readable region
  viewbox            TEXT,                       -- optional Nominatim viewbox '(x1,y1,x2,y2)' bounded search
  trade_slug         TEXT NOT NULL,              -- e.g. 'scaffolding'
  query_term         TEXT NOT NULL,              -- exact term used to query (e.g. 'Gerüstbau')
  query_language     TEXT,                       -- ISO 639-1 (e.g. 'de')
  source_slug        TEXT NOT NULL REFERENCES nex.harvest_source(source_slug) ON DELETE CASCADE,

  status             TEXT NOT NULL DEFAULT 'never_attempted'
                       CHECK (status IN ('never_attempted','attempted','productive','saturated','failing','cooling_down')),
  attempts           INT NOT NULL DEFAULT 0,
  first_attempted_at TIMESTAMPTZ,
  last_attempted_at  TIMESTAMPTZ,
  last_productive_at TIMESTAMPTZ,

  candidates_returned INT NOT NULL DEFAULT 0,    -- cumulative results returned from source (may include duplicates)
  new_candidates      INT NOT NULL DEFAULT 0,    -- cumulative NET-NEW candidates inserted
  duplicate_candidates INT NOT NULL DEFAULT 0,   -- cumulative rediscoveries / already-persisted businesses
  websites_found      INT NOT NULL DEFAULT 0,
  walks_completed     INT NOT NULL DEFAULT 0,
  emails_captured     INT NOT NULL DEFAULT 0,

  consecutive_zero_new INT NOT NULL DEFAULT 0,   -- consecutive attempts returning 0 new_candidates · triggers saturation
  saturation_threshold INT NOT NULL DEFAULT 3,
  refresh_after_seconds INT NOT NULL DEFAULT 86400,  -- 24h · post-saturation, may re-attempt after this

  founder_authorised   BOOLEAN NOT NULL DEFAULT TRUE,
  founder_authorised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE (programme_id, country_iso, region_code, trade_slug, query_term, source_slug)
);

CREATE INDEX IF NOT EXISTS ix_territory_status_priority
  ON nex.harvest_territory_state (status, last_attempted_at NULLS FIRST, new_candidates DESC);

CREATE INDEX IF NOT EXISTS ix_territory_country_source
  ON nex.harvest_territory_state (country_iso, source_slug);

CREATE INDEX IF NOT EXISTS ix_territory_active
  ON nex.harvest_territory_state (programme_id, status)
  WHERE status IN ('never_attempted','attempted','productive');

-- RLS + grants pattern matching prior AOF migrations
ALTER TABLE nex.harvest_territory_state DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.harvest_territory_state TO nex_app_runtime;
  END IF;
END$$;
