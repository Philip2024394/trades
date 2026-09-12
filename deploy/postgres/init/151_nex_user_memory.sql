-- 151_nex_user_memory.sql
--
-- NEX LIVE CHAT · L2 LONG-TERM MEMORY + USER IDENTITY · Phase 3.10 · Migration 151.
-- Founder BEGIN Phase 3.10 · Master AI Engineer · 2026-09-09.
--
-- Purpose:
--   1. nex.user_profile · one row per user_id · holds custom_instructions +
--      display_name. Upserted on every user interaction. Timestamps track
--      identity freshness.
--   2. nex.user_memory · N rows per user · each an individual claim about
--      the user (preference · constraint · identity · context · correction).
--      Rows carry stable memory_id · category · confidence · optional TTL.
--      Trust ceiling for the retrieval bundle mapper = evidence_provisional.
--   3. Both tables are append-friendly (user_memory rows may be soft-deleted
--      via deleted_at) but never contain third-party PII beyond what the
--      user themselves stated in-turn.
--
-- FOUNDER DOCTRINE #4 (2026-09-09):
--   "Memory informs context. Memory does NOT establish truth."
--   Memories are NEVER converted into EvidenceItem records. They surface
--   only via bundle.user_context (PersonalizationContext). There is no
--   source_type "memory" · the Fabrication Gate cannot validate a memory
--   citation because memories never appear in bundle.items.

CREATE SCHEMA IF NOT EXISTS nex;

-- ─── user_profile ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.user_profile (
  user_id             text        PRIMARY KEY,
  display_name        text        NULL,
  custom_instructions jsonb       NULL,      -- CustomInstructionsSchema shape
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_user_profile_updated
  ON nex.user_profile (updated_at DESC);

COMMENT ON TABLE nex.user_profile IS
  'Founder BEGIN Phase 3.10 · L2 memory · one row per user_id · holds custom_instructions.';

-- ─── user_memory ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.user_memory (
  memory_id           text        PRIMARY KEY,
  user_id             text        NOT NULL,
  claim_text          text        NOT NULL,
  category            text        NOT NULL,          -- preference · constraint · identity · context · correction · other
  confidence          double precision NOT NULL DEFAULT 0.7,
  source_turn_id      text        NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_referenced_at  timestamptz NULL,
  expires_at          timestamptz NULL,
  deleted_at          timestamptz NULL,
  CONSTRAINT user_memory_confidence_bounds CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT user_memory_category_bounds CHECK (category IN
    ('preference', 'response_style', 'identity_soft',
     'user_asserted_fact', 'correction', 'context', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_nex_user_memory_by_user
  ON nex.user_memory (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_nex_user_memory_by_user_recent_ref
  ON nex.user_memory (user_id, last_referenced_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE nex.user_memory IS
  'Founder BEGIN Phase 3.10 · L2 memory · claims about the user (preference/constraint/identity/context/correction). Trust CAPPED at evidence_provisional when converted to EvidenceItem.';
