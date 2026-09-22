-- ═══════════════════════════════════════════════════════════════════
-- NEX 24/7 World Harvest Engine · Wave H2 · Source Registry
-- Founder-authorised programme · 2026-09-22.
--
-- Every source NEX is allowed to harvest from lives here.
-- No source may be added at runtime without a Founder-signed migration.
-- Adding a source to this table alone does NOT expand the PageFetcher
-- allowlist · that remains governed by data/nex-page-fetcher-allowlist.json.
--
-- The registry FEEDS the harvest_job queue via scheduleSourceProbes().
-- This is the H2 → H1 seam · the "not registry-only" guardrail.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS nex.harvest_source (
  source_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_slug                TEXT NOT NULL,                      -- e.g. "osm_overpass_primary"
  source_type                TEXT NOT NULL
                               CHECK (source_type IN (
                                 'public_geographic_data',       -- OSM Overpass etc.
                                 'public_directory',             -- open business directory
                                 'open_index',                   -- open crawl index
                                 'sitemap_crawler',              -- crawl a known sitemap
                                 'structured_json'               -- JSON-LD/Schema.org endpoint
                               )),
  host                       TEXT NOT NULL,                      -- must appear in page-fetcher allowlist
  url_template               TEXT,                                -- placeholders like {country_iso}, {term}
  discovery_method           TEXT NOT NULL
                               CHECK (discovery_method IN (
                                 'overpass_query', 'public_html', 'structured_json', 'sitemap'
                               )),
  -- Scope (empty array = universal · non-empty = restricted to these values)
  country_scope              TEXT[] NOT NULL DEFAULT '{}',
  category_scope             TEXT[] NOT NULL DEFAULT '{}',

  -- Politeness + safety
  robots_policy_required     BOOLEAN NOT NULL DEFAULT TRUE,
  rate_limit_per_minute      INT NOT NULL DEFAULT 6,              -- default 1 request / 10s
  max_bytes                  INT NOT NULL DEFAULT 5242880,        -- 5MB default cap
  per_probe_timeout_ms       INT NOT NULL DEFAULT 15000,

  -- Scheduling
  priority                   INT NOT NULL DEFAULT 100,
  enabled                    BOOLEAN NOT NULL DEFAULT TRUE,
  quarantined_until          TIMESTAMPTZ,                          -- Founder-set OR auto after N failures

  -- Health (updated by executor · never fabricated)
  reliability_score          NUMERIC(4,3) NOT NULL DEFAULT 1.000,  -- 0.000 - 1.000
  consecutive_success        INT NOT NULL DEFAULT 0,
  consecutive_failure        INT NOT NULL DEFAULT 0,
  last_attempt_at            TIMESTAMPTZ,
  last_success_at            TIMESTAMPTZ,
  last_failure_at            TIMESTAMPTZ,
  last_zero_result_at        TIMESTAMPTZ,
  last_yield_at              TIMESTAMPTZ,
  lifetime_probes            BIGINT NOT NULL DEFAULT 0,
  lifetime_businesses        BIGINT NOT NULL DEFAULT 0,
  lifetime_emails            BIGINT NOT NULL DEFAULT 0,

  -- Governance
  founder_signed_at          TIMESTAMPTZ NOT NULL,                 -- MUST NOT be null · no unsigned source
  founder_signed_by          TEXT NOT NULL,                        -- attribution
  provenance_note            TEXT NOT NULL,                        -- why this source was added
  metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_harvest_source_slug
  ON nex.harvest_source (source_slug);

CREATE INDEX IF NOT EXISTS ix_harvest_source_enabled_priority
  ON nex.harvest_source (enabled, priority DESC)
  WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS ix_harvest_source_quarantine
  ON nex.harvest_source (quarantined_until)
  WHERE quarantined_until IS NOT NULL;

-- Governance: founder_signed_at cannot be null · enforced by NOT NULL above.
-- Reliability score bounded to [0, 1]
ALTER TABLE nex.harvest_source DROP CONSTRAINT IF EXISTS ck_harvest_source_reliability_bounded;
ALTER TABLE nex.harvest_source ADD CONSTRAINT ck_harvest_source_reliability_bounded
  CHECK (reliability_score >= 0.000 AND reliability_score <= 1.000);

-- Rate limit must be positive
ALTER TABLE nex.harvest_source DROP CONSTRAINT IF EXISTS ck_harvest_source_rate_limit_positive;
ALTER TABLE nex.harvest_source ADD CONSTRAINT ck_harvest_source_rate_limit_positive
  CHECK (rate_limit_per_minute > 0);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION nex.tg_harvest_source_touch()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS harvest_source_touch ON nex.harvest_source;
CREATE TRIGGER harvest_source_touch
  BEFORE UPDATE ON nex.harvest_source
  FOR EACH ROW EXECUTE FUNCTION nex.tg_harvest_source_touch();

-- ─── Founder-authored seed · matches current PageFetcher allowlist ───
-- Only Overpass mirrors on the allowlist can be seeded here. Anything else
-- requires a Founder-signed migration + allowlist update.
INSERT INTO nex.harvest_source
  (source_slug, source_type, host, url_template, discovery_method,
   country_scope, category_scope,
   robots_policy_required, rate_limit_per_minute, max_bytes, per_probe_timeout_ms,
   priority, enabled, reliability_score,
   founder_signed_at, founder_signed_by, provenance_note)
VALUES
  ('osm_overpass_primary',
   'public_geographic_data',
   'overpass-api.de',
   'https://overpass-api.de/api/interpreter',
   'overpass_query',
   '{}', '{}',
   TRUE, 6, 10485760, 15000,
   100, TRUE, 1.000,
   '2026-09-22T00:00:00Z', 'founder',
   'OSM Overpass primary · open data · on Founder-signed page-fetcher allowlist'),

  ('osm_overpass_swiss_mirror',
   'public_geographic_data',
   'overpass.osm.ch',
   'https://overpass.osm.ch/api/interpreter',
   'overpass_query',
   '{}', '{}',
   TRUE, 6, 5242880, 15000,
   80, TRUE, 1.000,
   '2026-09-22T00:00:00Z', 'founder',
   'OSM Overpass Swiss mirror · fallback · sandbox-reachable · on Founder-signed page-fetcher allowlist')
ON CONFLICT (source_slug) DO NOTHING;

COMMIT;
