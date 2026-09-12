-- 164_nex_code_execution.sql
--
-- Founder Phase 20 · P20-1 · Code-interpreter provenance.
-- 2026-09-10.
--
-- Doctrine anchor:
--   code-doctrine · computed output is INPUT · never establishes truth.
--   Same discipline as voice transcripts, file extractions, image outputs.

CREATE SCHEMA IF NOT EXISTS nex;

CREATE TABLE IF NOT EXISTS nex.code_execution (
  execution_id      text        PRIMARY KEY,          -- code:<hash>
  conversation_id   text        NULL,
  user_id           text        NULL,
  language          text        NOT NULL DEFAULT 'javascript',
  code_hash         text        NOT NULL,
  code_length       integer     NOT NULL,
  stdout_length     integer     NOT NULL,
  stderr_length     integer     NOT NULL,
  return_kind       text        NOT NULL,              -- 'undefined' | 'primitive' | 'object' | 'error'
  request_ms        integer     NOT NULL,
  timed_out         boolean     NOT NULL DEFAULT FALSE,
  ok                boolean     NOT NULL,
  error_class       text        NULL,
  sanitiser_neutralised integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_code_exec_conv
  ON nex.code_execution (conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nex_code_exec_user
  ON nex.code_execution (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nex_code_exec_hash
  ON nex.code_execution (code_hash);

COMMENT ON TABLE nex.code_execution IS
  'Founder Phase 20 · P20-1 · sandboxed vm execution audit · computed output never establishes truth.';
