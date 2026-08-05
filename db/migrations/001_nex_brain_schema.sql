-- =====================================================================
-- NEX Brain · Phase 1 schema
-- =====================================================================
--
-- This is the persistent store for the NEX-as-manager knowledge system.
-- Eleven tables total, aligned with the Record Constitution's 8 clauses,
-- the Knowledge Source doctrine, and the "corrections are the moat"
-- principle (Philip 2026-08-06 · knowledge_feedback table).
--
-- Paste into Supabase SQL Editor (single run) — creates every table,
-- index, and helper function. Safe to re-run: uses IF NOT EXISTS.
--
-- Prerequisites: none. pgvector + pgcrypto are extensions Supabase
-- makes available on the free tier. pg_cron is enabled on Pro tier;
-- Phase 1 works without it (workers can be invoked by Edge Functions
-- or by external cron until you upgrade).
--
-- References:
--   MEMORY.md · NEX Record Constitution (8 clauses)
--   MEMORY.md · Knowledge Source doctrine (8 tiers)
--   MEMORY.md · NEX Home 5-layer architecture
-- =====================================================================

-- ── Extensions ────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector for semantic dedup

-- =====================================================================
-- 1 · knowledge_records — the governed corpus (source of truth)
-- =====================================================================
--
-- One row per AUTHORITATIVE (or DRAFT / UNDER_REVIEW / DEPRECATED)
-- knowledge record. Directly mirrors the Golden Rule template on disk
-- but stored structurally so the Reasoning Layer can query it.

CREATE TABLE IF NOT EXISTS knowledge_records (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id             TEXT NOT NULL UNIQUE,   -- e.g. materials_beech_v1
    record_version        TEXT NOT NULL DEFAULT '1.0.0',

    -- Constitution clause 4 (versioned metadata)
    status                TEXT NOT NULL CHECK (status IN (
                              'DRAFT',
                              'UNDER_REVIEW',
                              'AUTHORITATIVE',
                              'DEPRECATED',
                              'SUPERSEDED'
                          )),
    supersedes            TEXT REFERENCES knowledge_records(record_id),

    -- Constitution clause 1 (canonical owner)
    canonical_owner       TEXT NOT NULL,
    authored_by           TEXT NOT NULL,     -- 'worker:knowledge-extractor@2026-08-06T…'
    authorised_by         TEXT,              -- Philip clicks approve
    reviewed_by           TEXT,

    -- Record body
    title                 TEXT NOT NULL,
    category              TEXT NOT NULL,
    subcategory           TEXT,
    summary               TEXT NOT NULL,     -- 50-word summary per Golden Rule
    body_markdown         TEXT NOT NULL,     -- full record body

    -- Constitution clause 3 (industry vs NEX split)
    industry_concepts     TEXT[],
    nex_concepts          TEXT[],

    -- Audience routing (Three Audiences doctrine)
    primary_audience      TEXT NOT NULL CHECK (primary_audience IN (
                              'homeowner', 'manufacturer', 'engineer'
                          )),
    alt_audiences         TEXT[],

    -- Constitution clause 3 · sustainability alerts propagate up
    sustainability_alert  JSONB,             -- { active: bool, severity, notes }

    -- Semantic search
    embedding             vector(1536),      -- populated by Extractor / Guardian

    -- Timestamps
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at      TIMESTAMPTZ,
    review_due_at         TIMESTAMPTZ,
    deprecated_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_records_status
    ON knowledge_records(status);
CREATE INDEX IF NOT EXISTS idx_records_category
    ON knowledge_records(category);
CREATE INDEX IF NOT EXISTS idx_records_audience
    ON knowledge_records(primary_audience);
CREATE INDEX IF NOT EXISTS idx_records_review_due
    ON knowledge_records(review_due_at)
    WHERE status = 'AUTHORITATIVE';

-- pgvector index (built once corpus > ~1K records)
CREATE INDEX IF NOT EXISTS idx_records_embedding
    ON knowledge_records
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- =====================================================================
-- 2 · record_versions — full version history (Constitution clause 4)
-- =====================================================================
--
-- Every non-trivial edit produces a new row here. knowledge_records
-- points at the latest; this table is the immutable audit trail.
-- Never DELETE from this table.

CREATE TABLE IF NOT EXISTS record_versions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id             TEXT NOT NULL REFERENCES knowledge_records(record_id) ON DELETE CASCADE,
    version               TEXT NOT NULL,           -- e.g. '1.2.0'
    body_markdown         TEXT NOT NULL,
    change_summary        TEXT,
    changed_by            TEXT NOT NULL,           -- worker or philip
    changed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(record_id, version)
);

