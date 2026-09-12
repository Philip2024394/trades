-- 149_nex_safety_observability.sql
--
-- NEX LIVE CHAT · SAFETY OBSERVABILITY · Phase 3.7 · storage layer.
-- Founder BEGIN Phase 3.7 · Master AI Engineer · 2026-09-09.
--
-- Purpose (STRICT this migration):
--   1. nex.moderation_event · durable record of input-guardrail refusals,
--      output-scrubber actions, and rate-limit breaches. Feeds HQ page
--      + gap engine (repeated jailbreak attempts on a given intent may
--      signal a phrasing NEX needs to clarify).
--
-- Design:
--   · No PII stored · only the CATEGORY + short reason.
--   · No raw customer message stored · only its normalised hash (SHA-256
--     truncated to 16 hex chars) for dedup + abuse detection.
--   · IF NOT EXISTS · idempotent.

CREATE SCHEMA IF NOT EXISTS nex;

CREATE TABLE IF NOT EXISTS nex.moderation_event (
  event_id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  emitted_at          timestamptz NOT NULL DEFAULT now(),
  conversation_id     text        NULL,                 -- may be null for pre-conversation blocks
  message_hash_16     text        NOT NULL,             -- SHA-256 first 16 hex chars of normalised message
  category            text        NOT NULL,             -- jailbreak · harmful · rate_limit · policy · abuse · other
  reason              text        NOT NULL,             -- short machine-readable code
  guardrail_name      text        NOT NULL,             -- which guardrail fired
  language            text        NULL,
  retry_after_seconds integer     NULL
);

CREATE INDEX IF NOT EXISTS idx_nex_moderation_event_recent
  ON nex.moderation_event (emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_moderation_event_category
  ON nex.moderation_event (category, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_moderation_event_conversation
  ON nex.moderation_event (conversation_id, emitted_at DESC);

COMMENT ON TABLE nex.moderation_event IS
  'Founder BEGIN Phase 3.7 · guardrail firings. No PII stored · only category + short reason + hashed message id.';
