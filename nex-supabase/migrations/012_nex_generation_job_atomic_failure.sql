-- ============================================================================
-- NEX-native Migration 012 · atomic failure transition for generation jobs
-- ============================================================================
--
-- Purpose:
--   Provide `nex_transition_generation_job_failure(job_id, error)` as a
--   SECURITY DEFINER helper that atomically decides queued vs failed
--   based on the row's own current `attempts` count, closing the
--   read-then-write race in the previous JS-side implementation.
--
--   The prior implementation did:
--     1. SELECT attempts, max_attempts FROM nex_generation_job WHERE id=…
--     2. Decide: canRetry = attempts < max_attempts
--     3. UPDATE ... SET status = (canRetry ? 'queued' : 'failed')
--
--   Between (1) and (3), nex_reclaim_expired_leases could have already
--   transitioned the same row. This helper folds the decision into one
--   UPDATE using a CASE on the row's own attempts value.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '012';
--     DROP FUNCTION IF EXISTS nex_transition_generation_job_failure(uuid, text);
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION nex_transition_generation_job_failure(
  p_job_id uuid,
  p_error  text
)
RETURNS TABLE(new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE nex_generation_job j
     SET status = CASE
                    WHEN j.status IN ('completed', 'failed', 'expired') THEN j.status
                    WHEN j.attempts < j.max_attempts THEN 'queued'
                    ELSE 'failed'
                  END,
         failed_at = CASE
                        WHEN j.status IN ('completed', 'failed', 'expired') THEN j.failed_at
                        WHEN j.attempts < j.max_attempts THEN NULL
                        ELSE now()
                     END,
         last_error = coalesce(p_error, j.last_error),
         leased_at = CASE WHEN j.status IN ('completed', 'failed', 'expired') THEN j.leased_at ELSE NULL END,
         leased_by = CASE WHEN j.status IN ('completed', 'failed', 'expired') THEN j.leased_by ELSE NULL END,
         lease_expires_at = CASE WHEN j.status IN ('completed', 'failed', 'expired') THEN j.lease_expires_at ELSE NULL END
    WHERE j.id = p_job_id
   RETURNING j.status AS new_status;
END;
$$;

COMMENT ON FUNCTION nex_transition_generation_job_failure(uuid, text) IS
  'Atomic queued-vs-failed transition based on row.attempts · closes read-then-write race with nex_reclaim_expired_leases · SECURITY DEFINER.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '012',
    'nex_transition_generation_job_failure · atomic failure transition',
    'Closes a read-then-write race between the JS-side failGenerationJob decision and nex_reclaim_expired_leases · discovered by Wave 1 code audit 2026-09-24 HIGH severity finding.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
