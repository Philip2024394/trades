-- deploy/postgres/init/100_nex_provider_rate_governor.sql
--
-- NEX Provider Rate Governor (2026-08-24 · Phase A of workforce scaling).
--
-- Doctrine anchor: project_nex_provider_rate_governor_scaling_2026_08_24
--
-- Two tables:
--   · provider_rate_config · per-provider limits (min_interval_ms · max_concurrent)
--   · provider_rate_lease  · currently-active leases (one row per in-flight request)
--
-- Design principle: the workforce capacity (MAX_SLOTS) is DECOUPLED from
-- provider-side rate limits. 100 workers can wait behind ONE Nominatim slot
-- without either being abusive or wasting slots.
--
-- Additive · reversible.

BEGIN;

CREATE TABLE IF NOT EXISTS nex.provider_rate_config (
  provider           text        PRIMARY KEY,
  min_interval_ms    int         NOT NULL CHECK (min_interval_ms >= 0),
  max_concurrent     int         NOT NULL CHECK (max_concurrent >= 1),
  notes              text                    ,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Seed the two providers we know today. Nominatim's community soft-limit is
-- 1 req/s · we use 1500ms to include our polite delay buffer. Overpass mirrors
-- vary but are best treated as 1-concurrent 2s-interval to avoid bans.
INSERT INTO nex.provider_rate_config (provider, min_interval_ms, max_concurrent, notes) VALUES
  ('nominatim', 1500, 1, 'OSM Nominatim community soft-limit ~1 req/s · 1500ms includes polite delay buffer'),
  ('overpass',  2000, 1, 'OSM Overpass mirrors variable · 2s conservative')
ON CONFLICT (provider) DO NOTHING;

CREATE TABLE IF NOT EXISTS nex.provider_rate_lease (
  lease_id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           text        NOT NULL REFERENCES nex.provider_rate_config(provider),
  walker_id          text        NOT NULL,           -- e.g. 'acquisition:market:Yogyakarta'
  cycle_run_id       uuid                    ,       -- optional link to worker_cycle_run
  acquired_at        timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL DEFAULT (now() + interval '30 seconds'),
  released_at        timestamptz                     -- set on explicit release · null while active
);

CREATE INDEX IF NOT EXISTS idx_prl_active
  ON nex.provider_rate_lease (provider, released_at, expires_at)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prl_walker
  ON nex.provider_rate_lease (walker_id, released_at);

COMMENT ON TABLE nex.provider_rate_config IS
  'Per-provider throttle configuration. Governs how many concurrent leases and how much time must elapse between consecutive lease acquisitions.';

COMMENT ON TABLE nex.provider_rate_lease IS
  'Active + historical lease rows. Any walker calling a provider first acquires a lease · releases on completion/failure. Stale leases past expires_at are treated as released by the governor lib · no manual cleanup required.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.provider_rate_lease;
--     DROP TABLE IF EXISTS nex.provider_rate_config;
--   COMMIT;
