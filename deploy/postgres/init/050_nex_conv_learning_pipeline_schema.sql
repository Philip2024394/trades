-- 050_nex_conv_learning_pipeline_schema.sql
--
-- ADR-0044 · Conversational Learning Pipeline · schema-only migration.
--
-- Motivation
--   NEX ships a single conversational-learning pipeline that turns large
--   volumes of Q&A + conversation data into a structured graph the
--   Conversational Intelligence layer can retrieve from and reason across.
--   This migration lands the storage substrate. Ingestion code, live
--   inference wiring, and admin review UI ship independently.
--
-- What ships in this migration
--   1  Enable pgvector extension when available (idempotent · soft-try).
--   2  Eight tables under the existing `nex` schema, prefixed `conv_`:
--        conv_knowledge_items · conv_entities · conv_intents · conv_edges
--        conv_states · conv_turns · conv_outcomes · conv_feedback
--   3  Indexes for hybrid retrieval (GIN entity/topic · brain · vector when
--      pgvector is present).
--   4  Check constraints enforcing enum-like fields at the DB.
--
-- ---------------------------------------------------------------------------
-- pgvector · canonical vs dev-fallback
-- ---------------------------------------------------------------------------
-- CANONICAL (per ADR-0044): the `embedding` columns on conv_knowledge_items
-- and conv_entities are `VECTOR(384)` with an `ivfflat vector_cosine_ops`
-- index for fast nearest-neighbour retrieval. This is what the hosted
-- Supabase project gets (pgvector is preinstalled).
--
-- DEV FALLBACK: when pgvector is NOT available (some native Windows Postgres
-- installs lack the extension), this migration transparently creates the
-- embedding columns as `JSONB` and skips the vector index. Cosine similarity
-- is computed in application code (see scripts/nex-conv/lib/embed.mjs). Every
-- other column, constraint, index, trigger, comment, and enum matches the
-- canonical schema exactly. Only the embedding column type differs.
--
-- The PostgresStore adapter is agnostic to which type the column has — it
-- reads/writes JSONB arrays; when pgvector is present, retrieval can also
-- use the ivfflat operator directly, but hybrid retrieval must merge with
-- entity + graph-walk results and re-rank in application code either way,
-- so the ivfflat path is a performance win, not a correctness requirement.
--
-- PROMOTION: when this migration is applied to a Postgres that DOES have
-- pgvector (typically hosted Supabase), the final DO block detects the
-- extension and, IF both embedding columns are currently JSONB AND both
-- tables are empty (so no data is lost), performs an in-place ALTER to
-- `VECTOR(384)` and creates the ivfflat index. Non-empty tables are left
-- as JSONB and a NOTICE is emitted directing the operator to run a
-- separate data-migration script (out of scope for this ADR).
--
-- Behavior gate
--   Tables are created empty. No application code reads or writes to them
--   until the ingestion pipeline is wired. Safe to apply repeatedly.
--
-- Reversible
--   BEGIN;
--   DROP TABLE IF EXISTS nex.conv_feedback CASCADE;
--   DROP TABLE IF EXISTS nex.conv_outcomes CASCADE;
--   DROP TABLE IF EXISTS nex.conv_turns CASCADE;
--   DROP TABLE IF EXISTS nex.conv_states CASCADE;
--   DROP TABLE IF EXISTS nex.conv_edges CASCADE;
--   DROP TABLE IF EXISTS nex.conv_intents CASCADE;
--   DROP TABLE IF EXISTS nex.conv_entities CASCADE;
--   DROP TABLE IF EXISTS nex.conv_knowledge_items CASCADE;
--   -- (pgvector extension left in place; used elsewhere in NEX)
--   COMMIT;

-- ---------------------------------------------------------------------------
-- 0 · Schema
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS nex;

-- ---------------------------------------------------------------------------
-- 1 · Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- Try pgvector; do not fail if unavailable (dev fallback path).
DO $body$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE '[050] pgvector present · canonical VECTOR(384) path enabled';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[050] pgvector NOT available on this Postgres · using JSONB fallback for embedding columns (DEV ONLY · canonical VECTOR restored automatically on any pgvector-having Postgres when this migration is re-applied to empty embedding tables)';
  END;
END $body$;

-- ---------------------------------------------------------------------------
-- 2 · Reference tables (intents · entities)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.conv_intents (
  slug              TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL,
  class             TEXT NOT NULL,
  example_phrases   TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conv_intents_class_check CHECK (class IN (
    'discover','specify','compare','price','decide','clarify',
    'correct','object','confirm','revisit','close'
  ))
);

