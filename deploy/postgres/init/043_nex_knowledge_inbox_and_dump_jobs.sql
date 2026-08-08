-- =====================================================================
-- NEX Brain · Phase 11.2 · Inbox + Dump Jobs shadow tables
-- =====================================================================
--
-- Additive · idempotent · zero destructive changes.
--
-- Creates the Postgres tables that the Phase 12.1 filesystem writeback
-- shadow-writes into, and that Phase 11.3 will flip to authoritative.
-- Until 11.3 lands:
--   · the filesystem inbox at data/knowledge-inbox/index.json remains
--     the single source of truth for reads
--   · every write ALSO lands here (dual-write, best-effort · a shadow
--     failure never breaks the filesystem path)
--   · nothing in production reads from these tables yet
--
-- Tables mirror the filesystem shape 1:1 so backfill is a straight
-- insert · once dual-writes prove parity in the wild, 11.3 flips the
-- reads and stops writing to the filesystem.
--
-- Follows every rule from the Runtime Services doctrine:
--   · nex.* namespace
--   · nex_brain_app has full CRUD via RLS policy scoped to that role
--   · foreign roles hit no policy · denied
--   · idempotent DROP POLICY IF EXISTS + CREATE POLICY loop
-- =====================================================================

-- =====================================================================
-- Table 1 · nex.knowledge_inbox
-- =====================================================================
--
-- Mirrors src/lib/nex/knowledge-inbox/types.ts::InboxItem. Field types
-- chosen for direct import from JSON without lossy conversions:
--   · id                   TEXT    (matches "nx_<base36ts>_<hex>" scheme)
--   · created_at_ms        BIGINT  (preserves the Date.now() ms epoch used by
--                                   InboxItem.createdAt — separate from PG's
--                                   created_at_iso for lossless round-trip)
--   · created_at_iso       TIMESTAMPTZ (canonical timestamp for indexing)
--   · hash                 TEXT    (sha256 hex · unique for dedup)
--   · status               TEXT with CHECK
--   · kind                 TEXT with CHECK
--   · source               TEXT with CHECK
--
-- Storage back-refs (contentPath / filePath / originalFilename /
-- byteSize / mimeType / url) preserved as nullable columns so files
-- can be moved to object storage in a later phase without a schema
-- change here.

