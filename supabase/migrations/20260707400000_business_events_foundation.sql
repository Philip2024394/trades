-- G0 · Business Events, Projections, Memory — the foundation.
--
-- Three tables, one direction of flow:
--
--   business_events   →   event_projections   →   memory_records
--    (what happened)     (what we did with it)   (what we now know)
--
-- Every future feature (publications, Gold Path tasks, website
-- live-feed, campaigns) subscribes to business_events by registering
-- a projection handler. Nothing bypasses this pipeline.

BEGIN;

-- =========================================================================
-- 1. Business Events — append-only, idempotent, the atomic write path.
-- =========================================================================

CREATE TABLE IF NOT EXISTS business_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  -- Structured taxonomy. New event types are added here; unknown
  -- types are rejected by the API layer, not the DB, so we can add
  -- new types without a migration.
  event_type text NOT NULL,
  -- Free-form payload — shape is per event_type.
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- What the AI understood from the payload (photos → detected trade
  -- + materials + stage + quality, review → sentiment + keywords).
  -- May be null on emit; populated by an async understanding worker.
  ai_understanding jsonb,
  -- When it happened in the real world (may differ from created_at).
  occurred_at timestamptz NOT NULL DEFAULT now(),
  -- Where the event came from — for auditing + debugging.
  source text NOT NULL DEFAULT 'app',
  -- Client-supplied de-dupe key. When the same key is re-emitted for
  -- the same merchant, the emit is a no-op returning the existing
  -- event. Enables safe retries from mobile clients.
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_events_idempotency_unique
  ON business_events (merchant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_events_merchant_type_time_idx
  ON business_events (merchant_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS business_events_payload_gin_idx
  ON business_events USING gin (event_payload jsonb_path_ops);

-- =========================================================================
-- 2. Event Projections — one event fans out to many downstream outcomes.
-- =========================================================================

CREATE TABLE IF NOT EXISTS event_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES business_events(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  projection_type text NOT NULL,
  -- Pointer to whatever the projection wrote (memory_record_id,
  -- publication_id, gold_path_task_id, etc.).
  target_ref jsonb,
  status text NOT NULL DEFAULT 'queued',
  -- Human-readable reason for held / skipped / failed. Shown to the
  -- merchant in the activity feed so they know WHY something didn't
  -- happen.
  reason text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (status IN ('queued', 'running', 'done', 'held', 'failed', 'skipped'))
);

-- One projection type may only run ONCE per event — prevents
-- double-writes if the dispatcher re-fires an event.
CREATE UNIQUE INDEX IF NOT EXISTS event_projections_dedupe_idx
  ON event_projections (event_id, projection_type);

CREATE INDEX IF NOT EXISTS event_projections_merchant_lookup_idx
  ON event_projections (merchant_id, projection_type, status, created_at DESC);

-- =========================================================================
-- 3. Memory Records — the durable business archive (Tier 3).
-- =========================================================================

CREATE TABLE IF NOT EXISTS memory_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  record_type text NOT NULL,
    -- 'job' | 'customer' | 'material_used' | 'technique' |
    -- 'certification' | 'staff_member' | 'service' | ...
  -- Structured facets — this is what makes memory searchable at
  -- SQL-first speed. Every future record must populate the facets it
  -- knows about.
  facets jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Denormalised location fields — cheaper than a postgis geography
  -- for the common "same postcode district" filter. Full postgis
  -- upgrade path lives in a later migration if we need proximity
  -- queries.
  postcode text,
  latitude double precision,
  longitude double precision,
  -- Which events built this record. Appended to on every update.
  linked_event_ids uuid[] NOT NULL DEFAULT '{}',
  -- Embedding column reserved for the future NL-search upgrade;
  -- currently unused. When we install pgvector we ALTER TABLE ADD
  -- COLUMN embedding vector(1536).
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_records_merchant_type_idx
  ON memory_records (merchant_id, record_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS memory_records_facets_gin_idx
  ON memory_records USING gin (facets jsonb_path_ops);

CREATE INDEX IF NOT EXISTS memory_records_postcode_idx
  ON memory_records (merchant_id, postcode);

-- Touch updated_at on writes.
CREATE OR REPLACE FUNCTION memory_records_touch_updated()
  RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS memory_records_touch_updated ON memory_records;
CREATE TRIGGER memory_records_touch_updated
  BEFORE UPDATE ON memory_records
  FOR EACH ROW
  EXECUTE FUNCTION memory_records_touch_updated();

-- =========================================================================
-- 4. RLS — merchants read + write their own; service role has full access.
-- =========================================================================

ALTER TABLE business_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_events_merchant_rw ON business_events;
CREATE POLICY business_events_merchant_rw ON business_events
  FOR ALL USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());
DROP POLICY IF EXISTS business_events_service_role ON business_events;
CREATE POLICY business_events_service_role ON business_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS event_projections_merchant_r ON event_projections;
CREATE POLICY event_projections_merchant_r ON event_projections
  FOR SELECT USING (merchant_id = auth.uid());
DROP POLICY IF EXISTS event_projections_service_role ON event_projections;
CREATE POLICY event_projections_service_role ON event_projections
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS memory_records_merchant_r ON memory_records;
CREATE POLICY memory_records_merchant_r ON memory_records
  FOR SELECT USING (merchant_id = auth.uid());
DROP POLICY IF EXISTS memory_records_service_role ON memory_records;
CREATE POLICY memory_records_service_role ON memory_records
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
