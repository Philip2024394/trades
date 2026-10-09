-- =====================================================================
-- UWI · Wave 2 · D8 · Worker jobs DLQ semantics
-- =====================================================================
--
-- Founder-authorised Unified NEX Continuous World & Innovation
-- Intelligence Programme · Wave 2 substrate.
--
-- Extends worker_jobs with a dedicated dead_letter_at TIMESTAMPTZ column
-- and a move_to_dead_letter(job_id, reason) function so "failed and
-- giving up" is DISTINGUISHABLE from "failed and will retry". The job
-- reaper (D7) uses this to escalate jobs whose attempts >= max_attempts.
--
-- No breaking change to existing behaviour:
--   · status='failed' semantics unchanged
--   · new column defaults NULL (not-yet-dead-lettered)
--   · new view exposes DLQ contents for inspection
--   · new function performs the transition atomically with audit event
--
-- Idempotent · safe to re-run. Reversible via
-- `ALTER TABLE worker_jobs DROP COLUMN dead_letter_at`.

-- ─── D8.1 · dedicated DLQ column ─────────────────────────────────────

ALTER TABLE worker_jobs
  ADD COLUMN IF NOT EXISTS dead_letter_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dead_letter_reason    TEXT;

-- Index only rows currently in DLQ · keeps index size proportional to
-- DLQ depth (usually small).
CREATE INDEX IF NOT EXISTS idx_worker_jobs_dead_letter
  ON worker_jobs (dead_letter_at DESC)
  WHERE dead_letter_at IS NOT NULL;

COMMENT ON COLUMN worker_jobs.dead_letter_at IS
  'Non-NULL when the job has been permanently retired to the DLQ · reason column carries the human-inspectable why.';

-- ─── D8.2 · atomic move_to_dead_letter function ──────────────────────

CREATE OR REPLACE FUNCTION move_to_dead_letter(
  p_job_id UUID,
  p_reason TEXT
)
RETURNS worker_jobs
LANGUAGE plpgsql AS $$
DECLARE
  moved worker_jobs;
BEGIN
  UPDATE worker_jobs
  SET status = 'failed',
      dead_letter_at = NOW(),
      dead_letter_reason = COALESCE(p_reason, 'unspecified'),
      updated_at = NOW()
  WHERE id = p_job_id
    AND dead_letter_at IS NULL
  RETURNING * INTO moved;
  RETURN moved;
END;
$$;

COMMENT ON FUNCTION move_to_dead_letter IS
  'Atomically transitions a job to DLQ · idempotent (does nothing if already dead-lettered) · sets status=failed and captures reason. Returns the moved row or NULL if the job did not exist or was already dead-lettered.';

-- ─── D8.3 · DLQ inspection view ──────────────────────────────────────

CREATE OR REPLACE VIEW worker_jobs_dead_letter AS
SELECT
  id AS job_id,
  worker_type,
  input_kind,
  input_ref,
  attempts,
  last_error,
  dead_letter_at,
  dead_letter_reason,
  created_at,
  input_payload
FROM worker_jobs
WHERE dead_letter_at IS NOT NULL;

COMMENT ON VIEW worker_jobs_dead_letter IS
  'DLQ inspection surface · exposes every dead-lettered job with reason + attempts + payload. Read-only view over worker_jobs.';

-- ─── D8.4 · DLQ redrive helper (bounded operator action) ─────────────

CREATE OR REPLACE FUNCTION redrive_from_dead_letter(
  p_job_id UUID,
  p_reset_attempts BOOLEAN DEFAULT TRUE
)
RETURNS worker_jobs
LANGUAGE plpgsql AS $$
DECLARE
  redriven worker_jobs;
BEGIN
  UPDATE worker_jobs
  SET status = 'waiting',
      dead_letter_at = NULL,
      dead_letter_reason = NULL,
      assigned_worker_id = NULL,
      assigned_at = NULL,
      lease_expires_at = NULL,
      last_error = NULL,
      attempts = CASE WHEN p_reset_attempts THEN 0 ELSE attempts END,
      updated_at = NOW()
  WHERE id = p_job_id
    AND dead_letter_at IS NOT NULL
  RETURNING * INTO redriven;
  RETURN redriven;
END;
$$;

COMMENT ON FUNCTION redrive_from_dead_letter IS
  'Explicit operator action · pulls a job back from the DLQ to the waiting queue. Optionally resets attempts counter. Idempotent (does nothing if job is not in DLQ).';

-- ─── D8.5 · sanity report ────────────────────────────────────────────

DO $$
DECLARE
  col_exists BOOLEAN;
  fn_exists BOOLEAN;
  view_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='worker_jobs' AND column_name='dead_letter_at') INTO col_exists;
  SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname='move_to_dead_letter') INTO fn_exists;
  SELECT EXISTS(SELECT 1 FROM information_schema.views WHERE table_name='worker_jobs_dead_letter') INTO view_exists;
  RAISE NOTICE 'UWI Wave 2 · D8 migration applied · dead_letter_at column=% · move_to_dead_letter fn=% · dlq view=%',
    col_exists, fn_exists, view_exists;
END $$;
