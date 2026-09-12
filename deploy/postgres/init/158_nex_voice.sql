-- 158_nex_voice.sql
--
-- Founder Phase 12 · P12-4 · Voice pipeline provenance.
-- 2026-09-10.
--
-- Two tables:
--   1. nex.voice_transcript · every STT invocation (audio → text)
--   2. nex.voice_synthesis  · every TTS invocation (text → audio)
--
-- Doctrine anchors:
--   Voice-doctrine · transcripts + syntheses are RENDERINGS, never
--   promoted to EvidenceItem. Store confidence but never treat it as
--   verification.

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- voice_transcript · STT audit
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.voice_transcript (
  transcript_id       text        PRIMARY KEY,          -- stt:<hash>
  conversation_id     text        NULL,
  provider            text        NOT NULL,
  model_id            text        NOT NULL,
  language            text        NOT NULL,
  text                text        NOT NULL,
  confidence          numeric     NOT NULL,
  audio_hash          text        NOT NULL,
  duration_s          numeric     NULL,
  request_ms          integer     NOT NULL,
  completed           boolean     NOT NULL,
  error               text        NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_voice_transcript_conv
  ON nex.voice_transcript (conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nex_voice_transcript_completed
  ON nex.voice_transcript (created_at DESC) WHERE completed = TRUE;
CREATE INDEX IF NOT EXISTS idx_nex_voice_transcript_audio_hash
  ON nex.voice_transcript (audio_hash);

COMMENT ON TABLE nex.voice_transcript IS
  'Founder Phase 12 · P12-4 · STT invocation audit · transcripts never establish truth.';

-- ═══════════════════════════════════════════════════════════════════
-- voice_synthesis · TTS audit
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.voice_synthesis (
  synth_id            text        PRIMARY KEY,          -- tts:<hash>
  conversation_id     text        NULL,
  provider            text        NOT NULL,
  model_id            text        NOT NULL,
  voice               text        NOT NULL,
  text_hash           text        NOT NULL,
  mime_type           text        NOT NULL,
  duration_s          numeric     NULL,
  request_ms          integer     NOT NULL,
  completed           boolean     NOT NULL,
  error               text        NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_voice_synthesis_conv
  ON nex.voice_synthesis (conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nex_voice_synthesis_completed
  ON nex.voice_synthesis (created_at DESC) WHERE completed = TRUE;
CREATE INDEX IF NOT EXISTS idx_nex_voice_synthesis_text_hash
  ON nex.voice_synthesis (text_hash);

COMMENT ON TABLE nex.voice_synthesis IS
  'Founder Phase 12 · P12-4 · TTS invocation audit · syntheses never establish truth.';
