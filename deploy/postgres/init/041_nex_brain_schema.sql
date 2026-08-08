-- =====================================================================
-- NEX Brain · Phase 11.1a · Schema on our Postgres
-- =====================================================================
--
-- Additive · idempotent · zero destructive changes.
-- Faithful reproduction of db/migrations/001_nex_brain_schema.sql
-- adapted for the `nex` schema on our own Postgres (nex_dev). Supabase
-- remains authoritative throughout Phase 11.1 · no traffic flip · no
-- adapter code · no dual writes yet.
--
-- Delivered by Phase 11.1a:
--   · 11 tables under nex.* namespace
--   · every CHECK, UNIQUE, FOREIGN KEY, INDEX from the source schema
--   · claim_next_job() helper (namespaced nex.claim_next_job)
--   · nex_brain_status view (namespaced nex.nex_brain_status)
--   · RLS enabled on all 11 tables (no policies yet — added in 11.1b
--     with the postgres brain adapter's app role)
--
-- Deliberate divergences from source (each explained):
--
--   1. `pgvector` extension not installed on this Postgres. Source
--      schema uses `embedding vector(1536)` + ivfflat index. Since no
--      code currently READS or WRITES embeddings (extractor sets NULL),
--      this migration uses `embedding BYTEA` as a shape-compatible
--      placeholder. The ivfflat index is deferred. Before Phase 11.3
--      production flip: `CREATE EXTENSION vector` + `ALTER TABLE ...
--      ALTER COLUMN embedding TYPE vector(1536) USING NULL` + create
--      the ivfflat index. Documented in commit message.
--
--   2. RLS policies from source reference `service_role` (Supabase-
--      specific role that doesn't exist on our Postgres). RLS is
--      ENABLED but no policies are created yet. Superuser (postgres)
--      bypasses RLS by default so this migration is manually
--      inspectable via psql. Phase 11.1b will introduce a
--      `nex_brain_app` role and permissive policies for it.
--
-- Coexistence guarantee: this migration touches ONLY objects whose
-- names begin with the shape `knowledge_*`, `worker_*`, `graph_*`,
-- `record_versions`, `sources`, `confidence_scores`, `contradictions`,
-- `deprecations`, `audit_log`, `nex_brain_status`, `claim_next_job`.
-- Nothing named `social_*` (Phase 6-10) is referenced. Verified in
-- migration verification query · see commit message.
-- =====================================================================

-- ── Extensions ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- NOTE: `CREATE EXTENSION vector` deliberately omitted — see header §1.

-- ── Ensure nex schema exists (Comms Social already created it, but
--    safe re-declaration keeps this migration standalone) ──
CREATE SCHEMA IF NOT EXISTS nex;

-- =====================================================================
-- 1 · nex.knowledge_records — the governed corpus
-- =====================================================================
CREATE TABLE IF NOT EXISTS nex.knowledge_records (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id             TEXT NOT NULL UNIQUE,
    record_version        TEXT NOT NULL DEFAULT '1.0.0',
    status                TEXT NOT NULL CHECK (status IN (
                              'DRAFT',
                              'UNDER_REVIEW',
                              'AUTHORITATIVE',
                              'DEPRECATED',
                              'SUPERSEDED'
                          )),
    supersedes            TEXT REFERENCES nex.knowledge_records(record_id),
    canonical_owner       TEXT NOT NULL,
    authored_by           TEXT NOT NULL,
    authorised_by         TEXT,
    reviewed_by           TEXT,
    title                 TEXT NOT NULL,
    category              TEXT NOT NULL,
    subcategory           TEXT,
    summary               TEXT NOT NULL,
    body_markdown         TEXT NOT NULL,
    industry_concepts     TEXT[],
    nex_concepts          TEXT[],
    primary_audience      TEXT NOT NULL CHECK (primary_audience IN (
                              'homeowner', 'manufacturer', 'engineer'
                          )),
    alt_audiences         TEXT[],
    sustainability_alert  JSONB,
    embedding             BYTEA,                       -- see header §1 · pgvector deferred
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at      TIMESTAMPTZ,
    review_due_at         TIMESTAMPTZ,
    deprecated_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_records_status
    ON nex.knowledge_records(status);
CREATE INDEX IF NOT EXISTS idx_records_category
    ON nex.knowledge_records(category);
CREATE INDEX IF NOT EXISTS idx_records_audience
    ON nex.knowledge_records(primary_audience);
CREATE INDEX IF NOT EXISTS idx_records_review_due
    ON nex.knowledge_records(review_due_at)
    WHERE status = 'AUTHORITATIVE';
-- ivfflat idx_records_embedding · deferred (see header §1)

-- =====================================================================
-- 2 · nex.record_versions — full version history
-- =====================================================================
CREATE TABLE IF NOT EXISTS nex.record_versions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id             TEXT NOT NULL REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE,
    version               TEXT NOT NULL,
    body_markdown         TEXT NOT NULL,
    change_summary        TEXT,
    changed_by            TEXT NOT NULL,
    changed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(record_id, version)
);
CREATE INDEX IF NOT EXISTS idx_versions_record
    ON nex.record_versions(record_id, changed_at DESC);

-- =====================================================================
-- 3 · nex.graph_edges — typed relationships
-- =====================================================================
CREATE TABLE IF NOT EXISTS nex.graph_edges (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_record_id        TEXT NOT NULL REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE,
    to_record_id          TEXT NOT NULL,
    edge_type             TEXT NOT NULL,
    confidence            REAL CHECK (confidence >= 0 AND confidence <= 1),
    provenance            TEXT,
    is_gap_marker         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(from_record_id, to_record_id, edge_type)
);
CREATE INDEX IF NOT EXISTS idx_edges_from
    ON nex.graph_edges(from_record_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_to
    ON nex.graph_edges(to_record_id);
CREATE INDEX IF NOT EXISTS idx_edges_gap
    ON nex.graph_edges(is_gap_marker)
    WHERE is_gap_marker = TRUE;

-- =====================================================================
-- 4 · nex.worker_jobs — the queue
-- =====================================================================
CREATE TABLE IF NOT EXISTS nex.worker_jobs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_type           TEXT NOT NULL,
    priority              INTEGER NOT NULL DEFAULT 5,
    status                TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN (
                              'waiting', 'assigned', 'running', 'completed', 'failed', 'cancelled'
                          )),
    input_kind            TEXT NOT NULL,
    input_ref             TEXT NOT NULL,
    input_payload         JSONB,
    assigned_worker_id    TEXT,
    assigned_at           TIMESTAMPTZ,
    lease_expires_at      TIMESTAMPTZ,
    result_id             UUID,
    attempts              INTEGER NOT NULL DEFAULT 0,
    last_error            TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jobs_queue
    ON nex.worker_jobs(worker_type, status, priority, created_at)
    WHERE status IN ('waiting', 'assigned');
CREATE INDEX IF NOT EXISTS idx_jobs_lease
    ON nex.worker_jobs(lease_expires_at)
    WHERE status IN ('assigned', 'running');

-- Helper: safely claim next job (namespaced nex.claim_next_job)
CREATE OR REPLACE FUNCTION nex.claim_next_job(
    p_worker_type TEXT,
    p_worker_id TEXT,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS nex.worker_jobs
LANGUAGE plpgsql AS $$
DECLARE
    claimed nex.worker_jobs;
BEGIN
    UPDATE nex.worker_jobs
    SET status = 'assigned',
        assigned_worker_id = p_worker_id,
        assigned_at = NOW(),
        lease_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        attempts = attempts + 1,
        updated_at = NOW()
    WHERE id = (
        SELECT id FROM nex.worker_jobs
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
-- 5 · nex.worker_results — per-job output + confidence + provenance
-- =====================================================================
CREATE TABLE IF NOT EXISTS nex.worker_results (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                UUID NOT NULL REFERENCES nex.worker_jobs(id) ON DELETE CASCADE,
    worker_type           TEXT NOT NULL,
    worker_id             TEXT NOT NULL,
    output_kind           TEXT NOT NULL,
    output_payload        JSONB NOT NULL,
    overall_confidence    REAL CHECK (overall_confidence >= 0 AND overall_confidence <= 1),
    llm_provider          TEXT,
    llm_model             TEXT,
    llm_tokens_in         INTEGER,
    llm_tokens_out        INTEGER,
    llm_ms                INTEGER,
    flags                 TEXT[],
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_results_job
    ON nex.worker_results(job_id);
CREATE INDEX IF NOT EXISTS idx_results_flags
    ON nex.worker_results USING GIN(flags);

-- =====================================================================
-- 6 · nex.sources — Knowledge Source lineage per item
-- =====================================================================
CREATE TABLE IF NOT EXISTS nex.sources (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id             TEXT REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE,
    inbox_item_id         TEXT,
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
    source_hash           TEXT,
    excerpt               TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sources_record
    ON nex.sources(record_id);
CREATE INDEX IF NOT EXISTS idx_sources_tier
    ON nex.sources(source_tier);

-- =====================================================================
-- 7 · nex.confidence_scores — per-claim confidence tracking
-- =====================================================================
CREATE TABLE IF NOT EXISTS nex.confidence_scores (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id             TEXT NOT NULL REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE,
    claim_key             TEXT NOT NULL,
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
    source_type           TEXT,
    source_ref            TEXT,
    verification_date     DATE,
    rationale             TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(record_id, claim_key)
);
CREATE INDEX IF NOT EXISTS idx_confidence_record
    ON nex.confidence_scores(record_id);
CREATE INDEX IF NOT EXISTS idx_confidence_low
    ON nex.confidence_scores(confidence_band)
    WHERE confidence_band = 'low';

-- =====================================================================
-- 8 · nex.contradictions — Memory Guardian's findings
-- =====================================================================
CREATE TABLE IF NOT EXISTS nex.contradictions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_a_id           TEXT NOT NULL REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE,
    record_b_id           TEXT NOT NULL REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE,
    claim_key_a           TEXT NOT NULL,
    claim_key_b           TEXT NOT NULL,
    contradiction_summary TEXT NOT NULL,
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
    ON nex.contradictions(status)
    WHERE status = 'open';

-- =====================================================================
-- 9 · nex.deprecations — soft-delete history
-- =====================================================================
CREATE TABLE IF NOT EXISTS nex.deprecations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id             TEXT NOT NULL REFERENCES nex.knowledge_records(record_id) ON DELETE CASCADE,
    superseded_by         TEXT REFERENCES nex.knowledge_records(record_id),
    reason                TEXT NOT NULL,
    deprecated_by         TEXT NOT NULL,
    deprecated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deprecations_record
    ON nex.deprecations(record_id);

-- =====================================================================
-- 10 · nex.knowledge_feedback — corrections are the moat
-- =====================================================================
CREATE TABLE IF NOT EXISTS nex.knowledge_feedback (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question              TEXT,
    nex_answer            TEXT,
    correction            TEXT,
    lesson                TEXT,
    record_id             TEXT REFERENCES nex.knowledge_records(record_id) ON DELETE SET NULL,
    domain                TEXT,
    topic_tags            TEXT[],
    feedback_kind         TEXT NOT NULL CHECK (feedback_kind IN (
                              'correction',
                              'approval',
                              'edit',
                              'rejection',
                              'gap',
                              'contradiction',
                              'voice_drift'
                          )),
    severity              TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN (
                              'minor', 'moderate', 'critical'
                          )),
    feedback_source       TEXT NOT NULL DEFAULT 'philip' CHECK (feedback_source IN (
                              'philip', 'customer', 'worker-audit', 'automated-check'
                          )),
    submitted_by          TEXT,
    context               JSONB,
    applied_to_prompts    BOOLEAN NOT NULL DEFAULT FALSE,
    applied_at            TIMESTAMPTZ,
    triggered_worker_proposal TEXT,
    resulted_in_record    TEXT REFERENCES nex.knowledge_records(record_id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_record
    ON nex.knowledge_feedback(record_id);
CREATE INDEX IF NOT EXISTS idx_feedback_kind
    ON nex.knowledge_feedback(feedback_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_unapplied
    ON nex.knowledge_feedback(applied_to_prompts)
    WHERE applied_to_prompts = FALSE;
CREATE INDEX IF NOT EXISTS idx_feedback_domain
    ON nex.knowledge_feedback(domain, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_tags
    ON nex.knowledge_feedback USING GIN(topic_tags);

-- =====================================================================
-- 11 · nex.audit_log — append-only trail of every write
-- =====================================================================
CREATE TABLE IF NOT EXISTS nex.audit_log (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type           TEXT NOT NULL,
    entity_id             TEXT NOT NULL,
    action                TEXT NOT NULL,
    actor                 TEXT NOT NULL,
    before_state          JSONB,
    after_state           JSONB,
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON nex.audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor
    ON nex.audit_log(actor, created_at DESC);

-- =====================================================================
-- Convenience view: nex.nex_brain_status
-- =====================================================================
CREATE OR REPLACE VIEW nex.nex_brain_status AS
SELECT
    (SELECT COUNT(*) FROM nex.worker_jobs WHERE status = 'waiting') AS jobs_waiting,
    (SELECT COUNT(*) FROM nex.worker_jobs WHERE status IN ('assigned', 'running')) AS jobs_in_flight,
    (SELECT COUNT(*) FROM nex.worker_jobs WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') AS jobs_completed_24h,
    (SELECT COUNT(*) FROM nex.worker_jobs WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours') AS jobs_failed_24h,
    (SELECT COUNT(*) FROM nex.knowledge_records WHERE status = 'AUTHORITATIVE') AS records_authoritative,
    (SELECT COUNT(*) FROM nex.knowledge_records WHERE status = 'UNDER_REVIEW') AS records_under_review,
    (SELECT COUNT(*) FROM nex.knowledge_records WHERE status = 'DRAFT') AS records_draft,
    (SELECT COUNT(*) FROM nex.contradictions WHERE status = 'open') AS contradictions_open,
    (SELECT COUNT(*) FROM nex.graph_edges WHERE is_gap_marker = TRUE) AS gap_markers_open,
    (SELECT COALESCE(SUM(llm_tokens_in + llm_tokens_out), 0) FROM nex.worker_results WHERE created_at > NOW() - INTERVAL '24 hours') AS llm_tokens_24h,
    (SELECT COUNT(*) FROM nex.worker_results WHERE created_at > NOW() - INTERVAL '24 hours') AS llm_calls_24h,
    (SELECT COUNT(*) FROM nex.knowledge_feedback) AS feedback_total_lifetime,
    (SELECT COUNT(*) FROM nex.knowledge_feedback WHERE created_at > NOW() - INTERVAL '7 days') AS feedback_last_7d,
    (SELECT COUNT(*) FROM nex.knowledge_feedback WHERE applied_to_prompts = FALSE) AS feedback_unapplied;

-- =====================================================================
-- Row-Level Security · enabled · no policies yet (Phase 11.1b)
-- =====================================================================
ALTER TABLE nex.knowledge_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.record_versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.graph_edges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.worker_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.worker_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.sources             ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.confidence_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.contradictions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.deprecations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.knowledge_feedback  ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.audit_log           ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Phase 11.1a complete. Eleven tables + one view + one helper function.
-- No adapter code yet. No traffic flip. Supabase remains authoritative.
-- Phase 11.1b adds the PostgresBrainStore adapter + nex_brain_app role
-- + RLS policies. Phase 11.1c adds the parity harness.
-- =====================================================================
