-- =====================================================================
-- NEX Brain · Phase 11.1b · Extended tables + app role + RLS policies
-- =====================================================================
--
-- Additive · idempotent · zero destructive changes.
--
-- 11.1a landed the 11 core tables. This migration:
--   1. Adds the two extended tables that the BrainStore interface
--      requires but weren't in 001 (they live in 002 + 003 upstream):
--        nex.llm_retry_queue    (from db/migrations/002)
--        nex.worker_heartbeats  (from db/migrations/003)
--   2. Adds the nex.claim_next_llm_retry() SKIP LOCKED helper.
--   3. Creates the nex_brain_app application role (mirrors the
--      nex_social_app pattern from migration 030).
--   4. Grants the role SELECT/INSERT/UPDATE/DELETE on all 13 brain
--      tables + USAGE on sequences + EXECUTE on the two helper
--      functions.
--   5. Creates one RLS policy per brain table scoped to nex_brain_app.
--      Other non-superuser roles hit no policy and are denied. Superuser
--      (postgres) bypasses RLS as always.
--
-- Deliberate divergences from source (each explained in header of 041):
--   1. `pgvector` still deferred · no changes.
--   2. Supabase `service_role` policies REPLACED by nex_brain_app
--      policies. Same permissive semantics for the app role. Foreign
--      role isolation actually enforced (proven by contract test RL-1
--      in brain-adapter-contract.test.mjs).
-- =====================================================================

-- =====================================================================
-- Part 1 · Extended tables (from 002 + 003, adapted to nex.* schema)
-- =====================================================================