COMMENT ON TABLE  nex.conv_intents IS 'Canonical user-intent taxonomy. Seeded from intent-patterns.md by the ingestion pipeline.';
COMMENT ON COLUMN nex.conv_intents.class IS 'Broad intent class; see ADR-0044 §1.';

CREATE TABLE IF NOT EXISTS nex.conv_entities (
  slug              TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL,
  brain             TEXT NOT NULL,
  entity_class      TEXT NOT NULL,
  aliases           TEXT[] NOT NULL DEFAULT '{}',
  embedding         JSONB,     -- canonical: VECTOR(384) · promoted in §9 when pgvector present
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conv_entities_entity_class_check CHECK (entity_class IN (
    'material','component','style','regulation','service',
    'price_dimension','person','company','process','location','other'
  ))
);

CREATE INDEX IF NOT EXISTS conv_entities_brain_idx ON nex.conv_entities (brain);
CREATE INDEX IF NOT EXISTS conv_entities_aliases_gin ON nex.conv_entities USING gin (aliases);

COMMENT ON TABLE nex.conv_entities IS 'Ontology nodes. Every conv_knowledge_items.entities[] value is a slug here.';

-- ---------------------------------------------------------------------------
-- 3 · Knowledge items (nodes in the conversation graph)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.conv_knowledge_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain             TEXT NOT NULL,
  source_batch      TEXT NOT NULL,
  source_ref        TEXT,
  kind              TEXT NOT NULL,
  question_text     TEXT,
  answer_text       TEXT,
  canonical_intent  TEXT NOT NULL REFERENCES nex.conv_intents(slug) ON UPDATE CASCADE,
  entities          TEXT[] NOT NULL DEFAULT '{}',
  topics            TEXT[] NOT NULL DEFAULT '{}',
  confidence        NUMERIC(4,3) NOT NULL,
  draft_only        BOOLEAN NOT NULL DEFAULT false,
  embedding         JSONB,     -- canonical: VECTOR(384) · promoted in §9 when pgvector present
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conv_ki_kind_check CHECK (kind IN (
    'qa_pair','statement','clarification','correction','recommendation'
  )),
  CONSTRAINT conv_ki_confidence_range CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT conv_ki_confidence_gate  CHECK (confidence >= 0.50),
  CONSTRAINT conv_ki_has_body         CHECK (question_text IS NOT NULL OR answer_text IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS conv_ki_brain_idx           ON nex.conv_knowledge_items (brain);
CREATE INDEX IF NOT EXISTS conv_ki_intent_idx          ON nex.conv_knowledge_items (canonical_intent);
CREATE INDEX IF NOT EXISTS conv_ki_entities_gin        ON nex.conv_knowledge_items USING gin (entities);
CREATE INDEX IF NOT EXISTS conv_ki_topics_gin          ON nex.conv_knowledge_items USING gin (topics);
CREATE INDEX IF NOT EXISTS conv_ki_draft_only_idx      ON nex.conv_knowledge_items (draft_only);

COMMENT ON TABLE  nex.conv_knowledge_items IS 'One atomic Q+A pair or authoritative statement. Node in the conversation graph.';
COMMENT ON COLUMN nex.conv_knowledge_items.draft_only IS 'ADR-0033 gate: confidence 0.50-0.69 items are draft-only and filtered from live retrieval until admin promotes.';
COMMENT ON COLUMN nex.conv_knowledge_items.brain IS 'Brain isolation (ADR-0033 rule #4). Retrieval MUST filter by this.';

-- ---------------------------------------------------------------------------
-- 4 · Conversation graph edges
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.conv_edges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_item         UUID NOT NULL REFERENCES nex.conv_knowledge_items(id) ON DELETE CASCADE,
  to_item           UUID NOT NULL REFERENCES nex.conv_knowledge_items(id) ON DELETE CASCADE,
  edge_type         TEXT NOT NULL,
  weight            NUMERIC(4,3) NOT NULL,
  evidence_count    INTEGER NOT NULL DEFAULT 1,
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conv_edges_type_check CHECK (edge_type IN (
    'answers','clarifies','follows_from','corrects','contradicts',
    'elaborates','alternative_of','comparison_to','prices',
    'requires','recommends','warns_about','related_to'
  )),
  CONSTRAINT conv_edges_weight_range CHECK (weight >= 0 AND weight <= 1),
  CONSTRAINT conv_edges_weight_gate  CHECK (weight >= 0.50),
  CONSTRAINT conv_edges_evidence_positive CHECK (evidence_count >= 1),
  CONSTRAINT conv_edges_no_self_loops CHECK (from_item <> to_item),
  UNIQUE (from_item, to_item, edge_type)
);

