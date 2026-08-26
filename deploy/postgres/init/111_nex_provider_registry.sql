-- 111_nex_provider_registry.sql
--
-- NEX Provider Registry · Discovery Fabric P8 · Foundation A.
-- Philip 2026-08-26 · design spec at docs/nex-fabric/02-provider-abstraction-router-failure.md
--
-- Doctrine anchor: project_nex_walker_production_launch_directive_2026_08_26
--
-- Why this exists (earned): 24h workforce silence (2026-08-25) exposed us to
-- provider-side failure modes with no shared vocabulary. The registry gives us
-- ONE authoritative table of who we call, what they do, what they cost, and
-- what health we've observed. Walkers READ · health probes WRITE · future
-- router READS. Never a provider-evasion mechanism · never bypasses licences
-- or terms.
--
-- P8 scope: table + seeds only. No router · no probe writer · no failover.
-- Those are earned separately, only once telemetry from this proves need.
--
-- Additive · reversible · seed rows guarded with ON CONFLICT DO NOTHING so
-- re-runs are safe and never overwrite operator-tuned rows.
--
-- Reversible:
--   BEGIN;
--     DROP INDEX IF EXISTS nex.idx_provider_registry_caps;
--     DROP INDEX IF EXISTS nex.idx_provider_registry_health;
--     DROP TABLE IF EXISTS nex.provider_registry;
--   COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS nex.provider_registry (
  provider_id            text PRIMARY KEY,
  name                   text NOT NULL,
  kind                   text NOT NULL,               -- geocoding|search|directory|dataset|self-hosted|merchant-submission
  capabilities           text[] NOT NULL DEFAULT '{}',
  geography_scope        jsonb NOT NULL DEFAULT '{}',
  categories_scope       jsonb NOT NULL DEFAULT '{}',
  authentication         text NOT NULL DEFAULT 'none',
  credentials_secret_ref text,
  rate_limit_rps         numeric,
  rate_limit_rpd         integer,
  concurrency_limit      integer NOT NULL DEFAULT 1,
  cost_per_request_usd   numeric(10,6) NOT NULL DEFAULT 0,
  licence_id             text NOT NULL,
  attribution_required   boolean NOT NULL DEFAULT false,
  attribution_template   text,
  freshness_class        text NOT NULL DEFAULT 'realtime',
  reliability_score      smallint NOT NULL DEFAULT 50 CHECK (reliability_score BETWEEN 0 AND 100),
  current_health_state   text NOT NULL DEFAULT 'green'
                         CHECK (current_health_state IN ('green','yellow','red','circuit-open','disabled')),
  terms_url              text NOT NULL,
  last_reviewed_at       timestamptz NOT NULL DEFAULT now(),
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_registry_health
  ON nex.provider_registry (current_health_state, reliability_score DESC);

CREATE INDEX IF NOT EXISTS idx_provider_registry_caps
  ON nex.provider_registry USING gin (capabilities);

COMMENT ON TABLE nex.provider_registry IS
  'NEX Discovery Fabric P8 · authoritative registry of every data provider we call. Walkers READ (via scripts/nex-worker/provider-registry.mjs). Health probes WRITE (future). Router READS (future). Never a provider-evasion mechanism.';

COMMENT ON COLUMN nex.provider_registry.current_health_state IS
  'green|yellow|red|circuit-open|disabled. Only health probes may transition; walkers observe. "disabled" is human-set (no credentials / not provisioned).';

COMMENT ON COLUMN nex.provider_registry.reliability_score IS
  '0-100 EMA of recent cycle outcomes. Written by health probe (future). Read by router (future). Default 50 = unproven.';

COMMENT ON COLUMN nex.provider_registry.cost_per_request_usd IS
  'Used by scripts/nex-worker/cost-oracle.mjs to project spend before a cycle. Zero for free providers · positive for commercial APIs.';

-- Seed rows · five providers spanning the P8 landscape.
-- Kept additive with ON CONFLICT DO NOTHING so re-runs never overwrite tuning.
INSERT INTO nex.provider_registry (
  provider_id, name, kind, capabilities, geography_scope, categories_scope,
  authentication, credentials_secret_ref, rate_limit_rps, rate_limit_rpd,
  concurrency_limit, cost_per_request_usd, licence_id, attribution_required,
  attribution_template, freshness_class, reliability_score, current_health_state,
  terms_url, notes
) VALUES
  (
    'nominatim-public',
    'OSM Nominatim (public)',
    'geocoding',
    ARRAY['geocode','reverse-geocode','places-lookup'],
    '{"countries":["*"]}'::jsonb,
    '{"strong":["food","accommodation","market","transport"]}'::jsonb,
    'none', NULL,
    1, 86400,
    1, 0,
    'ODbL', true,
    '© OpenStreetMap contributors',
    'realtime', 60, 'green',
    'https://operations.osmfoundation.org/policies/nominatim/',
    'OSMF public server · 1 req/s soft-limit is a POLICY floor · never bypass. Fallback (future) → nominatim-self.'
  ),
  (
    'overpass-public-de',
    'OSM Overpass (overpass-api.de)',
    'dataset',
    ARRAY['places-lookup','business-search'],
    '{"countries":["*"]}'::jsonb,
    '{"strong":["food","accommodation","market"]}'::jsonb,
    'none', NULL,
    2, 10000,
    1, 0,
    'ODbL', true,
    '© OpenStreetMap contributors',
    'realtime', 40, 'yellow',
    'https://overpass-api.de/',
    'Community Overpass mirror · frequent 502s (observed 2026-08-25). Yellow reflects real reliability. Fallback (future) → overpass-self.'
  ),
  (
    'nominatim-self',
    'OSM Nominatim (self-hosted)',
    'self-hosted',
    ARRAY['geocode','reverse-geocode','places-lookup'],
    '{"countries":["*"]}'::jsonb,
    '{"strong":["food","accommodation","market","transport"]}'::jsonb,
    'none', NULL,
    50, NULL,
    4, 0,
    'ODbL', true,
    '© OpenStreetMap contributors',
    'realtime', 50, 'disabled',
    'https://operations.osmfoundation.org/policies/nominatim/',
    'Own OSM instance · not-yet-provisioned. Enable once we stand up an EU VM · attribution still required.'
  ),
  (
    'google-places',
    'Google Places API',
    'search',
    ARRAY['business-search','places-lookup','opening-hours','contact-info','photos','reviews'],
    '{"countries":["*"]}'::jsonb,
    '{"strong":["food","accommodation","transport"]}'::jsonb,
    'api-key', NULL,
    100, 100000,
    4, 0.017000,
    'proprietary', false,
    NULL,
    'realtime', 70, 'disabled',
    'https://cloud.google.com/maps-platform/terms',
    'no-credentials-yet. When enabled: budget gate at cost-oracle MUST clear before call. $0.017/Text Search per Google 2026 pricing.'
  ),
  (
    'merchant-submission',
    'NEX merchant submission',
    'merchant-submission',
    ARRAY['business-search','contact-info','opening-hours','photos'],
    '{"countries":["*"]}'::jsonb,
    '{"strong":["food","accommodation","market","transport"]}'::jsonb,
    'none', NULL,
    NULL, NULL,
    1, 0,
    'merchant-consent', false,
    NULL,
    'realtime', 90, 'green',
    'internal-policy',
    'NEX-owned write path · canonical · zero cost · unmatched freshness. Concurrency_limit=1 is placeholder (not really rate-limited).'
  )
ON CONFLICT (provider_id) DO NOTHING;

-- Sanity check · migration must land all 5 seed rows and both indexes.
DO $$
DECLARE
  seed_count int;
  idx_health int;
  idx_caps int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='nex' AND table_name='provider_registry'
  ) THEN
    RAISE EXCEPTION 'Migration 111 failed: nex.provider_registry not created';
  END IF;

  SELECT COUNT(*) INTO seed_count FROM nex.provider_registry
    WHERE provider_id IN (
      'nominatim-public','overpass-public-de','nominatim-self',
      'google-places','merchant-submission'
    );
  IF seed_count < 5 THEN
    RAISE EXCEPTION 'Migration 111 failed: expected 5 seed rows, found %', seed_count;
  END IF;

  SELECT COUNT(*) INTO idx_health FROM pg_indexes
    WHERE schemaname='nex' AND indexname='idx_provider_registry_health';
  SELECT COUNT(*) INTO idx_caps FROM pg_indexes
    WHERE schemaname='nex' AND indexname='idx_provider_registry_caps';
  IF idx_health = 0 OR idx_caps = 0 THEN
    RAISE EXCEPTION 'Migration 111 failed: expected both indexes present (health=%, caps=%)', idx_health, idx_caps;
  END IF;

  RAISE NOTICE 'Migration 111 complete · % seeds · both indexes present', seed_count;
END $$;

COMMIT;
