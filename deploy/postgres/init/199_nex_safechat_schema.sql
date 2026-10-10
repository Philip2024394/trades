-- 199_nex_safechat_schema.sql
--
-- NEX SafeChat Phase 1 · SIMULATED detection schema
-- (sealed 2026-10-10 · instrumentation-only wave).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
-- Introduces three tables for the SafeChat Phase 1 pilot:
--
--   1. nex.safechat_classification · append-only classification log.
--      One row per message the plaintext send-path hands to the
--      classifier. visibility_to_guardian is ALWAYS FALSE in Phase 1 ·
--      Phase 3+ may flip it only after explicit founder sign-off.
--      simulated is ALWAYS TRUE in Phase 1 · see doctrine
--      docs/doctrine/nex-safechat-phase-1-simulated-2026-10-10.md.
--
--   2. nex.safechat_vocabulary_term · multilingual vocabulary database.
--      Case-insensitive matching via normalised_term. Multi-category,
--      severity 1..3. deprecated_at keeps retired terms around for
--      historical joins without re-matching them at classify-time.
--
--   3. nex.safechat_pattern · regex pattern database for request /
--      pressure / meeting-arrangement / platform-switch signals.
--
-- Doctrine (sealed with this migration):
--   · Phase 1 is PURE INSTRUMENTATION · zero user-facing effect ·
--     messages are NEVER restricted, warnings are NEVER surfaced,
--     parents / guardians are NEVER alerted. The log is for internal
--     threshold tuning only.
--   · simulated=TRUE at every write · Phase 2+ gate for live mode.
--   · visibility_to_guardian=FALSE at every write · Phase 3+ gate for
--     surfacing to a guardian.
--   · Vocabulary is DELIBERATELY INCOMPLETE in Phase 1 · bilingual
--     starter set (English + Bahasa Indonesia) only · acknowledged in
--     doctrine · ethics review required before expansion.
--   · Encrypted (Vault-adjacent) messages are SKIPPED by the hook ·
--     SafeChat never touches ciphertext.
--
-- ═══════════════════════════════════════════════════════════════════
-- IDEMPOTENCE
-- ═══════════════════════════════════════════════════════════════════
--
-- CREATE TABLE IF NOT EXISTS · CREATE INDEX IF NOT EXISTS · zero DML.
-- Safe to re-run.
--
-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
--
--   DROP TABLE IF EXISTS nex.safechat_pattern;
--   DROP TABLE IF EXISTS nex.safechat_vocabulary_term;
--   DROP TABLE IF EXISTS nex.safechat_classification;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · pgcrypto · gen_random_uuid().
-- · nex schema present (every earlier migration).
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-199.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').
-- ═══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1 · nex.safechat_classification
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.safechat_classification (
  classification_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Opaque reference to the sealed peer message (hashed or FK-style
  -- opaque string · never raw message content).
  message_ref            text        NOT NULL,

  -- Soft references · we deliberately avoid FK coupling to
  -- nex_peer_message / nex_account so the log can be retained + purged
  -- on an independent schedule.
  sender_account_id      text        NOT NULL,
  recipient_account_id   text        NOT NULL,
  conversation_id        text        NULL,

  -- 0 = clean · 1 = sensitive · 2 = potentially_unsafe · 3 = serious_risk
  level                  smallint    NOT NULL CHECK (level IN (0, 1, 2, 3)),

  -- 0..1 confidence score · computed from match density + signal strength.
  confidence             numeric(4,3) NOT NULL
    CHECK (confidence >= 0 AND confidence <= 1),

  -- Rule matches that fired · array of { category, severity, matchedTerm, ... }.
  rule_matches           jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Detected language (null when the detector abstains).
  language_detected      text        NULL
    CHECK (language_detected IS NULL
           OR length(language_detected) BETWEEN 2 AND 10),

  -- Conversation-level signals that fired at classify-time.
  signals                jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Phase 1 ALWAYS sets this to FALSE · future phases (3+) may flip to
  -- TRUE only after explicit founder sign-off.
  visibility_to_guardian boolean     NOT NULL DEFAULT FALSE,

  -- Phase 1 ALWAYS sets this to TRUE · instrumentation-only pilot.
  simulated              boolean     NOT NULL DEFAULT TRUE,

  classified_at          timestamptz NOT NULL DEFAULT now(),

  -- e.g. "safechat-rules-v1.0.0" · lets us retire old classifications.
  classifier_version     text        NOT NULL
);

CREATE INDEX IF NOT EXISTS safechat_classification_time_idx
  ON nex.safechat_classification (classified_at DESC);

