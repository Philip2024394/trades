-- 047_worker_audit_events.sql
--
-- D14 · Mirrors db/migrations/004_worker_audit_events.sql into the
-- nex.* schema on the NEX Postgres target so post-cutover the table
-- already exists.
--
-- OPERATOR NOTE · SUPABASE SIDE
-- The original migration `db/migrations/004_worker_audit_events.sql`
-- creates `public.worker_audit_events` for the Supabase legacy path.
-- Audit finding P1 (see HEADQUARTERS-PRODUCTION-READINESS-AUDIT.md
-- Section 2 line 90) confirms migration 004 was NEVER applied to
-- Supabase — audit-log inserts silently fail with:
--   "Could not find the table"
--
-- BEFORE PRODUCTION CUTOVER, apply ONE of these:
--   · db/migrations/004_worker_audit_events.sql  (against Supabase, keeps `public.worker_audit_events` naming)
--   · this migration (against NEX Postgres, uses nex.worker_audit_events naming) + update
--     src/lib/nex/brain/audit-log.ts to point to nex.worker_audit_events via the Postgres client
--
-- Recommended path: apply this migration to NEX Postgres now (post-cutover
-- topology is already the target). Then update audit-log.ts as a follow-up
-- to write via BrainStore instead of the Supabase JS client.
--
-- Rollback: `DROP TABLE nex.worker_audit_events CASCADE`.

CREATE TABLE IF NOT EXISTS nex.worker_audit_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_type       TEXT NOT NULL,
  worker_host_id    TEXT,
  job_id            UUID,
  input_ref         TEXT,
  event_type        TEXT NOT NULL,
  actor             TEXT NOT NULL,
  at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latency_ms        INTEGER,
  provider          TEXT,
  model             TEXT,
  confidence        NUMERIC(5,4),
  outcome           TEXT,
  error_snippet     TEXT,
  details           JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_nex_worker_audit_events_worker_at
  ON nex.worker_audit_events (worker_type, at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_worker_audit_events_job_at
  ON nex.worker_audit_events (job_id, at ASC) WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_worker_audit_events_event_type_at
  ON nex.worker_audit_events (event_type, at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_worker_audit_events_provider_at
  ON nex.worker_audit_events (provider, at DESC) WHERE provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_worker_audit_events_input_ref_at
  ON nex.worker_audit_events (input_ref, at DESC) WHERE input_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_worker_audit_events_at
  ON nex.worker_audit_events (at DESC);

-- Immutability trigger — audit events are append-only.
CREATE OR REPLACE FUNCTION nex.worker_audit_events_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('nex.allow_audit_hard_delete', TRUE) = 'true' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'nex.worker_audit_events is append-only (op=% attempted). This is the trust anchor for NEX Observable AI.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_worker_audit_events_immutable ON nex.worker_audit_events;
CREATE TRIGGER trg_nex_worker_audit_events_immutable
  BEFORE UPDATE OR DELETE ON nex.worker_audit_events
  FOR EACH ROW EXECUTE FUNCTION nex.worker_audit_events_immutable();

-- RLS · service-role bypass (audit events are internal telemetry).
ALTER TABLE nex.worker_audit_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='nex' AND tablename='worker_audit_events' AND policyname='service_role_all_worker_audit_events'
  ) THEN
    CREATE POLICY service_role_all_worker_audit_events
      ON nex.worker_audit_events FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.worker_audit_events IS
  'NEX Brain · Worker Audit Log (nex. schema mirror of legacy public.worker_audit_events). Fine-grained event stream from every worker at every decision point. Insert-only. See db/migrations/004_worker_audit_events.sql for the Supabase-legacy definition + column semantics.';
