-- 143_nex_work_item.sql
--
-- NEX ACQUISITION WORKFORCE · PHASE 1B.1 · DURABLE WORK-ITEM SCHEMA
-- Philip 2026-09-02
--
-- Doctrine anchor:
--   doctrine_nex_acquisition_architecture_2026_09_02 · Phase 1B
--   Follows Phase 1A PASS (production supervision & self-recovery proven)
--
-- Purpose:
--   Introduce a DURABLE representation of each scheduled acquisition
--   attempt so a walker/supervisor crash mid-cycle no longer silently
--   loses the individual unit of work. The work item is the durable
--   contract BEFORE the walker starts, INDEPENDENT of the transient
--   nex.worker_cycle_run row the walker itself writes.
--
-- Phase 1B.1 scope (STRICT):
--   · Create nex.work_item + indexes ONLY.
--   · Zero rows inserted.
--   · Zero consumer code changes (supervisor · walker · watchdog · dev
--     scheduler · System A · image migration · application · UI · PWA
--     all untouched).
--   · Existing tables NOT altered.
--   · No triggers.
--   · No FK to nex.worker_cycle_run (its worker_id column type has not
--     been proven compatible for a safe FK; deferred to a later phase
--     if/when confirmed).
--
-- Reversible:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.work_item;
--   COMMIT;
--
--   No existing table is modified, so rollback is a single DROP.
--   Rollback MUST NOT be scripted here (Phase 1B.1 has no destructive
--   statements per Philip's design rule 7).

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- TABLE · nex.work_item
-- ═══════════════════════════════════════════════════════════════════
--
-- One row per scheduled acquisition attempt. Written by the supervisor
-- BEFORE it spawns the child walker (Phase 1B.2, not this migration).
--
-- IDEMPOTENCY / TIME-BUCKET SEMANTICS (Philip design rule 1):
--   idempotency_key MUST be deterministic for the SAME scheduled work
--   and DIFFERENT for the next legitimate scheduled work.
--
--   The recommended (Phase 1B.2) computation is:
--
--     bucket_seconds = floor(unix_epoch_seconds / cycle_min_gap_seconds)
--     idempotency_key = encode(
--       sha256(job_slug || '|' || city || '|' || bucket_seconds::text),
--       'hex'
--     )
--
--   Where cycle_min_gap_seconds matches the existing supervisor's
--   NEX_ACQ_CYCLE_MIN_GAP_MS constant (currently 60_000 · 60 s) so
--   two attempts of the same (job_slug, city) within the same 60-s
--   bucket collide via UNIQUE and only the first wins. The next
--   bucket permits a new legitimate attempt.
--
--   This migration only enforces UNIQUENESS via a CHECK-less UNIQUE
--   constraint · the key computation itself is a consumer concern.
--
-- STATUS MACHINE (Philip design rule 3):
--   Valid values and intended transitions:
--
--     queued          → leased        (supervisor claims)
--     queued          → waiting_network (network probe failed pre-claim)
--     leased          → running       (child walker actually spawned)
--     leased          → retrying      (spawn failed transiently)
--     running         → completed     (child exit=0 · cycle_run present)
--     running         → retrying      (child exit non-zero · attempts remain)
--     running         → dead_letter   (attempts exhausted)
--     running         → failed        (permanent error · non-retryable)
--     retrying        → queued        (next_retry_at reached)
--     retrying        → dead_letter   (attempts exhausted)
--     waiting_network → queued        (network probe returned OK)
--     completed / failed / dead_letter → terminal (no further transitions)
--
--   NOTE: No transition-enforcement trigger is created in Phase 1B.1
--   per Philip's design rule 3. Consumer logic must obey the machine.
--   A future phase MAY add a CHECK/trigger once the shape is proven.
--
-- LEASE SEMANTICS (Philip design rule 4):
--   lease_expires_at IS NULL when status ∈ {queued, waiting_network,
--   retrying, completed, failed, dead_letter}.
--   lease_expires_at IS NOT NULL AND worker_id IS NOT NULL AND
--   lease_owner IS NOT NULL when status ∈ {leased, running}.
--
--   Reclaim protocol (consumer, Phase 1B.2/1B.4): on supervisor startup,
--   any row with status IN ('leased','running') AND
--   lease_expires_at < now() is reset to status='retrying' with
--   worker_id=NULL, lease_owner=NULL, lease_expires_at=NULL, and
--   attempt_count/next_retry_at advanced per policy.
--
-- ERROR STORAGE (Philip design rule 5):
--   last_error is bounded via CHECK (char_length <= 2048) so a runaway
--   child-process stderr cannot swell any single row.
--   error_history remains JSONB; consumer implementation MUST cap the
--   number of entries retained (e.g. last 20). No cap enforced in DDL.

CREATE TABLE IF NOT EXISTS nex.work_item (
  work_item_id       uuid PRIMARY KEY,

  -- Identity of the scheduled work
  idempotency_key    text NOT NULL,
  job_slug           text NOT NULL,   -- from data/nex-job-registry.json (extensible · Phase 6/8 language & knowledge streams reuse this discriminator)
  city               text NOT NULL,

  -- State machine · see comment above for valid transitions
  status             text NOT NULL,

  -- Lease · NULL when not leased/running
  worker_id          uuid,                 -- matches Node randomUUID() convention · no FK to nex.worker_cycle_run per design rule 2
  cycle_run_id       uuid,                 -- child walker's own nex.worker_cycle_run.id · nullable · no FK per design rule 2
  lease_owner        text,                 -- supervisor identity (e.g. 'acquisition-supervisor@' || pid)
  lease_expires_at   timestamptz,

  -- Retry policy
  attempt_count      integer NOT NULL DEFAULT 0,
  max_attempts       integer NOT NULL DEFAULT 4,
  next_retry_at      timestamptz,

  -- Error state (bounded)
  last_error         text,
  last_error_class   text,                 -- e.g. 'network' | 'provider_429' | 'provider_5xx' | 'db_timeout' | 'child_exit_nonzero' | 'timeout'
  error_history      jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Productivity evidence (copied from child walker's cycle_run on completion · NOT a source of truth)
  records_processed  integer,
  records_new        integer,
  cycle_outcome      text,                 -- copied from _category-walker.mjs summary · e.g. 'ALL_DEDUPED' | 'PROVIDER_EMPTY'

  -- Timestamps · timestamptz per design rule 6
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  started_at         timestamptz,
  finished_at        timestamptz,

  CONSTRAINT work_item_status_check CHECK (
    status IN (
      'queued','leased','running','completed',
      'retrying','waiting_network','failed','dead_letter'
    )
  ),
  CONSTRAINT work_item_last_error_bounded CHECK (
    last_error IS NULL OR char_length(last_error) <= 2048
  ),
  CONSTRAINT work_item_max_attempts_positive CHECK (max_attempts > 0),
  CONSTRAINT work_item_attempt_count_nonneg CHECK (attempt_count >= 0)
);

-- Idempotency uniqueness (see IDEMPOTENCY / TIME-BUCKET SEMANTICS above)
CREATE UNIQUE INDEX IF NOT EXISTS work_item_idempotency_key_uniq
  ON nex.work_item (idempotency_key);

-- Retry-when-due scans (consumer picks next queued/retrying row)
CREATE INDEX IF NOT EXISTS work_item_status_next_retry_at_idx
  ON nex.work_item (status, next_retry_at);

-- Reclaim expired leases (consumer sweeps at supervisor startup)
CREATE INDEX IF NOT EXISTS work_item_lease_expires_at_idx
  ON nex.work_item (worker_id, lease_expires_at)
  WHERE lease_expires_at IS NOT NULL;

-- Productivity signal · fast count of recently-completed items
CREATE INDEX IF NOT EXISTS work_item_completed_finished_at_idx
  ON nex.work_item (finished_at DESC)
  WHERE status = 'completed';

-- Slot lookup · fast "does a work item already exist for (job, city)?"
CREATE INDEX IF NOT EXISTS work_item_job_city_status_idx
  ON nex.work_item (job_slug, city, status);

-- ═══════════════════════════════════════════════════════════════════
-- COMMENTS · per existing NEX migration convention (e.g. 070)
-- ═══════════════════════════════════════════════════════════════════

COMMENT ON TABLE nex.work_item IS
  'Phase 1B.1 (Philip 2026-09-02) · durable per-cycle work-item for the '
  'NEX Acquisition Workforce. One row per scheduled acquisition attempt. '
  'Written by the supervisor BEFORE spawning the child walker so a crash '
  'mid-cycle does not lose the unit of work. Empty in 1B.1 (schema only); '
  'consumer wiring is 1B.2.';

COMMENT ON COLUMN nex.work_item.idempotency_key IS
  'sha256 of (job_slug + city + time-bucket). Bucket width = supervisor '
  'CYCLE_MIN_GAP_MS. Prevents duplicate enqueue of the SAME scheduled work; '
  'allows the SAME (job_slug, city) in the NEXT legitimate bucket.';

COMMENT ON COLUMN nex.work_item.status IS
  'State machine: queued/leased/running/completed/retrying/waiting_network/failed/dead_letter. '
  'Valid transitions documented in the migration header comment. No trigger enforcement in 1B.1.';

COMMENT ON COLUMN nex.work_item.lease_expires_at IS
  'NULL when status ∈ {queued, waiting_network, retrying, completed, failed, dead_letter}. '
  'Not NULL when status ∈ {leased, running}. Reclaim protocol lives in the supervisor.';

COMMENT ON COLUMN nex.work_item.last_error IS
  'Bounded to 2048 characters via CHECK constraint · consumer must not '
  'attempt to store unbounded child-process output.';

COMMENT ON COLUMN nex.work_item.error_history IS
  'JSONB array of prior errors. Consumer implementation MUST cap the number '
  'of retained entries (recommendation: last 20). No cap enforced in DDL.';

COMMENT ON COLUMN nex.work_item.records_processed IS
  'Copied from child walker''s nex.worker_cycle_run.records_processed on '
  'completion. Advisory · not the source of truth for productivity ('
  'the count of status=completed rows in the productive window is).';

-- ═══════════════════════════════════════════════════════════════════
-- SANITY CHECK · per existing NEX migration convention
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl_exists       BOOLEAN;
  row_count        INTEGER;
  idx_uniq_exists  BOOLEAN;
  idx_retry_exists BOOLEAN;
  idx_lease_exists BOOLEAN;
  idx_prod_exists  BOOLEAN;
  idx_slot_exists  BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                 WHERE table_schema='nex' AND table_name='work_item')
    INTO tbl_exists;
  IF NOT tbl_exists THEN
    RAISE EXCEPTION 'Migration 143 failed: nex.work_item was not created';
  END IF;

  SELECT COUNT(*)::int FROM nex.work_item INTO row_count;
  IF row_count <> 0 THEN
    RAISE EXCEPTION 'Migration 143 failed: nex.work_item must be empty after 1B.1 (row_count=%)', row_count;
  END IF;

  SELECT EXISTS(SELECT 1 FROM pg_indexes
                 WHERE schemaname='nex' AND tablename='work_item'
                   AND indexname='work_item_idempotency_key_uniq')
    INTO idx_uniq_exists;
  SELECT EXISTS(SELECT 1 FROM pg_indexes
                 WHERE schemaname='nex' AND tablename='work_item'
                   AND indexname='work_item_status_next_retry_at_idx')
    INTO idx_retry_exists;
  SELECT EXISTS(SELECT 1 FROM pg_indexes
                 WHERE schemaname='nex' AND tablename='work_item'
                   AND indexname='work_item_lease_expires_at_idx')
    INTO idx_lease_exists;
  SELECT EXISTS(SELECT 1 FROM pg_indexes
                 WHERE schemaname='nex' AND tablename='work_item'
                   AND indexname='work_item_completed_finished_at_idx')
    INTO idx_prod_exists;
  SELECT EXISTS(SELECT 1 FROM pg_indexes
                 WHERE schemaname='nex' AND tablename='work_item'
                   AND indexname='work_item_job_city_status_idx')
    INTO idx_slot_exists;

  IF NOT (idx_uniq_exists AND idx_retry_exists AND idx_lease_exists
          AND idx_prod_exists AND idx_slot_exists) THEN
    RAISE EXCEPTION 'Migration 143 failed: one or more indexes missing (uniq=%, retry=%, lease=%, prod=%, slot=%)',
      idx_uniq_exists, idx_retry_exists, idx_lease_exists, idx_prod_exists, idx_slot_exists;
  END IF;

  RAISE NOTICE 'Migration 143 complete: nex.work_item created with % rows and 5 indexes ready', row_count;
END $$;

COMMIT;
