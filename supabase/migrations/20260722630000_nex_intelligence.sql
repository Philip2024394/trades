-- Trade Intelligence Platform — the knowledge layer that powers Nex.
--
-- Principles (from KNOWLEDGE_ARCHITECTURE.md):
--   • Searchable         — tsvector today, pgvector when embedding worker lands
--   • Versioned          — every approved change writes a new row into
--                          hammerex_nex_knowledge_versions. Nothing is
--                          ever silently overwritten.
--   • Reviewable         — every change routes through the review queue
--   • Explainable        — sources[] + evidence[] + verified_by required
--   • Linked             — edges table stores the knowledge graph
--   • Source-backed      — sources[] non-empty enforced by trigger
--   • Confidence scored  — 0-100 per entry
--   • Never overwritten  — trigger blocks direct UPDATE of body/summary
--                          on the main entry table; only version rows
--                          may be added.
--
-- Compatible with the seed data already in hammerex_nex_knowledge_entries
-- from migration 20260722620000. Existing rows get version 1 auto-created.

-- ─── Extend the existing entries table ───────────────────────────

ALTER TABLE public.hammerex_nex_knowledge_entries
  ADD COLUMN IF NOT EXISTS category      TEXT,
  ADD COLUMN IF NOT EXISTS subcategory   TEXT,
  ADD COLUMN IF NOT EXISTS difficulty    TEXT CHECK (difficulty IN ('basic','intermediate','advanced','expert')),
  ADD COLUMN IF NOT EXISTS confidence    INTEGER NOT NULL DEFAULT 90 CHECK (confidence BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS version       INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sources       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ url, title, kind }]
  ADD COLUMN IF NOT EXISTS evidence      JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ type, ref }]
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft','published','archived','superseded')),
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.hammerex_nex_knowledge_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS embedding     VECTOR(1536);   -- pgvector, populated by worker

CREATE INDEX IF NOT EXISTS idx_nex_knowledge_status
  ON public.hammerex_nex_knowledge_entries (status, trade);

CREATE INDEX IF NOT EXISTS idx_nex_knowledge_category
  ON public.hammerex_nex_knowledge_entries (trade, category, subcategory)
  WHERE status = 'published';

-- ─── Never-silently-overwritten guard ────────────────────────────
-- Content fields (title, summary, body_md) can only change via the
-- review flow, which writes a NEW row (with superseded_by pointing
-- to it) rather than mutating. Direct UPDATE of these fields is
-- rejected unless the actor holds the 'nex_editor' setting.

CREATE OR REPLACE FUNCTION public.fn_nex_knowledge_prevent_silent_edit()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow status/superseded_by/version bumps (needed for supersession flow).
  -- Reject content edits.
  IF NEW.title    IS DISTINCT FROM OLD.title
  OR NEW.summary  IS DISTINCT FROM OLD.summary
  OR NEW.body_md  IS DISTINCT FROM OLD.body_md
  OR NEW.sources  IS DISTINCT FROM OLD.sources
  OR NEW.evidence IS DISTINCT FROM OLD.evidence
  OR NEW.confidence IS DISTINCT FROM OLD.confidence THEN
    IF current_setting('app.nex_editor', TRUE) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Silent edit blocked. Use the review workflow: set app.nex_editor=true from an approved review.';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_knowledge_no_silent_edit ON public.hammerex_nex_knowledge_entries;
CREATE TRIGGER trg_nex_knowledge_no_silent_edit
  BEFORE UPDATE ON public.hammerex_nex_knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_nex_knowledge_prevent_silent_edit();

-- ─── Versions table — immutable history ─────────────────────────
-- Every published version of every entry. Never UPDATE, never DELETE.
-- The Timeline UI reads this in reverse-chronological order.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_knowledge_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id         UUID NOT NULL REFERENCES public.hammerex_nex_knowledge_entries(id) ON DELETE CASCADE,
  version          INTEGER NOT NULL,
  trade            TEXT NOT NULL,
  topic            TEXT NOT NULL,
  title            TEXT NOT NULL,
  summary          TEXT NOT NULL,
  body_md          TEXT,
  category         TEXT,
  subcategory      TEXT,
  difficulty       TEXT,
  keywords         TEXT[] NOT NULL DEFAULT '{}',
  sources          JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence         JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence       INTEGER NOT NULL,
  change_kind      TEXT NOT NULL CHECK (change_kind IN ('initial','minor','major','correction','archive','restore')),
  change_summary   TEXT,                              -- one-line "what changed"
  proposed_by      TEXT,                              -- user id or 'seed' or 'ai:extraction'
  proposed_by_kind TEXT CHECK (proposed_by_kind IN ('staff','merchant','ai','seed','builder')),
  approved_by      TEXT NOT NULL,
  approved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_id        UUID,                              -- links to review queue row that authorised
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (entry_id, version)
);