CREATE INDEX IF NOT EXISTS safechat_classification_level_time_idx
  ON nex.safechat_classification (level, classified_at DESC);

CREATE INDEX IF NOT EXISTS safechat_classification_conversation_time_idx
  ON nex.safechat_classification (conversation_id, classified_at DESC)
  WHERE conversation_id IS NOT NULL;

COMMENT ON TABLE nex.safechat_classification IS
  'NEX SafeChat Phase 1 · append-only classification log. Phase 1 is instrumentation only · simulated=TRUE and visibility_to_guardian=FALSE at every write.';

COMMENT ON COLUMN nex.safechat_classification.visibility_to_guardian IS
  'Phase 1 ALWAYS FALSE · Phase 3+ flip requires explicit founder sign-off.';

COMMENT ON COLUMN nex.safechat_classification.simulated IS
  'Phase 1 ALWAYS TRUE · Phase 2+ live mode requires separate founder authorisation.';

-- ──────────────────────────────────────────────────────────────────
-- 2 · nex.safechat_vocabulary_term
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.safechat_vocabulary_term (
  term_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Exact term as entered · preserved for audit / display.
  term             text         NOT NULL,

  -- Lowercased + whitespace-normalised form used by the matcher.
  normalised_term  text         NOT NULL,

  -- Language tag · 2-10 chars (BCP-47 subset · 'en', 'id', 'id-ID', etc.).
  language         text         NOT NULL
    CHECK (length(language) BETWEEN 2 AND 10),

  -- Structure-neutral taxonomy · no vendor identifiers.
  category         text         NOT NULL CHECK (category IN (
    'sexual_slang',
    'explicit_sexual',
    'violence',
    'self_harm',
    'drugs',
    'grooming_indicator',
    'coercion_indicator',
    'image_request',
    'secrecy_request',
    'meeting_arrangement'
  )),

  -- 1 = low · 2 = medium · 3 = high · severity feeds resolveLevel().
  severity         smallint     NOT NULL CHECK (severity IN (1, 2, 3)),

  notes            text         NULL
    CHECK (notes IS NULL OR length(notes) BETWEEN 1 AND 500),

  -- Audit · which admin added this term (soft reference).
  added_by         text         NULL,

  -- Deprecated terms are kept for historical classification joins but
  -- are NOT matched at classify-time (vocabulary-reader filters them).
  deprecated_at    timestamptz  NULL,

  created_at       timestamptz  NOT NULL DEFAULT now()
);

-- Active terms are unique within a language · deprecated terms don't
-- block a replacement from being added.
CREATE UNIQUE INDEX IF NOT EXISTS safechat_vocabulary_term_lang_term_uq
  ON nex.safechat_vocabulary_term (language, normalised_term)
  WHERE deprecated_at IS NULL;

CREATE INDEX IF NOT EXISTS safechat_vocabulary_term_language_idx
  ON nex.safechat_vocabulary_term (language)
  WHERE deprecated_at IS NULL;

COMMENT ON TABLE nex.safechat_vocabulary_term IS
  'NEX SafeChat vocabulary database · multilingual, versioned, structure-neutral taxonomy. Phase 1 seed is deliberately incomplete · bilingual (en + id) starter set only.';

-- ──────────────────────────────────────────────────────────────────
-- 3 · nex.safechat_pattern
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.safechat_pattern (
  pattern_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  pattern_description  text         NOT NULL
    CHECK (length(pattern_description) BETWEEN 1 AND 300),

  pattern_regex        text         NOT NULL
    CHECK (length(pattern_regex) BETWEEN 1 AND 500),

  language             text         NOT NULL,

  signal_type          text         NOT NULL CHECK (signal_type IN (
    'image_request',
    'coercion_followup',
    'secrecy_request',
    'meeting_arrangement',
    'platform_switch_invitation',
    'repeated_pressure_after_refusal',
    'gift_offer_with_sexual_frame',
    'age_gap_disclosure'
  )),

  severity             smallint     NOT NULL CHECK (severity IN (1, 2, 3)),

  notes                text         NULL,

  deprecated_at        timestamptz  NULL,

  created_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safechat_pattern_language_idx
  ON nex.safechat_pattern (language)
  WHERE deprecated_at IS NULL;

COMMENT ON TABLE nex.safechat_pattern IS
  'NEX SafeChat pattern database · regex patterns for request / coercion / secrecy / meeting / platform-switch signals. Phase 1 seed is deliberately incomplete.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 199.
-- Downstream:
--   · src/lib/nex-native/safechat/*
--   · scripts/nex-canonical/_seed-vocabulary.mjs
-- ═══════════════════════════════════════════════════════════════════
