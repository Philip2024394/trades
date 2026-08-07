-- NEX Infrastructure Runtime · §5.8 · KPE (Knowledge Processing Engine)
--
-- Eight tables in one file because they belong to a single pipeline:
--   documents → chunks → metadata + decisions + duplicates + edges
--                     → processing_runs (per-doc) → human_reviews.

-- ── kpe_documents (forever) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.kpe_documents (
  document_id            UUID PRIMARY KEY,
  source                 TEXT NOT NULL,
  title                  TEXT,
  content_hash           TEXT NOT NULL UNIQUE,
  byte_length            INTEGER,
  ingested_at            TIMESTAMPTZ NOT NULL,
  classifier_label       TEXT,
  classifier_confidence  REAL,
  target_brains          JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_id            UUID,
  inserted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kpe_docs_content_hash_idx    ON nex.kpe_documents (content_hash);
CREATE INDEX IF NOT EXISTS kpe_docs_source_ingested_idx ON nex.kpe_documents (source, ingested_at DESC);
CREATE INDEX IF NOT EXISTS kpe_docs_classifier_idx      ON nex.kpe_documents (classifier_label) WHERE classifier_label IS NOT NULL;
CREATE INDEX IF NOT EXISTS kpe_docs_business_id_idx     ON nex.kpe_documents (business_id, ingested_at DESC) WHERE business_id IS NOT NULL;

-- ── kpe_chunks (forever) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.kpe_chunks (
  chunk_id             UUID PRIMARY KEY,
  document_id          UUID NOT NULL,
  order_index          INTEGER NOT NULL,
  heading_path         JSONB NOT NULL DEFAULT '[]'::jsonb,
  content              TEXT NOT NULL,
  content_hash         TEXT NOT NULL,
  token_estimate       INTEGER,
  context_before       TEXT,
  context_after        TEXT,
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kpe_chunks_doc_order_idx     ON nex.kpe_chunks (document_id, order_index);
CREATE INDEX IF NOT EXISTS kpe_chunks_content_hash_idx  ON nex.kpe_chunks (content_hash);
CREATE INDEX IF NOT EXISTS kpe_chunks_business_id_idx   ON nex.kpe_chunks (business_id) WHERE business_id IS NOT NULL;

-- ── kpe_metadata (matches chunk) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.kpe_metadata (
  chunk_id             UUID PRIMARY KEY,
  authors              JSONB NOT NULL DEFAULT '[]'::jsonb,
  dates                JSONB NOT NULL DEFAULT '[]'::jsonb,
  versions             JSONB NOT NULL DEFAULT '[]'::jsonb,
  urls                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  "references"         JSONB NOT NULL DEFAULT '[]'::jsonb,
  language             TEXT,
  keywords             JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted_entities   JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kpe_metadata_language_idx    ON nex.kpe_metadata (language) WHERE language IS NOT NULL;
CREATE INDEX IF NOT EXISTS kpe_metadata_business_id_idx ON nex.kpe_metadata (business_id) WHERE business_id IS NOT NULL;

-- ── kpe_decisions (forever · one per chunk) ─────────────────────────
CREATE TABLE IF NOT EXISTS nex.kpe_decisions (
  chunk_id                UUID PRIMARY KEY,
  route                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  decided_at              TIMESTAMPTZ NOT NULL,
  provider_used           TEXT,
  latency_ms              INTEGER,
  cost_estimate_gbp       REAL,
  alternatives_considered JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_id             UUID,
  inserted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kpe_decisions_ts_idx         ON nex.kpe_decisions (decided_at DESC);
CREATE INDEX IF NOT EXISTS kpe_decisions_tier_ts_idx    ON nex.kpe_decisions ((route->>'tier'), decided_at DESC);
CREATE INDEX IF NOT EXISTS kpe_decisions_business_id_idx ON nex.kpe_decisions (business_id, decided_at DESC) WHERE business_id IS NOT NULL;

-- ── kpe_duplicates (90 days) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.kpe_duplicates (
  duplicate_id         UUID PRIMARY KEY,
  chunk_id             UUID NOT NULL,
  matched_chunk_id     UUID NOT NULL,
  similarity           REAL NOT NULL,
  match_type           TEXT NOT NULL,
  detected_at          TIMESTAMPTZ NOT NULL,
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kpe_dupes_chunk_idx          ON nex.kpe_duplicates (chunk_id);
CREATE INDEX IF NOT EXISTS kpe_dupes_matched_idx        ON nex.kpe_duplicates (matched_chunk_id);
CREATE INDEX IF NOT EXISTS kpe_dupes_detected_idx       ON nex.kpe_duplicates (detected_at DESC);

-- ── kpe_edges (forever · knowledge graph) ───────────────────────────
CREATE TABLE IF NOT EXISTS nex.kpe_edges (
  edge_id              UUID PRIMARY KEY,
  from_id              TEXT NOT NULL,
  to_id                TEXT NOT NULL,
  type                 TEXT NOT NULL,
  confidence           REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at           TIMESTAMPTZ NOT NULL,
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kpe_edges_from_type_idx      ON nex.kpe_edges (from_id, type);
CREATE INDEX IF NOT EXISTS kpe_edges_to_type_idx        ON nex.kpe_edges (to_id, type);
CREATE INDEX IF NOT EXISTS kpe_edges_type_idx           ON nex.kpe_edges (type);
CREATE INDEX IF NOT EXISTS kpe_edges_business_id_idx    ON nex.kpe_edges (business_id, created_at DESC) WHERE business_id IS NOT NULL;

-- ── kpe_processing_runs (180 days) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.kpe_processing_runs (
  run_id               UUID PRIMARY KEY,
  document_id          UUID NOT NULL,
  source               TEXT,
  started_at           TIMESTAMPTZ NOT NULL,
  finished_at          TIMESTAMPTZ,
  stages_completed     JSONB NOT NULL DEFAULT '[]'::jsonb,
  errors               JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_outcome        TEXT,
  chunks_created       INTEGER,
  decisions_made       INTEGER,
  brain_writes         INTEGER,
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kpe_runs_doc_idx             ON nex.kpe_processing_runs (document_id);
CREATE INDEX IF NOT EXISTS kpe_runs_started_idx         ON nex.kpe_processing_runs (started_at DESC);

-- ── kpe_human_reviews (forever) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.kpe_human_reviews (
  review_id            UUID PRIMARY KEY,
  chunk_id             UUID NOT NULL,
  document_id          UUID NOT NULL,
  decision             TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  admin                TEXT NOT NULL,
  reason               TEXT,
  decided_at           TIMESTAMPTZ NOT NULL,
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kpe_reviews_chunk_idx        ON nex.kpe_human_reviews (chunk_id);
CREATE INDEX IF NOT EXISTS kpe_reviews_decision_ts_idx  ON nex.kpe_human_reviews (decision, decided_at DESC);
CREATE INDEX IF NOT EXISTS kpe_reviews_admin_ts_idx     ON nex.kpe_human_reviews (admin, decided_at DESC);

-- ── RLS for all 8 KPE tables ────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'kpe_documents', 'kpe_chunks', 'kpe_metadata', 'kpe_decisions',
    'kpe_duplicates', 'kpe_edges', 'kpe_processing_runs', 'kpe_human_reviews'
  ]) LOOP
    EXECUTE format('ALTER TABLE nex.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = t AND policyname = 'service_role_all_' || t) THEN
      EXECUTE format('CREATE POLICY %I ON nex.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        'service_role_all_' || t, t);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE nex.kpe_documents        IS 'Infrastructure Runtime §5.8 · KPE documents · retention forever';
COMMENT ON TABLE nex.kpe_chunks           IS 'Infrastructure Runtime §5.8 · KPE chunks · retention forever';
COMMENT ON TABLE nex.kpe_metadata         IS 'Infrastructure Runtime §5.8 · KPE metadata · retention forever';
COMMENT ON TABLE nex.kpe_decisions        IS 'Infrastructure Runtime §5.8 · KPE routing decisions · retention forever';
COMMENT ON TABLE nex.kpe_duplicates       IS 'Infrastructure Runtime §5.8 · KPE duplicate detections · 90d retention';
COMMENT ON TABLE nex.kpe_edges            IS 'Infrastructure Runtime §5.8 · KPE knowledge graph edges · retention forever';
COMMENT ON TABLE nex.kpe_processing_runs  IS 'Infrastructure Runtime §5.8 · KPE processing runs · 180d retention';
COMMENT ON TABLE nex.kpe_human_reviews    IS 'Infrastructure Runtime §5.8 · KPE human review decisions · retention forever';
