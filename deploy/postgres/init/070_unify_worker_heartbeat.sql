-- 070_unify_worker_heartbeat.sql
--
-- Task #72 Step 1c · Heartbeat unification · Philip 2026-08-22
--
-- Doctrine anchor:
--   project_nex_one_hq_operational_reality_2026_08_22 (constitutional)
--   project_nex_step1b_heartbeat_migration_design_2026_08_22
--
-- Constitutional rule (Philip verbatim):
--   "NEX has one Headquarters. HQ is an operational instrument, not a
--    collection of dashboards. Every displayed status must be backed by
--    live database evidence."
--
-- This migration collapses two competing heartbeat systems (worker_heartbeat
-- singular + worker_heartbeats plural) into ONE canonical table.
--
-- Ships:
--   1  Relaxed CHECK constraint on nex.worker_heartbeat.last_status to the
--      unified 7-value vocabulary (idle/running/waiting/standby/completed/
--      failed/stopped · 'offline' derived from freshness, never stored).
--   2  GRANT + RLS policy for nex_brain_app on the singular table (Brain
--      adapters now write here instead of the plural table they used to).
--   3  Archive table nex.worker_heartbeats_archive_2026_08_22 to preserve
--      the ~50 historical Fly-cluster telemetry rows previously stored in
--      Supabase public.worker_heartbeats (populated via
--      scripts/nex-worker/_archive-supabase-heartbeats.mjs BEFORE this
--      migration runs). Table is created idempotently in case the archive
--      script already created it.
--   4  DROP nex.worker_heartbeats (plural · 0 rows on local Postgres ·
--      Brain adapter code has already been rewritten to target singular ·
--      any consumer still referencing plural will error loudly).
--
-- Reversible:
--   BEGIN;
--     ALTER TABLE nex.worker_heartbeat DROP CONSTRAINT worker_heartbeat_status_check;
--     ALTER TABLE nex.worker_heartbeat ADD CONSTRAINT worker_heartbeat_status_check
--       CHECK (last_status IN ('idle','running','completed','failed','stopped'));
--     -- Restore nex.worker_heartbeats from migration 042 (lines 100-113)
--     CREATE TABLE IF NOT EXISTS nex.worker_heartbeats (
--       host_id TEXT PRIMARY KEY, last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--       uptime_ms BIGINT NOT NULL DEFAULT 0, cycles_total INTEGER NOT NULL DEFAULT 0,
--       cycles_failed INTEGER NOT NULL DEFAULT 0, last_error TEXT,
--       last_cycle_summary JSONB, metadata JSONB
--     );
--     -- Restore grants from 042 line 141, RLS from 042 lines 177-188
--     REVOKE ALL ON nex.worker_heartbeat FROM nex_brain_app;
--     DROP TABLE IF EXISTS nex.worker_heartbeats_archive_2026_08_22;
--   COMMIT;

BEGIN;

-- ── PART 1 · Relax CHECK constraint to unified 7-value vocabulary ──────
ALTER TABLE nex.worker_heartbeat DROP CONSTRAINT IF EXISTS worker_heartbeat_status_check;
ALTER TABLE nex.worker_heartbeat ADD CONSTRAINT worker_heartbeat_status_check CHECK (
  last_status IN ('idle','running','waiting','standby','completed','failed','stopped')
);
COMMENT ON COLUMN nex.worker_heartbeat.last_status IS
  'Unified worker status vocabulary (Task #72 Step 1c 2026-08-22): idle (no cycle, was idle) · running (cycle in flight) · waiting (blocked on external resource · e.g. LLM) · standby (no cycle, ready) · completed (last cycle finished) · failed (last cycle failed) · stopped (deliberately shut down). "offline" is DERIVED from last_heartbeat_at freshness · NEVER stored.';

-- ── PART 2 · Grant nex_brain_app write on canonical table ──────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON nex.worker_heartbeat TO nex_brain_app;
ALTER TABLE nex.worker_heartbeat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS worker_heartbeat_brain_app_all ON nex.worker_heartbeat;
CREATE POLICY worker_heartbeat_brain_app_all ON nex.worker_heartbeat
  FOR ALL TO nex_brain_app USING (true) WITH CHECK (true);

-- ── PART 3 · Archive table for Supabase Fly-cluster historical rows ────
-- Created idempotently · the _archive-supabase-heartbeats.mjs script also
-- creates it via CREATE TABLE IF NOT EXISTS so ordering is flexible.
CREATE TABLE IF NOT EXISTS nex.worker_heartbeats_archive_2026_08_22 (
  host_id            TEXT PRIMARY KEY,
  last_seen_at       TIMESTAMPTZ NOT NULL,
  uptime_ms          BIGINT      NOT NULL DEFAULT 0,
  cycles_total       INTEGER     NOT NULL DEFAULT 0,
  cycles_failed      INTEGER     NOT NULL DEFAULT 0,
  last_error         TEXT,
  last_cycle_summary JSONB,
  metadata           JSONB,
  archived_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_reason    TEXT NOT NULL DEFAULT 'Fly cluster destroyed 2026-08-09 · Task #72 Step 1c heartbeat unification 2026-08-22'
);
COMMENT ON TABLE nex.worker_heartbeats_archive_2026_08_22 IS
  'Frozen snapshot of Supabase public.worker_heartbeats prior to unification (Task #72 Step 1c 2026-08-22). Historical Fly-cluster telemetry. Never written to after archive. Kept for audit evidence of the destroyed cluster.';

-- ── PART 4 · DROP the plural table ─────────────────────────────────────
-- Local Postgres nex.worker_heartbeats has 0 rows · nothing to lose.
-- Brain adapters (postgres.ts / supabase.ts / filesystem.ts) have already
-- been rewritten in the same commit to target the singular table. Any
-- consumer still referencing plural after this migration will error with
-- "relation does not exist" · that is the intended loud signal.
DROP TABLE IF EXISTS nex.worker_heartbeats CASCADE;

-- ── PART 5 · Sanity check + notice ─────────────────────────────────────
DO $$
DECLARE
  plural_exists BOOLEAN;
  singular_count INTEGER;
  archive_exists BOOLEAN;
  brain_grant_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='nex' AND table_name='worker_heartbeats') INTO plural_exists;
  IF plural_exists THEN
    RAISE EXCEPTION 'Migration 070 failed: nex.worker_heartbeats still exists after DROP';
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='nex' AND table_name='worker_heartbeats_archive_2026_08_22') INTO archive_exists;
  IF NOT archive_exists THEN
    RAISE EXCEPTION 'Migration 070 failed: archive table not created';
  END IF;

  SELECT COUNT(*)::int FROM nex.worker_heartbeat INTO singular_count;

  SELECT EXISTS(SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema='nex' AND table_name='worker_heartbeat'
      AND grantee='nex_brain_app' AND privilege_type='INSERT') INTO brain_grant_exists;
  IF NOT brain_grant_exists THEN
    RAISE EXCEPTION 'Migration 070 failed: nex_brain_app grant not applied to singular table';
  END IF;

  RAISE NOTICE 'Migration 070 complete: plural dropped, singular has % rows, archive table ready, nex_brain_app grants applied', singular_count;
END $$;

COMMIT;
