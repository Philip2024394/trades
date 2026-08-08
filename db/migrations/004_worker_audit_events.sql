-- NEX Brain · Worker Audit Log
-- 004_worker_audit_events.sql · Philip 2026-08-07
--
-- Doctrine: feedback_nex_must_know_its_own_state_infrastructure_doctrine_2026_08_07.md
--
-- Every worker emits fine-grained events at every decision point:
--   · job_started · provider_request_sent · provider_response_ok / _failed
--   · knowledge_extracted · validation_started · promoted / rejected /
--     under_review · job_completed · job_failed
--
-- This is the foundation for retrospective queries like:
--   "Which providers timed out at 3am?"
--   "Show me everything Knowledge Context did yesterday."
--   "Why wasn't record X promoted?"
--
-- Insert-only. Never updated, never deleted. Very high write volume
-- expected — a single job generates 6-10+ events. Indexes tuned for
-- the two hottest read patterns: (worker_type, at) for per-worker
-- timelines, (job_id, at) for per-job trace.
--
-- Sits ALONGSIDE worker_results (which stores final outcome per job).
-- worker_results answers "what happened"; worker_audit_events answers
-- "how did we get there" + "when did each provider fall over" + everything
-- else that would otherwise require inspecting Fly logs.

CREATE TABLE IF NOT EXISTS worker_audit_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WHO
  worker_type       TEXT NOT NULL,        -- 'knowledge-context', 'quality-checker', ...
  worker_host_id    TEXT,                 -- Fly machine id, or 'local' for dev
  job_id            UUID,                 -- FK to worker_jobs.id (nullable — some events aren't job-scoped)
  input_ref         TEXT,                 -- Denormalised for fast per-entity queries (inbox_item id, record_id, etc.)

  -- WHAT
  event_type        TEXT NOT NULL,        -- Canonical enum below (kept as TEXT for extensibility)
  actor             TEXT NOT NULL,        -- 'nex', 'system', 'accountant', 'user' — who initiated

  -- WHEN
  at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- OPTIONAL DIMENSIONS (nullable per event type)
  latency_ms        INTEGER,              -- Time this event's operation took (LLM call, DB write, etc.)
  provider          TEXT,                 -- LLM provider name if applicable
  model             TEXT,                 -- LLM model name if applicable
  confidence        NUMERIC(5,4),         -- 0.0000..1.0000 when applicable
  outcome           TEXT,                 -- 'ok', '429', 'timeout', '5xx', 'circuit_open', 'budget_exhausted', 'success', 'failure', etc.
  error_snippet     TEXT,                 -- First 240 chars of error message when relevant

  -- CATCH-ALL
  details           JSONB DEFAULT '{}'::JSONB
);

