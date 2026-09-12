-- 148_nex_semantic_index.sql
--
-- NEX LIVE CHAT · SEMANTIC RETRIEVAL · Phase 3.4B · storage layer.
-- Founder BEGIN Phase 3.4B · Master AI Engineer · 2026-09-09.
--
-- Doctrine anchor:
--   Founder Phase 3.4A/B/C restructure 2026-09-09:
--     Exact → Structured → Semantic → LLM Rescue → Web Acquisition
--   LLM rescue never bypasses the Truth Engine · semantic hits are
--   candidates for verification, not answers on their own.
--
-- Purpose (STRICT this migration):
--   1. nex.semantic_entity_index    · one row per entity_ref · holds an
--      embedding of the canonical name (+ aliases) for name-paraphrase
--      resolution ("Hotel Gaotama" vs "Gaotama Hotel" vs "Gaotama").
--   2. nex.semantic_question_index  · one row per answered question_variant
--      · holds an embedding of the normalised text for query paraphrase
--      matching ("how many rooms" vs "room count" vs "jumlah kamar").
--
-- Design decisions:
--   · Embedding stored as JSONB (real number[]) so the schema is
--     portable across Postgres deployments without requiring pgvector.
--     When pgvector lands in the target Postgres, a follow-up migration
--     can ALTER TYPE to vector(dim) with a compatible cast.
--   · embedding_model column captures which model produced the vector
--     so multiple models can coexist during a rolling switch (mock →
--     ollama:nomic-embed-text → transformers-js:all-MiniLM-L6-v2 etc.).
--   · dim column so consumers can validate before doing cosine math.
--   · updated_at index so backpop can resume from the newest row.
--
-- What this migration does NOT do:
--   · does NOT alter existing tables
--   · does NOT insert rows
--   · does NOT require the pgvector extension
--
-- Reversible:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.semantic_question_index CASCADE;
--     DROP TABLE IF EXISTS nex.semantic_entity_index CASCADE;
--   COMMIT;

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- semantic_entity_index · per-entity vectors
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.semantic_entity_index (
  entity_ref            text        NOT NULL,
  domain                text        NOT NULL,
  embedding_model       text        NOT NULL,
  embedding             jsonb       NOT NULL,           -- number[] · unit-normalised
  dim                   integer     NOT NULL,
  source_text           text        NOT NULL,           -- what was embedded (canonical name + aliases)
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain, entity_ref, embedding_model)
);

CREATE INDEX IF NOT EXISTS idx_nex_semantic_entity_index_updated
  ON nex.semantic_entity_index (updated_at DESC);

COMMENT ON TABLE nex.semantic_entity_index IS
  'Founder BEGIN Phase 3.4B · per-entity semantic vector. Multiple embedding_models may coexist. Vector stored as JSONB for portability · pgvector migration is additive.';

-- ═══════════════════════════════════════════════════════════════════
-- semantic_question_index · per-answered-variant vectors
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.semantic_question_index (
  fingerprint           text        NOT NULL,           -- FK-like to nex.question_variant.fingerprint
  domain                text        NOT NULL,
  embedding_model       text        NOT NULL,
  embedding             jsonb       NOT NULL,
  dim                   integer     NOT NULL,
  source_text           text        NOT NULL,           -- normalised question text
  entity_ref            text        NULL,
  intent_slug           text        NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fingerprint, embedding_model)
);

CREATE INDEX IF NOT EXISTS idx_nex_semantic_question_index_domain
  ON nex.semantic_question_index (domain, embedding_model);

CREATE INDEX IF NOT EXISTS idx_nex_semantic_question_index_updated
  ON nex.semantic_question_index (updated_at DESC);

COMMENT ON TABLE nex.semantic_question_index IS
  'Founder BEGIN Phase 3.4B · per-answered-variant semantic vector. Enables paraphrase matching against previously-verified questions.';