CREATE INDEX IF NOT EXISTS idx_versions_record
    ON record_versions(record_id, changed_at DESC);

-- =====================================================================
-- 3 · graph_edges — typed relationships (Constitution clause 6)
-- =====================================================================
--
-- Every edge names its type and preserves provenance so the Reasoning
-- Layer can walk the graph and understand WHY an edge exists.

CREATE TABLE IF NOT EXISTS graph_edges (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_record_id        TEXT NOT NULL REFERENCES knowledge_records(record_id) ON DELETE CASCADE,
    to_record_id          TEXT NOT NULL,           -- may be gap marker (record not yet authored)
    edge_type             TEXT NOT NULL,           -- 'composes_material', 'regulated_by', etc.
    confidence            REAL CHECK (confidence >= 0 AND confidence <= 1),
    provenance            TEXT,                    -- which worker / claim / source
    is_gap_marker         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(from_record_id, to_record_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_edges_from
    ON graph_edges(from_record_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_to
    ON graph_edges(to_record_id);
CREATE INDEX IF NOT EXISTS idx_edges_gap
    ON graph_edges(is_gap_marker)
    WHERE is_gap_marker = TRUE;

-- =====================================================================
-- 4 · worker_jobs — the queue (SKIP LOCKED)
-- =====================================================================
--
-- Every worker pulls its next job from here using the SKIP LOCKED
-- pattern. Multiple workers can safely pull concurrently.

CREATE TABLE IF NOT EXISTS worker_jobs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_type           TEXT NOT NULL,           -- 'knowledge-extractor', 'quality-checker', 'memory-guardian'
    priority              INTEGER NOT NULL DEFAULT 5,  -- 1 = highest, 9 = lowest
    status                TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN (
                              'waiting', 'assigned', 'running', 'completed', 'failed', 'cancelled'
                          )),

    -- Input
    input_kind            TEXT NOT NULL,           -- 'inbox_item', 'record_draft', 'graph_audit', etc.
    input_ref             TEXT NOT NULL,           -- id of the input entity
    input_payload         JSONB,                   -- full input snapshot

    -- Routing
    assigned_worker_id    TEXT,                    -- 'worker-a-12'
    assigned_at           TIMESTAMPTZ,
    lease_expires_at      TIMESTAMPTZ,             -- for orphan reclamation

    -- Result linkage
    result_id             UUID,

    -- Failure handling
    attempts              INTEGER NOT NULL DEFAULT 0,
    last_error            TEXT,

    -- Timestamps
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_queue
    ON worker_jobs(worker_type, status, priority, created_at)
    WHERE status IN ('waiting', 'assigned');
CREATE INDEX IF NOT EXISTS idx_jobs_lease
    ON worker_jobs(lease_expires_at)
    WHERE status IN ('assigned', 'running');

-- Helper: safely claim next job of a given worker_type
CREATE OR REPLACE FUNCTION claim_next_job(
    p_worker_type TEXT,
    p_worker_id TEXT,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS worker_jobs
LANGUAGE plpgsql AS $$
DECLARE
    claimed worker_jobs;
BEGIN
    UPDATE worker_jobs
    SET status = 'assigned',
        assigned_worker_id = p_worker_id,
        assigned_at = NOW(),
        lease_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        attempts = attempts + 1,
        updated_at = NOW()
    WHERE id = (
        SELECT id FROM worker_jobs
        WHERE worker_type = p_worker_type
          AND status = 'waiting'
        ORDER BY priority ASC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING * INTO claimed;
    RETURN claimed;
END;
$$;

-- =====================================================================
-- 5 · worker_results — per-job output + confidence + provenance
-- =====================================================================

CREATE TABLE IF NOT EXISTS worker_results (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                UUID NOT NULL REFERENCES worker_jobs(id) ON DELETE CASCADE,
    worker_type           TEXT NOT NULL,
    worker_id             TEXT NOT NULL,

    -- Output
    output_kind           TEXT NOT NULL,           -- 'record_draft', 'quality_report', etc.
    output_payload        JSONB NOT NULL,

    -- Confidence + LLM budget
    overall_confidence    REAL CHECK (overall_confidence >= 0 AND overall_confidence <= 1),
    llm_provider          TEXT,                    -- 'groq', 'gemini', 'anthropic', 'mock'
    llm_model             TEXT,
    llm_tokens_in         INTEGER,
    llm_tokens_out        INTEGER,
    llm_ms                INTEGER,

    -- Flags
    flags                 TEXT[],                  -- 'needs-review', 'low-confidence', 'contradiction'

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_results_job
    ON worker_results(job_id);
CREATE INDEX IF NOT EXISTS idx_results_flags
    ON worker_results USING GIN(flags);

-- =====================================================================
-- 6 · sources — Knowledge Source lineage per item
-- =====================================================================
--
-- Every knowledge record traces back to one or more sources.
-- Applies the Knowledge Source doctrine (8 tiers) at storage level.

CREATE TABLE IF NOT EXISTS sources (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id             TEXT REFERENCES knowledge_records(record_id) ON DELETE CASCADE,
    inbox_item_id         TEXT,                    -- from Knowledge Inbox
    source_tier           TEXT NOT NULL CHECK (source_tier IN (
                              'chatgpt-approved',
                              'claude-generated',
                              'raw-research',
                              'internet-article',
                              'needs-verification',
                              'gov-standards',
                              'customer-qa',
                              'personal-ideas'
                          )),
    source_url            TEXT,
    source_hash           TEXT,                    -- sha256 of content
    excerpt               TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_record
    ON sources(record_id);
CREATE INDEX IF NOT EXISTS idx_sources_tier
    ON sources(source_tier);

-- =====================================================================
-- 7 · confidence_scores — per-claim confidence tracking
-- =====================================================================
--
-- Constitution clause 2 (per-claim confidence). Every claim in a record
-- gets its own row so the Reasoning Layer can weight claims individually.

CREATE TABLE IF NOT EXISTS confidence_scores (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id             TEXT NOT NULL REFERENCES knowledge_records(record_id) ON DELETE CASCADE,
    claim_key             TEXT NOT NULL,           -- e.g. 'janka_hardness' or a short hash of the claim text
    claim_text            TEXT NOT NULL,

    classification        TEXT NOT NULL CHECK (classification IN (
                              'established_practice',
                              'industry_consensus',
                              'design_opinion',
                              'experimental_concept',
                              'NEX_concept'
                          )),
    confidence_band       TEXT NOT NULL CHECK (confidence_band IN ('high', 'medium', 'low')),
    confidence_score      REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    source_type           TEXT,                    -- 'industry_standard', 'trade_reference', etc.
    source_ref            TEXT,
    verification_date     DATE,
    rationale             TEXT,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(record_id, claim_key)
);

CREATE INDEX IF NOT EXISTS idx_confidence_record
    ON confidence_scores(record_id);
CREATE INDEX IF NOT EXISTS idx_confidence_low
    ON confidence_scores(confidence_band)
    WHERE confidence_band = 'low';

-- =====================================================================
-- 8 · contradictions — Memory Guardian's findings
-- =====================================================================
--
-- When Memory Guardian finds two records making contradictory claims,
-- they land here awaiting Philip's decision on which is correct.

CREATE TABLE IF NOT EXISTS contradictions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_a_id           TEXT NOT NULL REFERENCES knowledge_records(record_id) ON DELETE CASCADE,
    record_b_id           TEXT NOT NULL REFERENCES knowledge_records(record_id) ON DELETE CASCADE,
    claim_key_a           TEXT NOT NULL,
    claim_key_b           TEXT NOT NULL,
    contradiction_summary TEXT NOT NULL,

    -- Resolution
    status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
                              'open', 'resolved', 'irrelevant'
                          )),
    resolved_by           TEXT,
    resolution_notes      TEXT,
    resolved_at           TIMESTAMPTZ,

    detected_by           TEXT NOT NULL DEFAULT 'memory-guardian',
    detected_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contradictions_open
    ON contradictions(status)
    WHERE status = 'open';

-- =====================================================================
-- 9 · deprecations — soft-delete history (Constitution clause 5)
-- =====================================================================
--
-- Deprecated records are never physically deleted. This table records
-- WHY a record was deprecated, when, and by whom. Superseded records
-- remain queryable for historical context.

CREATE TABLE IF NOT EXISTS deprecations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id             TEXT NOT NULL REFERENCES knowledge_records(record_id) ON DELETE CASCADE,
    superseded_by         TEXT REFERENCES knowledge_records(record_id),
    reason                TEXT NOT NULL,
    deprecated_by         TEXT NOT NULL,           -- philip / worker id
    deprecated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deprecations_record
    ON deprecations(record_id);

-- =====================================================================
-- 10 · knowledge_feedback — corrections are the moat (Philip 2026-08-06)
-- =====================================================================
--
-- Every human correction is stored here permanently. This table is the
-- highest-value data in NEX because it captures what NEX got wrong AND
-- what the right answer was — the specific signal no competitor has.
--
-- Also stores approvals (positive feedback reinforces the pattern),
-- edits (user tweaked NEX's answer), rejections, and knowledge-gap
-- flags ("NEX doesn't know about X"). All become fuel for prompt
-- refinement, few-shot injection, and specialist-worker proposals.
--
-- After 12 months, the count of rows in this table is the moat metric.

CREATE TABLE IF NOT EXISTS knowledge_feedback (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was said
    question              TEXT,                        -- the original question if any
    nex_answer            TEXT,                        -- what NEX said
    correction            TEXT,                        -- what the human said instead
    lesson                TEXT,                        -- extracted improvement (auto or manual)

    -- What it's about
    record_id             TEXT REFERENCES knowledge_records(record_id) ON DELETE SET NULL,
                                                        -- specific record if applicable
    domain                TEXT,                         -- 'staircase', 'kitchen', etc.
    topic_tags            TEXT[],                       -- ['walnut', 'tread', 'refurbishment']

    -- What kind of feedback
    feedback_kind         TEXT NOT NULL CHECK (feedback_kind IN (
                              'correction',        -- NEX was wrong; here's the right answer
                              'approval',          -- NEX was right; reinforce the pattern
                              'edit',              -- User tweaked NEX's answer
                              'rejection',         -- Full reject, no correction offered
                              'gap',               -- NEX didn't know; here's what should be known
                              'contradiction',     -- NEX contradicted itself across answers
                              'voice_drift'        -- NEX said it in the wrong voice
                          )),
    severity              TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN (
                              'minor', 'moderate', 'critical'
                          )),

    -- Who + how
    feedback_source       TEXT NOT NULL DEFAULT 'philip' CHECK (feedback_source IN (
                              'philip', 'customer', 'worker-audit', 'automated-check'
                          )),
    submitted_by          TEXT,                         -- optional user id if customer
    context               JSONB,                        -- conversation ref, session id, etc.

    -- Downstream effect tracking (what did NEX do with this feedback?)
    applied_to_prompts    BOOLEAN NOT NULL DEFAULT FALSE,
    applied_at            TIMESTAMPTZ,
    triggered_worker_proposal TEXT,                     -- e.g. 'WalnutExpertWorker'
    resulted_in_record    TEXT REFERENCES knowledge_records(record_id) ON DELETE SET NULL,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_record
    ON knowledge_feedback(record_id);
CREATE INDEX IF NOT EXISTS idx_feedback_kind
    ON knowledge_feedback(feedback_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_unapplied
    ON knowledge_feedback(applied_to_prompts)
    WHERE applied_to_prompts = FALSE;
CREATE INDEX IF NOT EXISTS idx_feedback_domain
    ON knowledge_feedback(domain, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_tags
    ON knowledge_feedback USING GIN(topic_tags);

-- =====================================================================
-- 11 · audit_log — append-only trail of every write
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type           TEXT NOT NULL,           -- 'knowledge_records', 'graph_edges', etc.
    entity_id             TEXT NOT NULL,
    action                TEXT NOT NULL,           -- 'insert', 'update', 'deprecate', 'approve', 'reject'
    actor                 TEXT NOT NULL,           -- 'philip' | 'worker:knowledge-extractor@…'
    before_state          JSONB,
    after_state           JSONB,
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor
    ON audit_log(actor, created_at DESC);

-- =====================================================================
-- Convenience view: manager dashboard snapshot
-- =====================================================================

CREATE OR REPLACE VIEW nex_brain_status AS
SELECT
    (SELECT COUNT(*) FROM worker_jobs WHERE status = 'waiting') AS jobs_waiting,
    (SELECT COUNT(*) FROM worker_jobs WHERE status IN ('assigned', 'running')) AS jobs_in_flight,
    (SELECT COUNT(*) FROM worker_jobs WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') AS jobs_completed_24h,
    (SELECT COUNT(*) FROM worker_jobs WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours') AS jobs_failed_24h,

    (SELECT COUNT(*) FROM knowledge_records WHERE status = 'AUTHORITATIVE') AS records_authoritative,
    (SELECT COUNT(*) FROM knowledge_records WHERE status = 'UNDER_REVIEW') AS records_under_review,
    (SELECT COUNT(*) FROM knowledge_records WHERE status = 'DRAFT') AS records_draft,

    (SELECT COUNT(*) FROM contradictions WHERE status = 'open') AS contradictions_open,
    (SELECT COUNT(*) FROM graph_edges WHERE is_gap_marker = TRUE) AS gap_markers_open,

    (SELECT COALESCE(SUM(llm_tokens_in + llm_tokens_out), 0) FROM worker_results WHERE created_at > NOW() - INTERVAL '24 hours') AS llm_tokens_24h,
    (SELECT COUNT(*) FROM worker_results WHERE created_at > NOW() - INTERVAL '24 hours') AS llm_calls_24h,

    -- Feedback health (the moat metric)
    (SELECT COUNT(*) FROM knowledge_feedback) AS feedback_total_lifetime,
    (SELECT COUNT(*) FROM knowledge_feedback WHERE created_at > NOW() - INTERVAL '7 days') AS feedback_last_7d,
    (SELECT COUNT(*) FROM knowledge_feedback WHERE applied_to_prompts = FALSE) AS feedback_unapplied;

-- =====================================================================
-- Row-Level Security (Supabase best practice)
-- =====================================================================
-- Phase 1: RLS enabled but permissive. Tighten in Phase 3 when NEX
-- becomes multi-tenant.

ALTER TABLE knowledge_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE contradictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deprecations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Permissive policies for the service-role key (server-side workers).
-- The anon key sees nothing until we add explicit read policies.
CREATE POLICY IF NOT EXISTS "service_role_all_records"
    ON knowledge_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all_versions"
    ON record_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all_edges"
    ON graph_edges FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all_jobs"
    ON worker_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all_results"
    ON worker_results FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all_sources"
    ON sources FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all_confidence"
    ON confidence_scores FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all_contradictions"
    ON contradictions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all_deprecations"
    ON deprecations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all_feedback"
    ON knowledge_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all_audit"
    ON audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- Done. Eleven tables + one view + one helper function + RLS.
-- Fits comfortably inside Supabase free-tier storage (500 MB).
-- knowledge_feedback is the moat — never truncate this table.
-- =====================================================================