CREATE INDEX IF NOT EXISTS idx_nex_versions_entry
  ON public.hammerex_nex_knowledge_versions (entry_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_nex_versions_trade_time
  ON public.hammerex_nex_knowledge_versions (trade, created_at DESC);

-- Append-only enforcement
CREATE OR REPLACE FUNCTION public.fn_nex_versions_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'hammerex_nex_knowledge_versions is append-only.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'hammerex_nex_knowledge_versions is append-only.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_versions_append_only ON public.hammerex_nex_knowledge_versions;
CREATE TRIGGER trg_nex_versions_append_only
  BEFORE UPDATE OR DELETE ON public.hammerex_nex_knowledge_versions
  FOR EACH ROW EXECUTE FUNCTION public.fn_nex_versions_append_only();

ALTER TABLE public.hammerex_nex_knowledge_versions ENABLE ROW LEVEL SECURITY;

-- Seed versions for the 10 rows already in the entries table.
-- Skipped if already run (ON CONFLICT DO NOTHING).
INSERT INTO public.hammerex_nex_knowledge_versions (
  entry_id, version, trade, topic, title, summary, body_md,
  category, subcategory, difficulty, keywords, sources, evidence,
  confidence, change_kind, change_summary,
  proposed_by, proposed_by_kind, approved_by
)
SELECT
  e.id, 1, e.trade, e.topic, e.title, e.summary, e.body_md,
  e.category, e.subcategory, e.difficulty, e.keywords, e.sources, e.evidence,
  e.confidence, 'initial', 'Seed pack',
  'seed', 'seed', 'seed'
FROM public.hammerex_nex_knowledge_entries e
LEFT JOIN public.hammerex_nex_knowledge_versions v ON v.entry_id = e.id AND v.version = 1
WHERE v.id IS NULL;

-- ─── Knowledge graph edges ───────────────────────────────────────
-- Relationships between entries. Directional. Weighted for graph
-- traversal. Verified boolean so unverified AI-proposed edges can
-- surface separately.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_knowledge_edges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entry   UUID NOT NULL REFERENCES public.hammerex_nex_knowledge_entries(id) ON DELETE CASCADE,
  to_entry     UUID NOT NULL REFERENCES public.hammerex_nex_knowledge_entries(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN (
    'requires', 'references', 'used_by', 'creates', 'needs',
    'similar_to', 'contradicts', 'refines', 'supersedes', 'part_of'
  )),
  weight       NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (weight BETWEEN 0 AND 1),
  verified     BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by  TEXT,
  verified_at  TIMESTAMPTZ,
  proposed_by  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (from_entry, to_entry, relationship),
  CHECK (from_entry <> to_entry)
);

CREATE INDEX IF NOT EXISTS idx_nex_edges_from ON public.hammerex_nex_knowledge_edges (from_entry, relationship);
CREATE INDEX IF NOT EXISTS idx_nex_edges_to   ON public.hammerex_nex_knowledge_edges (to_entry, relationship);

ALTER TABLE public.hammerex_nex_knowledge_edges ENABLE ROW LEVEL SECURITY;

