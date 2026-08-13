-- 046_worker_jobs_active_dedup.sql
--
-- D1 · Prevent duplicate active worker_jobs for the same (input_ref, worker_type).
--
-- Problem
--   dispatchNewInboxItems() reads an "already queued" set then INSERTs
--   new rows. If two cron-tick invocations race within the same window,
--   both read the same "already queued" set and both INSERT — resulting
--   in duplicate active jobs for the same inbox item. SKIP LOCKED on
--   claim prevents dual PROCESSING but not dual ENQUEUE, so queue depth
--   inflates and dedup metrics get noisy.
--
-- Fix
--   Partial unique index on (input_ref, worker_type) filtered to active
--   statuses only ('waiting', 'assigned', 'running'). Completed / failed
--   / cancelled rows are excluded so re-enqueue after failure still
--   works.
--
-- Reversible
--   `DROP INDEX CONCURRENTLY nex.worker_jobs_input_ref_active_uniq`.
--
-- Concurrency
--   CREATE INDEX CONCURRENTLY runs outside a transaction so the table
--   is not locked. Safe on live systems with active writes.
--
-- Operator note
--   To apply to Supabase legacy, run the same statement in the Supabase
--   SQL editor. The `IF NOT EXISTS` guard makes double-application safe.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  worker_jobs_input_ref_active_uniq
ON nex.worker_jobs (input_ref, worker_type)
WHERE status IN ('waiting', 'assigned', 'running');

COMMENT ON INDEX nex.worker_jobs_input_ref_active_uniq IS
  'D1 · prevents concurrent dispatchNewInboxItems from duplicating active jobs for the same inbox item + worker_type. See docs/headquarters-production-readiness/HEADQUARTERS-REFACTOR-PLAN.md row D1.';
