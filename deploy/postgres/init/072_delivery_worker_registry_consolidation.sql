-- 072_delivery_worker_registry_consolidation.sql
--
-- Task #75 Bundle A · Foundation cleanup · 2026-08-22
--
-- Doctrine anchor:
--   project_nex_one_hq_operational_reality_2026_08_22 (one worker registry · canonical
--   heartbeat is nex.worker_heartbeat since Step 1c 2026-08-22).
--
-- Constitutional violation Step 1c missed: nex.delivery_workers is a
-- SECOND heartbeat registry (columns: worker_id · hostname · started_at ·
-- last_seen_at · jobs_processed · jobs_failed · mode) parallel to the
-- canonical nex.worker_heartbeat. This migration archives the historical
-- row(s) for audit continuity, then DROPs the parallel table. Delivery
-- Worker code is rewritten in the same commit to write to
-- nex.worker_heartbeat via src/lib/nex/reliability/index.ts.
--
-- Reversible:
--   BEGIN;
--     CREATE TABLE nex.delivery_workers (
--       worker_id      text PRIMARY KEY,
--       hostname       text,
--       started_at     timestamptz NOT NULL DEFAULT now(),
--       last_seen_at   timestamptz NOT NULL DEFAULT now(),
--       jobs_processed integer NOT NULL DEFAULT 0,
--       jobs_failed    integer NOT NULL DEFAULT 0,
--       mode           text NOT NULL
--     );
--     INSERT INTO nex.delivery_workers SELECT worker_id, hostname, started_at,
--       last_seen_at, jobs_processed, jobs_failed, mode
--       FROM nex.delivery_workers_archive_2026_08_22;
--     DROP TABLE nex.delivery_workers_archive_2026_08_22;
--   COMMIT;

BEGIN;

-- ── 1 · Create archive table (mirror plural schema + archived_at + reason) ────
CREATE TABLE IF NOT EXISTS nex.delivery_workers_archive_2026_08_22 (
  worker_id       TEXT PRIMARY KEY,
  hostname        TEXT,
  started_at      TIMESTAMPTZ,
  last_seen_at    TIMESTAMPTZ,
  jobs_processed  INTEGER,
  jobs_failed     INTEGER,
  mode            TEXT,
  archived_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_reason TEXT NOT NULL DEFAULT 'Task #75 Bundle A · migrated to canonical nex.worker_heartbeat 2026-08-22'
);

COMMENT ON TABLE nex.delivery_workers_archive_2026_08_22 IS
  'Frozen snapshot of nex.delivery_workers prior to Task #75 Bundle A registry consolidation (2026-08-22). Historical delivery-worker heartbeats · replaced by canonical nex.worker_heartbeat. Never written to after archive.';

-- ── 2 · Archive existing rows (idempotent · ON CONFLICT DO NOTHING) ──────────
INSERT INTO nex.delivery_workers_archive_2026_08_22
  (worker_id, hostname, started_at, last_seen_at, jobs_processed, jobs_failed, mode)
SELECT worker_id, hostname, started_at, last_seen_at, jobs_processed, jobs_failed, mode
  FROM nex.delivery_workers
 ON CONFLICT (worker_id) DO NOTHING;

-- ── 3 · DROP the parallel registry ──────────────────────────────────────────
DROP TABLE IF EXISTS nex.delivery_workers CASCADE;

-- ── 4 · Sanity check ────────────────────────────────────────────────────────
DO $$
DECLARE
  plural_still_exists BOOLEAN;
  archive_count       INTEGER;
  canonical_ready     BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='nex' AND table_name='delivery_workers') INTO plural_still_exists;
  IF plural_still_exists THEN
    RAISE EXCEPTION 'Migration 072 failed: nex.delivery_workers still exists after DROP';
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='nex' AND table_name='delivery_workers_archive_2026_08_22') INTO plural_still_exists;
  IF NOT plural_still_exists THEN
    RAISE EXCEPTION 'Migration 072 failed: archive table not created';
  END IF;

  SELECT COUNT(*)::int FROM nex.delivery_workers_archive_2026_08_22 INTO archive_count;

  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='nex' AND table_name='worker_heartbeat') INTO canonical_ready;
  IF NOT canonical_ready THEN
    RAISE EXCEPTION 'Migration 072 failed: canonical nex.worker_heartbeat not present (Step 1c prerequisite)';
  END IF;

  RAISE NOTICE 'Migration 072 complete: nex.delivery_workers dropped, % rows archived, canonical worker_heartbeat ready for delivery-worker writes', archive_count;
END $$;

COMMIT;