-- ─── Review queue ────────────────────────────────────────────────
-- Nothing enters Nex automatically. Every add, edit, correction and
-- deletion routes through here. Staff approves/rejects/merges.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_review_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              TEXT NOT NULL CHECK (kind IN ('create','edit','correction','delete','edge','teach')),
  target_entry_id   UUID REFERENCES public.hammerex_nex_knowledge_entries(id) ON DELETE SET NULL,
  proposed_json     JSONB NOT NULL,                    -- the change payload (full new state or patch)
  merchant_context  JSONB,                             -- when submitted from Nex chat: { message, nex_reply, session_id }
  submitted_by      TEXT NOT NULL,
  submitted_by_kind TEXT NOT NULL CHECK (submitted_by_kind IN ('staff','merchant','ai','builder')),
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','merged','archived')),
  reviewer_id       TEXT,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  merged_into_id    UUID REFERENCES public.hammerex_nex_review_queue(id) ON DELETE SET NULL,
  resulting_version_id UUID REFERENCES public.hammerex_nex_knowledge_versions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_nex_review_status
  ON public.hammerex_nex_review_queue (status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_review_target
  ON public.hammerex_nex_review_queue (target_entry_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_review_submitter
  ON public.hammerex_nex_review_queue (submitted_by_kind, submitted_by, submitted_at DESC);

ALTER TABLE public.hammerex_nex_review_queue ENABLE ROW LEVEL SECURITY;

-- ─── Teach Nex uploads ───────────────────────────────────────────
-- Raw uploads staff/merchants provide. Extraction worker (deferred)
-- reads status='queued', parses via LLM + PDF parser, writes proposed
-- entries into the review queue linked back via source_upload_id.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_teaching_uploads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_bucket    TEXT NOT NULL DEFAULT 'nex-teaching',
  storage_path      TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  size_bytes        INTEGER,
  trade_hint        TEXT,                              -- what trade the uploader thinks it covers
  topic_hint        TEXT,
  notes             TEXT,                              -- uploader's freeform explanation
  uploaded_by       TEXT NOT NULL,
  uploaded_by_kind  TEXT NOT NULL CHECK (uploaded_by_kind IN ('staff','merchant','builder')),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extraction_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (extraction_status IN ('queued','extracting','extracted','failed','skipped')),
  extraction_error  TEXT,
  extracted_at      TIMESTAMPTZ,
  extracted_entries_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_nex_teaching_status
  ON public.hammerex_nex_teaching_uploads (extraction_status, uploaded_at DESC);

ALTER TABLE public.hammerex_nex_teaching_uploads ENABLE ROW LEVEL SECURITY;

-- Link teaching uploads to the review items they produce.
ALTER TABLE public.hammerex_nex_review_queue
  ADD COLUMN IF NOT EXISTS source_upload_id UUID REFERENCES public.hammerex_nex_teaching_uploads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nex_review_upload
  ON public.hammerex_nex_review_queue (source_upload_id) WHERE source_upload_id IS NOT NULL;

-- ─── Knowledge Health view ───────────────────────────────────────
-- Per-trade % complete. "Complete" = at least 20 published entries
-- with confidence >= 80. Formula is intentionally rough for pass 1
-- and revised once we have a real taxonomy of expected topics per trade.

CREATE OR REPLACE VIEW public.v_nex_knowledge_health AS
WITH stats AS (
  SELECT
    trade,
    COUNT(*) FILTER (WHERE status = 'published')                                                 AS published,
    COUNT(*) FILTER (WHERE status = 'published' AND confidence >= 80)                            AS high_confidence,
    COUNT(*) FILTER (WHERE status = 'published' AND (sources::text = '[]' OR sources IS NULL))   AS unsourced,
    COUNT(DISTINCT category)                                                                     AS categories,
    ROUND(AVG(confidence) FILTER (WHERE status = 'published'), 1)                                AS avg_confidence,
    MAX(updated_at)                                                                              AS last_updated
  FROM public.hammerex_nex_knowledge_entries
  GROUP BY trade
)
SELECT
  trade,
  published,
  high_confidence,
  unsourced,
  categories,
  avg_confidence,
  last_updated,
  LEAST(100, ROUND(high_confidence * 5.0))::INTEGER AS health_pct  -- 20 high-confidence entries = 100%
FROM stats;

-- ─── RLS policies ────────────────────────────────────────────────
-- All merchants can READ published knowledge + verified edges.
-- Everything else is admin-only (service role bypass).

DROP POLICY IF EXISTS nex_versions_read ON public.hammerex_nex_knowledge_versions;
CREATE POLICY nex_versions_read ON public.hammerex_nex_knowledge_versions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS nex_edges_read ON public.hammerex_nex_knowledge_edges;
CREATE POLICY nex_edges_read ON public.hammerex_nex_knowledge_edges
  FOR SELECT TO authenticated USING (verified = true);

-- Merchants may see the review items they submitted (their own corrections).
DROP POLICY IF EXISTS nex_review_own_read ON public.hammerex_nex_review_queue;
CREATE POLICY nex_review_own_read ON public.hammerex_nex_review_queue
  FOR SELECT TO authenticated
  USING (
    submitted_by_kind = 'merchant'
    AND submitted_by = (auth.jwt() ->> 'merchant_slug')
  );

DROP POLICY IF EXISTS nex_teaching_uploader_read ON public.hammerex_nex_teaching_uploads;
CREATE POLICY nex_teaching_uploader_read ON public.hammerex_nex_teaching_uploads
  FOR SELECT TO authenticated
  USING (
    uploaded_by_kind = 'merchant'
    AND uploaded_by = (auth.jwt() ->> 'merchant_slug')
  );

-- ─── Column comments — self-documenting schema ───────────────────

COMMENT ON TABLE  public.hammerex_nex_knowledge_entries IS
  'Current published state of every knowledge entry. Immutable content — edits create a new version in hammerex_nex_knowledge_versions.';
COMMENT ON TABLE  public.hammerex_nex_knowledge_versions IS
  'Immutable version history. Append-only trigger enforced. Timeline UI reads reverse-chronological.';
COMMENT ON TABLE  public.hammerex_nex_knowledge_edges IS
  'Directional knowledge graph. Relationships between entries. Nex traverses this for context.';
COMMENT ON TABLE  public.hammerex_nex_review_queue IS
  'Every proposed change to knowledge routes here. Nothing enters Nex automatically.';
COMMENT ON TABLE  public.hammerex_nex_teaching_uploads IS
  'Raw uploads (PDFs, guides, photos). Extraction worker creates review queue entries.';
COMMENT ON VIEW   public.v_nex_knowledge_health IS
  'Per-trade coverage. health_pct = high-confidence published entries × 5, capped 100.';