CREATE TABLE IF NOT EXISTS nex.knowledge_inbox (
    id                 TEXT PRIMARY KEY,
    title              TEXT NOT NULL,
    kind               TEXT NOT NULL CHECK (kind IN ('text','file','url','voice','image')),
    status             TEXT NOT NULL CHECK (status IN ('waiting','processing','review','processed')),
    source             TEXT NOT NULL CHECK (source IN (
                           'chatgpt-approved','claude-generated','raw-research',
                           'internet-article','needs-verification','gov-standards',
                           'customer-qa','personal-ideas'
                       )),
    hash               TEXT NOT NULL,
    created_at_ms      BIGINT NOT NULL,
    created_at_iso     TIMESTAMPTZ NOT NULL,
    meta               TEXT,
    preview_text       TEXT,
    content_path       TEXT,
    file_path          TEXT,
    original_filename  TEXT,
    byte_size          BIGINT,
    mime_type          TEXT,
    url                TEXT,
    processed_at_ms    BIGINT,
    processed_notes    TEXT,
    -- Shadow-write housekeeping · lets the parity tool tell filesystem-
    -- authored rows from Postgres-authored rows after 11.3 flip.
    shadow_written_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shadow_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dedup helper · hash is unique across the inbox (matches findByHash)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_knowledge_inbox_hash
    ON nex.knowledge_inbox (hash);

-- Status queries · UI filters by status.
CREATE INDEX IF NOT EXISTS idx_knowledge_inbox_status
    ON nex.knowledge_inbox (status, created_at_iso DESC);

-- Chronological · newest-first list.
CREATE INDEX IF NOT EXISTS idx_knowledge_inbox_created
    ON nex.knowledge_inbox (created_at_iso DESC);

ALTER TABLE nex.knowledge_inbox ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table 2 · nex.knowledge_inbox_stats
-- =====================================================================
--
-- One-row-per-day counter table so the Inbox stats.json state can
-- shadow-write here without needing an UPDATE-on-conflict dance.
-- Downstream counts (records/faqs/edges/duplicates) intentionally
-- omitted · those live in nex.knowledge_records + nex.graph_edges +
-- nex.worker_results (the authoritative sources per the "Never
-- Pretends Work Done" doctrine).

CREATE TABLE IF NOT EXISTS nex.knowledge_inbox_stats (
    stat_date                 DATE PRIMARY KEY,   -- YYYY-MM-DD
    completed_today           INTEGER NOT NULL DEFAULT 0,
    images_analysed_lifetime  INTEGER NOT NULL DEFAULT 0,
    voice_notes_transcribed_lifetime INTEGER NOT NULL DEFAULT 0,
    last_processed_at_ms      BIGINT,
    shadow_written_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shadow_updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nex.knowledge_inbox_stats ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table 3 · nex.knowledge_dump_jobs
-- =====================================================================
--
-- Mirrors src/lib/nex/jobs/fs-store.ts::KnowledgeJob. The filesystem
-- store is JSONL append-only (every state change = new line, latest
-- snapshot wins on read). Here we keep ONE row per job_id updated
-- in place — the shadow layer preserves the "latest wins" semantic
-- while shedding the audit-trail append (audit_log covers that).

CREATE TABLE IF NOT EXISTS nex.knowledge_dump_jobs (
    job_id             TEXT PRIMARY KEY,
    source             TEXT NOT NULL,
    owner              TEXT NOT NULL,
    knowledge_type     TEXT,
    target_brains      TEXT[] NOT NULL DEFAULT '{}',
    status             TEXT NOT NULL CHECK (status IN (
                           'received','queued','claimed','processing','completed','failed'
                       )),
    progress           INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    completion_result  JSONB,
    inbox_item_id      TEXT,
    title              TEXT,
    content_length     BIGINT NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL,
    updated_at         TIMESTAMPTZ NOT NULL,
    shadow_written_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shadow_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_dump_jobs_status
    ON nex.knowledge_dump_jobs (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_dump_jobs_inbox
    ON nex.knowledge_dump_jobs (inbox_item_id)
    WHERE inbox_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_dump_jobs_created
    ON nex.knowledge_dump_jobs (created_at DESC);

ALTER TABLE nex.knowledge_dump_jobs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Part 2 · Grants + RLS policies for nex_brain_app
-- =====================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON
    nex.knowledge_inbox,
    nex.knowledge_inbox_stats,
    nex.knowledge_dump_jobs
    TO nex_brain_app;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'knowledge_inbox', 'knowledge_inbox_stats', 'knowledge_dump_jobs'
    ]) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I_brain_app_all ON nex.%I', t, t);
        EXECUTE format(
            'CREATE POLICY %I_brain_app_all ON nex.%I FOR ALL TO nex_brain_app USING (true) WITH CHECK (true)',
            t, t
        );
    END LOOP;
END $$;

-- =====================================================================
-- Documentation
-- =====================================================================
COMMENT ON TABLE nex.knowledge_inbox IS
    'Phase 11.2 · shadow copy of data/knowledge-inbox/index.json. Dual-written by the filesystem storage layer when NEX_INBOX_SHADOW_POSTGRES=1. Reads stay on filesystem until Phase 11.3 flip. shadow_written_at = first insert · shadow_updated_at = last modification (either write path). hash is UNIQUE — matches findByHash dedup semantics.';

COMMENT ON TABLE nex.knowledge_inbox_stats IS
    'Phase 11.2 · shadow copy of data/knowledge-inbox/stats.json (only the counts we own here — downstream record/FAQ/edge/duplicate counts live in nex.knowledge_records + nex.graph_edges + nex.worker_results per the Never Pretends Work Done doctrine).';

COMMENT ON TABLE nex.knowledge_dump_jobs IS
    'Phase 11.2 · shadow copy of data/nex-jobs/jobs.jsonl. Latest-snapshot-wins semantic preserved (JSONL append-only history is dropped · the audit trail lives in nex.audit_log).';

-- =====================================================================
-- Phase 11.2 migration complete. Three new tables + three RLS policies.
-- Shadow-write code lives in src/lib/nex/knowledge-inbox/pg-shadow.ts
-- and src/lib/nex/jobs/pg-shadow.ts. Backfill script:
-- scripts/nex-inbox-jobs-backfill.mjs.
-- =====================================================================
