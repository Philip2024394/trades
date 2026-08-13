-- 049_analytics_rollup_queue.sql
--
-- D6 · Analytics rollup background-worker queue.
--
-- Motivation
--   nex.analytics.ingestEvent() currently does INSERT + N UPSERTs + N
--   recomputes inline. Under load the ingest caller waits on all rollup
--   work. This queue lets the primary INSERT finish fast, then a
--   background worker (cron-tick or dedicated) drains rollup work.
--
-- Behavior gate
--   The queue is populated only when NEX_ANALYTICS_ROLLUP_ASYNC=1 is
--   set in the environment. Default remains the current sync path so
--   this migration is safe to apply without any code changes.
--
-- Reversible: `DROP TABLE nex.analytics_rollup_queue CASCADE`.

CREATE TABLE IF NOT EXISTS nex.analytics_rollup_queue (
  queue_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL,     -- soft ref to nex.analytics_events; not FK (events table may be partitioned later)
  enqueued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  claimed_by        TEXT,
  claimed_at        TIMESTAMPTZ,
  lease_expires_at  TIMESTAMPTZ,
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  completed_at      TIMESTAMPTZ
);

-- Claim index · single row per pending event, ordered by insertion time.
CREATE INDEX IF NOT EXISTS idx_analytics_rollup_queue_pending
  ON nex.analytics_rollup_queue (status, enqueued_at)
  WHERE status = 'pending';

-- Optional dedup: if the same event_id is queued twice within a short
-- window, the worker sees them both — that's fine because rollup UPSERTs
-- are idempotent on (key, event_type). If we later want strict dedup,
-- add a unique index on (event_id) WHERE status='pending'.

CREATE INDEX IF NOT EXISTS idx_analytics_rollup_queue_event
  ON nex.analytics_rollup_queue (event_id);

-- Claim helper · SKIP LOCKED for concurrent workers.
CREATE OR REPLACE FUNCTION nex.claim_analytics_rollup_batch(
  p_worker_id TEXT,
  p_batch_size INT,
  p_lease_seconds INT DEFAULT 60
)
RETURNS SETOF nex.analytics_rollup_queue LANGUAGE plpgsql AS $$
DECLARE
  claimed nex.analytics_rollup_queue;
BEGIN
  FOR claimed IN
    UPDATE nex.analytics_rollup_queue
    SET status = 'processing',
        claimed_by = p_worker_id,
        claimed_at = NOW(),
        lease_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        attempts = attempts + 1
    WHERE queue_id IN (
      SELECT queue_id FROM nex.analytics_rollup_queue
      WHERE status = 'pending'
      ORDER BY enqueued_at
      LIMIT p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  LOOP
    RETURN NEXT claimed;
  END LOOP;
END $$;

-- RLS · service_role only.
ALTER TABLE nex.analytics_rollup_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='nex' AND tablename='analytics_rollup_queue' AND policyname='service_role_all_analytics_rollup_queue'
  ) THEN
    CREATE POLICY service_role_all_analytics_rollup_queue
      ON nex.analytics_rollup_queue FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.analytics_rollup_queue IS
  'D6 · async rollup queue. Populated by ingest when NEX_ANALYTICS_ROLLUP_ASYNC=1; drained by rollup worker on cron-tick.';