-- Hot indexes for the primary read patterns
CREATE INDEX IF NOT EXISTS idx_worker_audit_events_worker_at
  ON worker_audit_events (worker_type, at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_audit_events_job_at
  ON worker_audit_events (job_id, at ASC)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_worker_audit_events_event_type_at
  ON worker_audit_events (event_type, at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_audit_events_provider_at
  ON worker_audit_events (provider, at DESC)
  WHERE provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_worker_audit_events_input_ref_at
  ON worker_audit_events (input_ref, at DESC)
  WHERE input_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_worker_audit_events_at
  ON worker_audit_events (at DESC);

-- Immutability trigger — audit events are append-only.
CREATE OR REPLACE FUNCTION worker_audit_events_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('nex.allow_audit_hard_delete', TRUE) = 'true' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'worker_audit_events is append-only (op=% attempted). This is the trust anchor for NEX Observable AI — do not modify without explicit override.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_audit_events_immutable ON worker_audit_events;
CREATE TRIGGER trg_worker_audit_events_immutable
  BEFORE UPDATE OR DELETE ON worker_audit_events
  FOR EACH ROW EXECUTE FUNCTION worker_audit_events_immutable();

-- RLS + service-role bypass (audit events are internal telemetry)
ALTER TABLE worker_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY worker_audit_events_service_role
    ON worker_audit_events
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE worker_audit_events IS
  'NEX Brain · Worker Audit Log. Fine-grained event stream from every worker at every decision point. Enables retrospective operational queries entirely within NEX (never requiring Fly log inspection). Insert-only.';

-- Canonical event types (kept in TEXT for extensibility, documented here):
--   job_started
--   provider_request_sent
--   provider_response_ok
--   provider_response_failed          (attempt outcome — retry may follow)
--   provider_circuit_opened
--   provider_circuit_closed
--   provider_budget_exhausted
--   knowledge_extracted
--   validation_started
--   validation_completed
--   record_promoted_to_review
--   record_promoted_to_authoritative
--   record_rejected
--   record_deprecated
--   job_completed
--   job_failed
--   contradiction_detected
--   contradiction_resolved
--   config_snapshot                   (periodic worker config dump for mismatch detection)

-- ═══════════════════════════════════════════════════════════════════════
-- Views on top of worker_audit_events
-- ═══════════════════════════════════════════════════════════════════════
-- These views expose specific slices of the event stream with
-- domain-friendly names Philip specifically requested (per doctrine
-- `project_nex_operations_history_and_explainability_2026_08_07.md`
-- priority #1). The underlying store is unified so we get one source
-- of truth + one insert path + easy joins across event kinds.

-- LLM CALL ATTEMPTS · one row per attempt (successful or failed) that
-- reached a real LLM provider. Circuit-open + budget-exhausted skips
-- are excluded because they never made a network call. Reads that
-- want "attempts including skipped" should query worker_audit_events
-- directly filtered by event_type IN (...).
CREATE OR REPLACE VIEW llm_call_attempts AS
SELECT
  id                                                                                                        AS attempt_id,
  at                                                                                                        AS attempted_at,
  worker_type,
  worker_host_id,
  job_id,
  input_ref,
  provider,
  model,
  COALESCE((details->>'attempt')::INT, 1)                                                                   AS attempt_number,
  event_type,
  outcome,
  latency_ms,
  (details->>'tokens_in')::INT                                                                              AS tokens_in,
  (details->>'tokens_out')::INT                                                                             AS tokens_out,
  error_snippet,
  CASE WHEN event_type = 'provider_response_ok'     THEN TRUE  ELSE FALSE END                               AS success,
  CASE WHEN event_type = 'provider_response_failed' THEN TRUE  ELSE FALSE END                               AS failed,
  details
FROM worker_audit_events
WHERE event_type IN ('provider_request_sent', 'provider_response_ok', 'provider_response_failed');

COMMENT ON VIEW llm_call_attempts IS
  'Per-attempt log of every LLM provider call. One row per attempt (including retries). Powers per-provider MTTR + retry analysis + Groq-hit-quota-at-18:42 observations.';

-- WORKER JOB EVENTS · one row per job-lifecycle event (start / complete /
-- fail / promoted / rejected). Excludes provider-attempt noise so the
-- lifecycle timeline reads cleanly.
CREATE OR REPLACE VIEW worker_job_events AS
SELECT
  id                                                                                                        AS event_id,
  at,
  worker_type,
  worker_host_id,
  job_id,
  input_ref,
  event_type,
  outcome,
  confidence,
  latency_ms,
  error_snippet,
  details
FROM worker_audit_events
WHERE event_type IN (
  'job_started',
  'knowledge_extracted',
  'validation_started',
  'validation_completed',
  'record_promoted_to_review',
  'record_promoted_to_authoritative',
  'record_rejected',
  'record_deprecated',
  'job_completed',
  'job_failed',
  'contradiction_detected',
  'contradiction_resolved'
);

COMMENT ON VIEW worker_job_events IS
  'Per-job lifecycle events (start / extract / validate / promote / reject / complete / fail). Powers the per-worker retrospective + "why wasn''t record X promoted?" queries.';
