-- 152_nex_gate_rejection_event.sql
--
-- NEX FABRICATION GATE v2 · REJECTION EVENT LOG · Phase C1 · Migration 152.
-- Founder Path A/B · ECO-1 activation · 2026-09-09.
--
-- Purpose:
--   Every claim rejected by the LLM-rescue Fabrication Gate produces one
--   append-only row here. The Observatory Brain reads this table to
--   report REAL groundedness metrics (postrationalisation_rate,
--   alignment percentiles) instead of the placeholder zeros.
--
-- Doctrine coverage:
--   #1 orphan citations           → reason='orphan_citation'
--   #1 postrationalisation        → reason='postrationalisation'   (Gate v2)
--   #4 memory citations           → reason='doctrine_4_memory'
--   miscellaneous missing fields  → reason='missing_fields'
--
-- Rows are append-only. No PII beyond the claim text and source_ref
-- that the LLM produced. If a caller wants to purge historical rows
-- they use TRUNCATE (documented, deliberate).

CREATE SCHEMA IF NOT EXISTS nex;

CREATE TABLE IF NOT EXISTS nex.gate_rejection_event (
  event_id            uuid        PRIMARY KEY,
  emitted_at          timestamptz NOT NULL DEFAULT now(),
  conversation_id     text        NULL,
  provider_model      text        NULL,
  reason              text        NOT NULL,               -- orphan_citation · postrationalisation · doctrine_4_memory · missing_fields
  source_ref          text        NULL,                   -- the ref the LLM tried to cite
  alignment_score     double precision NULL,              -- 0..1 · present for postrationalisation
  alignment_threshold double precision NULL,              -- 0..1 · what the score was compared against
  claim_text_preview  text        NULL,                   -- first 200 chars of the rejected claim
  gate_version        text        NOT NULL DEFAULT 'v2',
  CONSTRAINT gate_rejection_event_alignment_bounds
    CHECK (alignment_score IS NULL OR (alignment_score >= 0 AND alignment_score <= 1))
);

CREATE INDEX IF NOT EXISTS idx_nex_gate_rejection_recent
  ON nex.gate_rejection_event (emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_gate_rejection_reason
  ON nex.gate_rejection_event (reason, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_gate_rejection_conversation
  ON nex.gate_rejection_event (conversation_id, emitted_at DESC);

-- Companion: kept-claims counter so we can compute
-- postrationalisation_rate = postrationalisation_rejects / (kept + postrationalisation_rejects).
-- Same table structure so a single query can UNION.
CREATE TABLE IF NOT EXISTS nex.gate_kept_event (
  event_id            uuid        PRIMARY KEY,
  emitted_at          timestamptz NOT NULL DEFAULT now(),
  conversation_id     text        NULL,
  provider_model      text        NULL,
  source_ref          text        NULL,
  alignment_score     double precision NULL,
  alignment_threshold double precision NULL,
  gate_version        text        NOT NULL DEFAULT 'v2',
  CONSTRAINT gate_kept_event_alignment_bounds
    CHECK (alignment_score IS NULL OR (alignment_score >= 0 AND alignment_score <= 1))
);

CREATE INDEX IF NOT EXISTS idx_nex_gate_kept_recent
  ON nex.gate_kept_event (emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_gate_kept_conversation
  ON nex.gate_kept_event (conversation_id, emitted_at DESC);

COMMENT ON TABLE nex.gate_rejection_event IS
  'Founder Path A · Phase C1 · append-only log of Fabrication Gate v2 rejections. Feeds Observatory groundedness metrics.';
COMMENT ON TABLE nex.gate_kept_event IS
  'Founder Path A · Phase C1 · append-only log of claims that survived Fabrication Gate v2. Used to compute postrationalisation_rate.';
