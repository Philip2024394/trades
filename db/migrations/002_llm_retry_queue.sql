-- =====================================================================
-- NEX Brain · Migration 002 · LLM retry queue
-- =====================================================================
--
-- Persistent queue for LLM calls that failed everywhere in the provider
-- chain. Instead of losing that work, we enqueue the call metadata + a
-- reference to the parent worker_job. A background retry worker picks
-- them up when providers recover and re-executes.
--
-- Philip 2026-08-06 · Stage 3 production readiness · "no work is lost
-- if a provider fails."
--
-- Safe to re-run: uses IF NOT EXISTS.
-- =====================================================================

CREATE TABLE IF NOT EXISTS llm_retry_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which parent job needs this LLM call. When the retry succeeds,
    -- the worker that owned the parent job is re-notified.
    parent_job_id       UUID REFERENCES worker_jobs(id) ON DELETE CASCADE,
    parent_worker_type  TEXT,                  -- for observability
    parent_input_ref    TEXT,                  -- inbox_item_id or record_id

    -- The LLM call to retry — kept small; the full messages array lives
    -- in the worker's payload / result. We store just enough to reconstruct.
    call_purpose        TEXT NOT NULL,         -- 'knowledge_extractor' | 'quality_checker' | ...
    call_options        JSONB,                 -- LlmCallOptions (temperature, model, etc.)
    call_messages       JSONB NOT NULL,        -- LlmMessage[] — must survive restart
    requires_capability TEXT,                  -- if the call needed a specific capability
    prefer_provider     TEXT,                  -- if the caller preferred a specific provider

    -- Retry state
    attempts            INTEGER NOT NULL DEFAULT 0,
    max_attempts        INTEGER NOT NULL DEFAULT 5,
    next_attempt_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_provider_tried TEXT,
    last_error          TEXT,

    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'in_flight', 'succeeded', 'exhausted', 'cancelled'
                        )),

    -- On success, capture the winning provider + resulting summary so the
    -- audit log has provenance.
    succeeded_provider  TEXT,
    succeeded_at        TIMESTAMPTZ,
    result_summary      JSONB,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_retry_pending
    ON llm_retry_queue(status, next_attempt_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_llm_retry_parent
    ON llm_retry_queue(parent_job_id);
CREATE INDEX IF NOT EXISTS idx_llm_retry_status
    ON llm_retry_queue(status, updated_at DESC);

-- RLS in line with the rest of the schema
ALTER TABLE llm_retry_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_all_llm_retry"
    ON llm_retry_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Helper to claim the next due retry with SKIP LOCKED semantics.
-- Matches the pattern of claim_next_job() from migration 001.
CREATE OR REPLACE FUNCTION claim_next_llm_retry(
    p_worker_id TEXT,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS llm_retry_queue
LANGUAGE plpgsql AS $$
DECLARE
    claimed llm_retry_queue;
BEGIN
    UPDATE llm_retry_queue
    SET status = 'in_flight',
        attempts = attempts + 1,
        last_provider_tried = p_worker_id,
        next_attempt_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        updated_at = NOW()
    WHERE id = (
        SELECT id FROM llm_retry_queue
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

-- =====================================================================
-- Done. One table + one function.
-- Run this migration alongside 001 in the Supabase SQL editor.
-- =====================================================================
