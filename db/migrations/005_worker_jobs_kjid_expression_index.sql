-- =====================================================================
-- 005 · Expression + input_ref indexes for W-C-COMPANION supervisor
-- =====================================================================
--
-- Wave 11 · Phase 5 · W-C-COMPANION storage-contract extension.
-- Reference: docs/headquarters-production-readiness/
--   WORLD-CLASS-OPS-W-C-STORAGE-CONTRACT-EXTENSION-DESIGN.md §5.1-5.2
--
-- Why these indexes are required
-- ------------------------------
-- The Phase-1 forensic (WORLD-CLASS-OPS-W-C-SUPABASE-COHORT-A-INVESTIGATION.md)
-- established that at production scale (18,960 worker_jobs in a single 4-day
-- window) the JSONB `.contains({knowledge_job_id: X})` query times out under
-- the default Supabase statement-timeout ceiling. Every earlier attempt to
-- resolve a KnowledgeJob → WorkerJob join via `input_payload->>'knowledge_job_id'`
-- had to be paginated + client-filtered, costing 19 round-trips per query.
--
-- The BrainStore.findWorkerJobsByKnowledgeJobId(kjid) method uses this
-- expression at the SQL layer directly. Without a supporting expression
-- index, the query is a full-scan on JSONB — unusable at scale.
--
-- The `input_ref` index supports BrainStore.listWorkerJobsByInputRef,
-- the supervisor's primary join key (see Phase-1 §5 · kjid does NOT
-- propagate to downstream workers, so inbox_item_id is the batch key).
-- If a matching index already exists (idx_jobs_queue covers a wider
-- key), CREATE INDEX IF NOT EXISTS is a no-op.
--
-- Design constraints
-- ------------------
-- 1. Partial index on `input_payload ? 'knowledge_job_id'` — bounds the
--    index size to knowledge-context worker rows only (~25% of the table
--    in the Phase-1 sample), matching the semantic of the query.
-- 2. CONCURRENTLY — avoids ACCESS EXCLUSIVE lock on the running table.
--    Runs against production Supabase without blocking writes.
-- 3. IF NOT EXISTS — safe to re-run on a partially-migrated DB.
-- 4. Version-independent — no PG17-specific syntax; safe on 15, 16, 17, 18
--    per NEX PostgreSQL version-independence doctrine.
--
-- Rollback
-- --------
-- Reversible via `DROP INDEX CONCURRENTLY IF EXISTS worker_jobs_input_payload_kjid_idx;`
-- and `DROP INDEX CONCURRENTLY IF EXISTS worker_jobs_input_ref_lookup_idx;`.
-- No data change · pure read-path optimisation.
--
-- Notes on application path
-- -------------------------
-- CONCURRENTLY cannot run inside a transaction block. Migration runners
-- that wrap the entire file in BEGIN/COMMIT (`apply-all-migrations.mjs`
-- historically does this) must run these statements OUTSIDE that block.
-- If your runner cannot support that, execute this file by hand via
-- `psql -f 005_worker_jobs_kjid_expression_index.sql`.
--
-- Phase-5 authorisation applies this migration to the LOCAL PG17 shadow
-- only. Application to the Supabase primary is a separate authorisation
-- (see CONTROLLED COMPLETION DIRECTIVE · Phase 5 boundary).

-- ---------------------------------------------------------------------
-- Expression index · kjid lookup on worker_jobs.input_payload
-- ---------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS worker_jobs_input_payload_kjid_idx
    ON nex.worker_jobs ((input_payload->>'knowledge_job_id'))
    WHERE input_payload ? 'knowledge_job_id';

-- ---------------------------------------------------------------------
-- Supporting BTree · input_ref (inbox_item_id) batch lookup
-- ---------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS worker_jobs_input_ref_lookup_idx
    ON nex.worker_jobs (input_ref);

-- ---------------------------------------------------------------------
-- Verification query · run manually after apply
-- ---------------------------------------------------------------------
--
--   \d+ nex.worker_jobs
--   EXPLAIN (ANALYZE, BUFFERS)
--     SELECT id, worker_type, status
--     FROM nex.worker_jobs
--     WHERE input_payload->>'knowledge_job_id' = '<sample-uuid>'
--     LIMIT 10;
--
-- Expected plan · Index Scan using worker_jobs_input_payload_kjid_idx,
-- rows removed by filter = 0.
