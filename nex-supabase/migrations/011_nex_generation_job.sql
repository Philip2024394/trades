-- ============================================================================
-- NEX-native Migration 011 · nex_generation_job
-- ============================================================================
--
-- Purpose:
--   Durable job queue for the NEX Generation Engine workers. Turns the
--   engine into a HORIZONTAL WORKER architecture per the 2026-09-24
--   Scaling Doctrine:
--
--     NEX supports an UNBOUNDED GROWTH ARCHITECTURE, not INFINITE
--     PHYSICAL COMPUTATION.
--
--   The engine ITSELF does not change. It becomes the worker. This
--   table is the durable queue the API layer writes to and the workers
--   consume from.
--
-- Design principles:
--   · Postgres-native queue · zero new infra dependency
--   · SKIP LOCKED for concurrent-safe multi-worker consumption
--   · Lease-based scheduling · dead workers automatically forfeit
--   · Per-user rate limits enforced at insert time (see backpressure.ts)
--   · Priority + expiry so callers can express deadline behaviour
--   · Correlation ID for end-to-end tracing
--   · No fabricated fallback · a failed job is a failed job
--
-- States:
--   queued     · waiting to be picked up
--   leased     · a worker has claimed it, actively processing
--   completed  · engine returned a valid reply · result stored
--   failed     · engine returned honest error / retries exhausted
--   expired    · job passed expires_at before being processed
--
-- FK behaviour:
--   conversation_id → ON DELETE CASCADE · job dies with conversation
--   requester_account_id → ON DELETE SET NULL · we retain the job trail
--     even if the requester is later removed (audit)
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '011';
--     DROP TABLE IF EXISTS nex_generation_job;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_generation_job (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id        uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id       uuid NOT NULL REFERENCES nex_conversation(id) ON DELETE CASCADE,
  requester_account_id  uuid REFERENCES nex_account(id) ON DELETE SET NULL,
  requester_side        text NOT NULL CHECK (requester_side IN ('customer', 'business')),
  priority              smallint NOT NULL DEFAULT 100
                          CHECK (priority BETWEEN 0 AND 1000),
    -- Higher priority = processed first. 100 is normal · 200 is elevated
    -- · 500 is founder/admin · 1000 is emergency. Lower than 100 is
    -- background (batch reprocessing, etc.). Fair scheduling combines
    -- priority + created_at.

  status                text NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued', 'leased', 'completed', 'failed', 'expired')),

  created_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
    -- Hard deadline. If a job passes expires_at before it is picked up
    -- or completed, it becomes 'expired' · no fabricated late reply.

  leased_at             timestamptz,
  leased_by             text,
    -- Free-form worker identifier · usually "<host>:<pid>:<uuid>".
    -- Kept human-readable so operators can trace which worker holds
    -- what job.

  lease_expires_at      timestamptz,
    -- Worker heartbeats extend this. Other workers may reclaim if
    -- lease_expires_at is in the past.

  completed_at          timestamptz,
  failed_at             timestamptz,

  attempts              smallint NOT NULL DEFAULT 0
                          CHECK (attempts BETWEEN 0 AND 5),
  max_attempts          smallint NOT NULL DEFAULT 2
                          CHECK (max_attempts BETWEEN 1 AND 5),

  last_error            text,

  result_message_id     uuid REFERENCES nex_message(id) ON DELETE SET NULL,
    -- The nex_message row the worker wrote when generation succeeded.
    -- Nullable · null while queued / leased · null on failure.

  result_model_id       text,
  result_latency_ms     integer,
  result_attempts_used  smallint,
  result_findings       text[]
    -- Union of validator findings across attempts · engineering diagnostic
);

COMMENT ON TABLE nex_generation_job IS
  'Durable job queue for NEX Generation Engine horizontal workers. Consumed via SELECT ... FOR UPDATE SKIP LOCKED.';

-- Fast-scheduler index · queued jobs ordered by (priority desc, created_at asc)
CREATE INDEX IF NOT EXISTS idx_nex_generation_job_ready
  ON nex_generation_job (priority DESC, created_at ASC)
  WHERE status = 'queued';

-- Lease-reclaim index · leased jobs whose lease has expired
CREATE INDEX IF NOT EXISTS idx_nex_generation_job_lease_expired
  ON nex_generation_job (lease_expires_at)
  WHERE status = 'leased';

