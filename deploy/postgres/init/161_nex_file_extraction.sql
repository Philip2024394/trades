-- 161_nex_file_extraction.sql
--
-- Founder Phase 15 · P15-1 · File-extraction provenance.
-- 2026-09-10.
--
-- Doctrine anchor:
--   File-doctrine · extracted text is INPUT · never establishes truth.
--   Same discipline as voice transcripts and image-gen outputs.

CREATE SCHEMA IF NOT EXISTS nex;

CREATE TABLE IF NOT EXISTS nex.file_extraction (
  extraction_id     text        PRIMARY KEY,          -- ext:<hash>
  conversation_id   text        NULL,
  user_id           text        NULL,
  provider          text        NOT NULL,             -- docx-unzipper | pdf-parse | pdf-naive | text-plain
  mime_type         text        NOT NULL,
  file_hash         text        NOT NULL,
  filename          text        NULL,
  bytes             integer     NOT NULL,
  text_length       integer     NOT NULL,
  page_count        integer     NULL,
  request_ms        integer     NOT NULL,
  completed         boolean     NOT NULL,
  error             text        NULL,
  sanitiser_neutralised integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_file_extraction_conv
  ON nex.file_extraction (conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nex_file_extraction_user
  ON nex.file_extraction (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nex_file_extraction_hash
  ON nex.file_extraction (file_hash);

COMMENT ON TABLE nex.file_extraction IS
  'Founder Phase 15 · P15-1 · file extraction audit · extracted text never establishes truth.';
