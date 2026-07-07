-- Business Hub snapshot cache — event-driven invalidation.
--
-- One row per merchant. The Hub page reads from here first (~1 query
-- + a fresh flag check). If stale or missing, live aggregator runs +
-- writes back. Event subscribers invalidate on any counter-affecting
-- event.
--
-- We keep the last snapshot even when stale — the Hub page uses it as
-- fast-fallback while the recompute runs in the background.

BEGIN;

CREATE TABLE IF NOT EXISTS os_business_hub_snapshots (
  merchant_id uuid PRIMARY KEY,
  snapshot jsonb NOT NULL,                -- serialised BusinessHubSnapshot
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_stale boolean NOT NULL DEFAULT false,
  computed_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,
  invalidation_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_business_hub_snapshots_stale_idx
  ON os_business_hub_snapshots (invalidated_at DESC)
  WHERE is_stale;

CREATE OR REPLACE FUNCTION business_hub_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS os_business_hub_snapshots_touch ON os_business_hub_snapshots;
CREATE TRIGGER os_business_hub_snapshots_touch
  BEFORE UPDATE ON os_business_hub_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION business_hub_touch_updated_at();

ALTER TABLE os_business_hub_snapshots ENABLE ROW LEVEL SECURITY;

COMMIT;