CREATE INDEX IF NOT EXISTS conv_edges_from_idx  ON nex.conv_edges (from_item, edge_type);
CREATE INDEX IF NOT EXISTS conv_edges_to_idx    ON nex.conv_edges (to_item, edge_type);
CREATE INDEX IF NOT EXISTS conv_edges_weight_idx ON nex.conv_edges (weight);

COMMENT ON TABLE  nex.conv_edges IS 'Typed conversation-graph edges. Weight is re-scored nightly from feedback outcomes.';
COMMENT ON COLUMN nex.conv_edges.weight IS 'ADR-0044 §1: >=0.85 strong · 0.70-0.84 candidate · 0.50-0.69 graph-link only.';

-- ---------------------------------------------------------------------------
-- 5 · Conversation state (per-session)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.conv_states (
  conversation_id   UUID PRIMARY KEY,
  business_id       UUID,
  brain             TEXT NOT NULL,
  state             JSONB NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conv_states_business_idx ON nex.conv_states (business_id);
CREATE INDEX IF NOT EXISTS conv_states_brain_idx    ON nex.conv_states (brain);
CREATE INDEX IF NOT EXISTS conv_states_state_gin    ON nex.conv_states USING gin (state jsonb_path_ops);

COMMENT ON TABLE nex.conv_states IS 'Per-session structured state. Schema: see ADR-0044 proposal §5. Read+written every turn.';

-- ---------------------------------------------------------------------------
-- 6 · Turn log (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.conv_turns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL,
  turn_index        INTEGER NOT NULL,
  speaker           TEXT NOT NULL,
  text              TEXT NOT NULL,
  detected_intent   TEXT REFERENCES nex.conv_intents(slug) ON UPDATE CASCADE,
  detected_entities TEXT[] NOT NULL DEFAULT '{}',
  used_item_ids     UUID[] NOT NULL DEFAULT '{}',
  walked_edge_ids   UUID[] NOT NULL DEFAULT '{}',
  latency_ms        INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conv_turns_speaker_check CHECK (speaker IN ('customer','owner','nex')),
  CONSTRAINT conv_turns_turn_index_positive CHECK (turn_index >= 0),
  CONSTRAINT conv_turns_latency_nonneg CHECK (latency_ms IS NULL OR latency_ms >= 0),
  UNIQUE (conversation_id, turn_index)
);

CREATE INDEX IF NOT EXISTS conv_turns_convo_idx      ON nex.conv_turns (conversation_id, turn_index);
CREATE INDEX IF NOT EXISTS conv_turns_intent_idx     ON nex.conv_turns (detected_intent);
CREATE INDEX IF NOT EXISTS conv_turns_entities_gin   ON nex.conv_turns USING gin (detected_entities);

COMMENT ON TABLE nex.conv_turns IS 'Append-only per-turn log. Full transcripts live here; the state row carries the summary.';

-- ---------------------------------------------------------------------------
-- 7 · Outcome labels (per-conversation)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.conv_outcomes (
  conversation_id   UUID PRIMARY KEY,
  outcome           TEXT NOT NULL,
  outcome_note      TEXT,
  labelled_by       TEXT NOT NULL,
  labelled_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conv_outcomes_outcome_check CHECK (outcome IN (
    'resolved','clarification_completed','correction_received',
    'user_abandoned','repeated_question','escalated','pending'
  )),
  CONSTRAINT conv_outcomes_labelled_by_check CHECK (labelled_by IN ('auto','owner','admin'))
);

CREATE INDEX IF NOT EXISTS conv_outcomes_outcome_idx ON nex.conv_outcomes (outcome);
CREATE INDEX IF NOT EXISTS conv_outcomes_labelled_at_idx ON nex.conv_outcomes (labelled_at DESC);

COMMENT ON TABLE nex.conv_outcomes IS 'End-of-conversation label. Feeds the nightly edge re-scoring job.';

-- ---------------------------------------------------------------------------
-- 8 · Per-turn feedback signals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.conv_feedback (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id           UUID NOT NULL REFERENCES nex.conv_turns(id) ON DELETE CASCADE,
  signal            TEXT NOT NULL,
  source            TEXT NOT NULL,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conv_feedback_signal_check CHECK (signal IN (
    'helpful','not_helpful','irrelevant','wrong','clarified','corrected',
    'gave_up','followed_recommendation','asked_same_again'
  )),
  CONSTRAINT conv_feedback_source_check CHECK (source IN (
    'explicit','implicit_next_turn','labelled'
  ))
);

CREATE INDEX IF NOT EXISTS conv_feedback_turn_idx    ON nex.conv_feedback (turn_id);
CREATE INDEX IF NOT EXISTS conv_feedback_signal_idx  ON nex.conv_feedback (signal);
CREATE INDEX IF NOT EXISTS conv_feedback_created_idx ON nex.conv_feedback (created_at DESC);

COMMENT ON TABLE nex.conv_feedback IS 'Signal atoms consumed by nightly re-scoring. Explicit signals + implicit inferences.';

-- ---------------------------------------------------------------------------
-- 9 · updated_at triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex.conv_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conv_ki_touch_updated_at ON nex.conv_knowledge_items;
CREATE TRIGGER conv_ki_touch_updated_at
  BEFORE UPDATE ON nex.conv_knowledge_items
  FOR EACH ROW EXECUTE FUNCTION nex.conv_touch_updated_at();

DROP TRIGGER IF EXISTS conv_states_touch_updated_at ON nex.conv_states;
CREATE TRIGGER conv_states_touch_updated_at
  BEFORE UPDATE ON nex.conv_states
  FOR EACH ROW EXECUTE FUNCTION nex.conv_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 10 · ADR-0033 draft-tier trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex.conv_ki_enforce_draft_tier() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.draft_only = false AND NEW.confidence < 0.70 THEN
    RAISE EXCEPTION 'conv_knowledge_items: confidence %.3f < 0.70 requires draft_only=true (ADR-0033)',
      NEW.confidence USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conv_ki_enforce_draft_tier ON nex.conv_knowledge_items;
CREATE TRIGGER conv_ki_enforce_draft_tier
  BEFORE INSERT OR UPDATE ON nex.conv_knowledge_items
  FOR EACH ROW EXECUTE FUNCTION nex.conv_ki_enforce_draft_tier();

-- ---------------------------------------------------------------------------
-- 11 · Optional pgvector promotion (idempotent · safe · empty-tables only)
--
--   IF pgvector is available AND both embedding columns are currently JSONB
--   AND both tables are empty, alter the columns to VECTOR(384) and create
--   the ivfflat cosine index. Non-empty tables are left untouched with a
--   NOTICE — data migration in that case is handled by a separate script.
-- ---------------------------------------------------------------------------

DO $body$
DECLARE
  has_vector boolean;
  ki_embedding_type text;
  ki_row_count bigint;
  ent_row_count bigint;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') INTO has_vector;
  IF NOT has_vector THEN
    RAISE NOTICE '[050 §11] pgvector not installed · leaving embedding columns as JSONB (dev fallback)';
    RETURN;
  END IF;

  SELECT data_type INTO ki_embedding_type
    FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='conv_knowledge_items' AND column_name='embedding';

  IF ki_embedding_type <> 'jsonb' THEN
    RAISE NOTICE '[050 §11] conv_knowledge_items.embedding already type % · no promotion needed', ki_embedding_type;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO ki_row_count  FROM nex.conv_knowledge_items;
  SELECT COUNT(*) INTO ent_row_count FROM nex.conv_entities;

  IF ki_row_count > 0 OR ent_row_count > 0 THEN
    RAISE NOTICE '[050 §11] pgvector available but tables not empty (ki=% entities=%) · leaving JSONB. Data migration is out of scope for this migration.', ki_row_count, ent_row_count;
    RETURN;
  END IF;

  ALTER TABLE nex.conv_knowledge_items ALTER COLUMN embedding TYPE vector(384) USING NULL;
  ALTER TABLE nex.conv_entities        ALTER COLUMN embedding TYPE vector(384) USING NULL;
  CREATE INDEX IF NOT EXISTS conv_ki_embedding_ivfflat
    ON nex.conv_knowledge_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);
  RAISE NOTICE '[050 §11] pgvector promotion complete · embedding columns are now VECTOR(384) with ivfflat cosine index';
END $body$;

-- ---------------------------------------------------------------------------
-- End of 050_nex_conv_learning_pipeline_schema.sql
-- ---------------------------------------------------------------------------
