-- db/migrations/006_nex_english_brain_v1.sql
--
-- Founder BEGIN 2026-09-11 · NEX English Brain v1 · ADR-0308.
--
-- One canonical NEX English knowledge substrate consumed by both NEX Chat and
-- NEX1. Six tables: concepts · concept_senses · contexts · relationships ·
-- questions · answers · evidence.
--
-- Every rule from ADR-0308 encoded here:
--   · nex.concepts = canonical concept (canonical_key unique)
--   · nex.concept_senses = distinct meanings (concept_id + sense_key unique)
--   · sense_key is stable canonical identifier (not just a label)
--   · Evidence attaches to the sense (via nex.evidence subject_kind='sense')
--   · Postgres authoritative · memory is cache only
--
-- Idempotent · uses CREATE IF NOT EXISTS. Safe to re-run.

BEGIN;

-- Ensure nex schema exists (already present per prior migrations · guard anyway).
CREATE SCHEMA IF NOT EXISTS nex;

-- pgcrypto for gen_random_uuid() · standard in nex_dev.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── nex.concepts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.concepts (
  concept_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key    text NOT NULL UNIQUE,
  display_name     text NOT NULL,
  layer            smallint NOT NULL DEFAULT 1
                   CHECK (layer BETWEEN 1 AND 5),
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'guardian_ok', 'truth_engine_ok', 'authoritative', 'deprecated')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS concepts_layer_status_idx ON nex.concepts (layer, status);
CREATE INDEX IF NOT EXISTS concepts_canonical_key_idx ON nex.concepts (canonical_key);

-- ── nex.concept_senses ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.concept_senses (
  sense_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id       uuid NOT NULL REFERENCES nex.concepts(concept_id) ON DELETE CASCADE,
  sense_key        text NOT NULL,
  description      text NOT NULL,
  domain_hint      text[] NOT NULL DEFAULT '{}'::text[],
  examples         jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence       numeric(4,3) NOT NULL DEFAULT 0.500 CHECK (confidence BETWEEN 0 AND 1),
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'guardian_ok', 'truth_engine_ok', 'authoritative', 'deprecated', 'contradicted')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concept_id, sense_key)
);
CREATE INDEX IF NOT EXISTS concept_senses_concept_id_idx ON nex.concept_senses (concept_id);
CREATE INDEX IF NOT EXISTS concept_senses_domain_gin      ON nex.concept_senses USING gin (domain_hint);
CREATE INDEX IF NOT EXISTS concept_senses_status_idx      ON nex.concept_senses (status);

-- ── nex.contexts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.contexts (
  context_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sense_id         uuid NOT NULL REFERENCES nex.concept_senses(sense_id) ON DELETE CASCADE,
  surface_signal   text NOT NULL,
  signal_kind      text NOT NULL CHECK (signal_kind IN ('cooccur_token','cooccur_phrase','domain_hint','grammatical_role')),
  weight           numeric(4,3) NOT NULL DEFAULT 0.500 CHECK (weight BETWEEN 0 AND 1),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contexts_sense_id_idx    ON nex.contexts (sense_id);
CREATE INDEX IF NOT EXISTS contexts_surface_idx     ON nex.contexts (surface_signal);
CREATE INDEX IF NOT EXISTS contexts_signal_kind_idx ON nex.contexts (signal_kind);

-- ── nex.relationships ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.relationships (
  relationship_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_concept_id uuid NOT NULL REFERENCES nex.concepts(concept_id) ON DELETE CASCADE,
  target_concept_id uuid NOT NULL REFERENCES nex.concepts(concept_id) ON DELETE CASCADE,
  relation_kind    text NOT NULL CHECK (relation_kind IN ('synonym','antonym','hypernym','hyponym','related','domain_of','derived_from','part_of')),
  confidence       numeric(4,3) NOT NULL DEFAULT 0.500 CHECK (confidence BETWEEN 0 AND 1),
  source_sense_id  uuid REFERENCES nex.concept_senses(sense_id) ON DELETE SET NULL,
  target_sense_id  uuid REFERENCES nex.concept_senses(sense_id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_concept_id, target_concept_id, relation_kind, source_sense_id, target_sense_id)
);
CREATE INDEX IF NOT EXISTS relationships_source_idx   ON nex.relationships (source_concept_id);
CREATE INDEX IF NOT EXISTS relationships_target_idx   ON nex.relationships (target_concept_id);
CREATE INDEX IF NOT EXISTS relationships_kind_idx     ON nex.relationships (relation_kind);

-- ── nex.questions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.questions (
  question_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface_pattern  text NOT NULL,
  intent_slug      text NOT NULL,
  entity_slots     jsonb NOT NULL DEFAULT '[]'::jsonb,
  concept_id       uuid REFERENCES nex.concepts(concept_id) ON DELETE SET NULL,
  answer_type      text NOT NULL,
  confidence       numeric(4,3) NOT NULL DEFAULT 0.500 CHECK (confidence BETWEEN 0 AND 1),
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','guardian_ok','truth_engine_ok','authoritative','deprecated')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS questions_intent_idx      ON nex.questions (intent_slug);
CREATE INDEX IF NOT EXISTS questions_concept_id_idx  ON nex.questions (concept_id);

-- ── nex.answers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.answers (
  answer_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      uuid REFERENCES nex.questions(question_id) ON DELETE CASCADE,
  sense_id         uuid REFERENCES nex.concept_senses(sense_id) ON DELETE CASCADE,
  body             text NOT NULL,
  answer_kind      text NOT NULL CHECK (answer_kind IN ('definition','steps','list','fact','clarify','unknown')),
  confidence       numeric(4,3) NOT NULL DEFAULT 0.500 CHECK (confidence BETWEEN 0 AND 1),
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','guardian_ok','truth_engine_ok','authoritative','deprecated','contradicted')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (question_id IS NOT NULL OR sense_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS answers_question_idx ON nex.answers (question_id);
CREATE INDEX IF NOT EXISTS answers_sense_idx    ON nex.answers (sense_id);
CREATE INDEX IF NOT EXISTS answers_status_idx   ON nex.answers (status);

-- ── nex.evidence ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.evidence (
  evidence_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind     text NOT NULL CHECK (subject_kind IN ('concept','sense','question','answer','relationship','context')),
  subject_id       uuid NOT NULL,
  source_ref       text NOT NULL,
  trust_layer      text NOT NULL CHECK (trust_layer IN ('canonical_verified','canonical_unverified','evidence_verified','evidence_provisional','unknown')),
  confidence       numeric(4,3) NOT NULL DEFAULT 0.500 CHECK (confidence BETWEEN 0 AND 1),
  captured_at      timestamptz NOT NULL DEFAULT now(),
  captured_by      text NOT NULL,
  cycle_run_id     uuid
);
CREATE INDEX IF NOT EXISTS evidence_subject_idx ON nex.evidence (subject_kind, subject_id);
CREATE INDEX IF NOT EXISTS evidence_trust_idx   ON nex.evidence (trust_layer);
CREATE INDEX IF NOT EXISTS evidence_captured_by_idx ON nex.evidence (captured_by);

COMMIT;

-- Verification: every table + index should exist post-commit.
-- \dt nex.concept*
-- \dt nex.contexts
-- \dt nex.relationships
-- \dt nex.questions
-- \dt nex.answers
-- \dt nex.evidence