-- Backpressure/fairness index · queued jobs per requester
CREATE INDEX IF NOT EXISTS idx_nex_generation_job_requester_queued
  ON nex_generation_job (requester_account_id)
  WHERE status = 'queued';

-- Retention/purge index · terminal jobs by completion time
CREATE INDEX IF NOT EXISTS idx_nex_generation_job_terminal
  ON nex_generation_job (completed_at)
  WHERE status IN ('completed', 'failed', 'expired');

-- ---------------------------------------------------------------------------
-- Reclaim helper · SECURITY DEFINER so workers with limited privileges can
-- transition an expired lease back to 'queued' without needing UPDATE on
-- arbitrary rows. Only touches rows whose lease has expired.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex_reclaim_expired_leases(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE nex_generation_job
     SET status = 'queued',
         leased_at = NULL,
         leased_by = NULL,
         lease_expires_at = NULL
   WHERE status = 'leased'
     AND lease_expires_at IS NOT NULL
     AND lease_expires_at < p_now
     AND attempts < max_attempts;
  GET DIAGNOSTICS n = ROW_COUNT;

  -- Jobs that hit max_attempts without completing become 'failed'
  UPDATE nex_generation_job
     SET status = 'failed',
         failed_at = p_now,
         last_error = COALESCE(last_error, 'lease_expired_and_max_attempts_reached'),
         leased_at = NULL,
         leased_by = NULL,
         lease_expires_at = NULL
   WHERE status = 'leased'
     AND lease_expires_at IS NOT NULL
     AND lease_expires_at < p_now
     AND attempts >= max_attempts;

  -- Jobs whose overall deadline passed become 'expired' regardless of lease
  UPDATE nex_generation_job
     SET status = 'expired',
         failed_at = p_now,
         last_error = COALESCE(last_error, 'job_expired')
   WHERE status IN ('queued', 'leased')
     AND expires_at < p_now;

  RETURN n;
END;
$$;

COMMENT ON FUNCTION nex_reclaim_expired_leases(timestamptz) IS
  'Reclaim jobs whose worker lease expired. Also transitions leased→failed at max_attempts and queued/leased→expired past deadline.';

-- ---------------------------------------------------------------------------
-- Fair leasing helper · atomic multi-row lease so a single worker can
-- claim N jobs in one round-trip.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex_lease_generation_jobs(
  p_worker_id text,
  p_batch_size integer DEFAULT 1,
  p_lease_seconds integer DEFAULT 90
)
RETURNS SETOF nex_generation_job
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
      FROM nex_generation_job
     WHERE status = 'queued'
       AND expires_at > now()
     ORDER BY priority DESC, created_at ASC
     LIMIT p_batch_size
     FOR UPDATE SKIP LOCKED
  )
  UPDATE nex_generation_job j
     SET status = 'leased',
         leased_at = now(),
         leased_by = p_worker_id,
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         attempts = j.attempts + 1
    FROM picked
   WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

COMMENT ON FUNCTION nex_lease_generation_jobs(text, integer, integer) IS
  'Atomically lease up to N queued jobs to a worker. Uses SKIP LOCKED for concurrent safety.';

-- ---------------------------------------------------------------------------
-- Queue depth helper · used by autoscaler + backpressure signal
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex_generation_queue_depth()
RETURNS TABLE(status text, count bigint, oldest_seconds numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT status,
         COUNT(*) AS count,
         COALESCE(
           EXTRACT(epoch FROM (now() - MIN(created_at)))::numeric,
           0
         ) AS oldest_seconds
    FROM nex_generation_job
   WHERE status IN ('queued', 'leased')
   GROUP BY status;
$$;

COMMENT ON FUNCTION nex_generation_queue_depth() IS
  'Live queue depth by state · used by autoscaler + backpressure signal.';

-- Trigger the migration_history record
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '011',
    'nex_generation_job · durable queue for horizontal engine workers',
    'Enables horizontal worker architecture per 2026-09-24 Scaling Doctrine. Adds nex_lease_generation_jobs / nex_reclaim_expired_leases / nex_generation_queue_depth helpers. No behavioural change to the existing NEX Generation Engine · engine files untouched.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