-- ── 12 · nex.llm_retry_queue ─────────────────────────────────────────
-- Persistent queue for LLM calls that failed across every provider.
-- Background retry worker picks them up when providers recover.
CREATE TABLE IF NOT EXISTS nex.llm_retry_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_job_id       UUID REFERENCES nex.worker_jobs(id) ON DELETE CASCADE,
    parent_worker_type  TEXT,
    parent_input_ref    TEXT,
    call_purpose        TEXT NOT NULL,
    call_options        JSONB,
    call_messages       JSONB NOT NULL,
    requires_capability TEXT,
    prefer_provider     TEXT,
    attempts            INTEGER NOT NULL DEFAULT 0,
    max_attempts        INTEGER NOT NULL DEFAULT 5,
    next_attempt_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_provider_tried TEXT,
    last_error          TEXT,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'in_flight', 'succeeded', 'exhausted', 'cancelled'
                        )),
    succeeded_provider  TEXT,
    succeeded_at        TIMESTAMPTZ,
    result_summary      JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llm_retry_pending
    ON nex.llm_retry_queue(status, next_attempt_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_llm_retry_parent
    ON nex.llm_retry_queue(parent_job_id);
CREATE INDEX IF NOT EXISTS idx_llm_retry_status
    ON nex.llm_retry_queue(status, updated_at DESC);
ALTER TABLE nex.llm_retry_queue ENABLE ROW LEVEL SECURITY;

-- Helper: SKIP LOCKED claim of next due retry (mirrors 002)
CREATE OR REPLACE FUNCTION nex.claim_next_llm_retry(
    p_worker_id TEXT,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS nex.llm_retry_queue
LANGUAGE plpgsql AS $$
DECLARE
    claimed nex.llm_retry_queue;
BEGIN
    UPDATE nex.llm_retry_queue
    SET status = 'in_flight',
        attempts = attempts + 1,
        last_provider_tried = p_worker_id,
        next_attempt_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        updated_at = NOW()
    WHERE id = (
        SELECT id FROM nex.llm_retry_queue
        WHERE status = 'pending'
          AND next_attempt_at <= NOW()
        ORDER BY next_attempt_at ASC, attempts ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING * INTO claimed;
    RETURN claimed;
END;
$$;

-- ── 13 · nex.worker_heartbeats ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.worker_heartbeats (
    host_id            TEXT PRIMARY KEY,
    last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uptime_ms          BIGINT      NOT NULL DEFAULT 0,
    cycles_total       INTEGER     NOT NULL DEFAULT 0,
    cycles_failed      INTEGER     NOT NULL DEFAULT 0,
    last_error         TEXT,
    last_cycle_summary JSONB,
    metadata           JSONB
);
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_last_seen
    ON nex.worker_heartbeats (last_seen_at DESC);
ALTER TABLE nex.worker_heartbeats ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Part 2 · nex_brain_app application role
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_brain_app') THEN
        CREATE ROLE nex_brain_app NOLOGIN;
    END IF;
END $$;

-- Schema usage
GRANT USAGE ON SCHEMA nex TO nex_brain_app;

-- Full CRUD on all 13 brain tables (11 from 041 + 2 above)
GRANT SELECT, INSERT, UPDATE, DELETE ON
    nex.knowledge_records,
    nex.record_versions,
    nex.graph_edges,
    nex.worker_jobs,
    nex.worker_results,
    nex.sources,
    nex.confidence_scores,
    nex.contradictions,
    nex.deprecations,
    nex.knowledge_feedback,
    nex.audit_log,
    nex.llm_retry_queue,
    nex.worker_heartbeats
    TO nex_brain_app;

-- Sequence grants so future BIGSERIAL columns work under this role
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA nex TO nex_brain_app;

-- Function grants · both SKIP LOCKED claim helpers
GRANT EXECUTE ON FUNCTION nex.claim_next_job(TEXT, TEXT, INTEGER) TO nex_brain_app;
GRANT EXECUTE ON FUNCTION nex.claim_next_llm_retry(TEXT, INTEGER) TO nex_brain_app;

-- Allow the DB owner (postgres, connecting via NEX_POSTGRES_URL) to
-- SET LOCAL ROLE nex_brain_app. In production this grant mirrors here:
--   GRANT nex_brain_app TO <app_login_role>;
GRANT nex_brain_app TO postgres;

-- =====================================================================
-- Part 3 · RLS policies · one per table, scoped to nex_brain_app
-- =====================================================================
--
-- RLS was ENABLED on the 11 tables in 041 and just enabled on the 2
-- new tables above. Without policies, all non-superuser access is
-- denied. These policies grant the app role full access via RLS.
-- Any OTHER role that somehow gets USAGE on the schema still cannot
-- read/write brain data.
--
-- Uses DO blocks so re-runs are idempotent (CREATE POLICY has no
-- IF NOT EXISTS in Postgres 17).

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'knowledge_records', 'record_versions', 'graph_edges',
        'worker_jobs', 'worker_results', 'sources',
        'confidence_scores', 'contradictions', 'deprecations',
        'knowledge_feedback', 'audit_log',
        'llm_retry_queue', 'worker_heartbeats'
    ]) LOOP
        -- FOR ALL policy scoped to nex_brain_app · USING(true) means the
        -- role can see every row · WITH CHECK(true) means it can write
        -- any row. Effectively "the app role has full CRUD, everyone
        -- else has none."
        EXECUTE format('DROP POLICY IF EXISTS %I_brain_app_all ON nex.%I', t, t);
        EXECUTE format(
            'CREATE POLICY %I_brain_app_all ON nex.%I FOR ALL TO nex_brain_app USING (true) WITH CHECK (true)',
            t, t
        );
    END LOOP;
END $$;

-- =====================================================================
-- Comments (documentation attached to schema objects)
-- =====================================================================
COMMENT ON ROLE nex_brain_app IS
    'NEX Brain application role · NOLOGIN · used by the PostgresBrainStore adapter (Phase 11.1b). Every transaction that touches nex.<brain table> must SET LOCAL ROLE nex_brain_app first so RLS enforces role-scoped isolation.';

COMMENT ON TABLE nex.llm_retry_queue IS
    'Phase 11.1b · adapted from db/migrations/002. Persistent queue for LLM calls that failed across every provider. Background retry worker (workers/llm-retry.ts) picks them up when providers recover.';

COMMENT ON TABLE nex.worker_heartbeats IS
    'Phase 11.1b · adapted from db/migrations/003. One row per running worker process (host_id). Row older than 60s = worker offline / crashed / lost DB connectivity.';

-- =====================================================================
-- Phase 11.1b migration complete. Two new tables + one new role +
-- 13 RLS policies. Adapter code lives in src/lib/nex/brain/storage.ts.
-- Contract tests live in src/lib/nex/brain/tests/brain-adapter-contract.test.mjs.
-- =====================================================================
