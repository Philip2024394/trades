-- 157_nex_identity.sql
--
-- Founder Phase 10 · P10-1 · Identity layer.
-- 2026-09-10.
--
-- Two tables:
--   1. nex.user_account · opaque per-user identity · no PII required
--   2. nex.user_session · session tokens · HMAC-signed opaque strings
--
-- Doctrine anchors:
--   #4 · Memory scoped by user_id (existing nex.user_memory · nex.user_profile)
--   privacy · account deletion CASCADES to user_memory + user_profile

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- user_account
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.user_account (
  user_id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Optional public handle (chosen by user) · NOT unique · display only.
  display_name        text        NULL,
  -- Optional email hash (sha256 first 16 hex chars) for future recovery / OAuth.
  -- We never store raw emails until the user opts in explicitly.
  email_hash_16       text        NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz NULL,
  -- User-supplied custom instructions blob (max 4KB via check).
  custom_instructions jsonb       NULL,
  CONSTRAINT user_account_custom_instructions_bounds CHECK (
    custom_instructions IS NULL OR pg_column_size(custom_instructions) <= 4096
  )
);

CREATE INDEX IF NOT EXISTS idx_nex_user_account_active
  ON nex.user_account (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nex_user_account_email_hash
  ON nex.user_account (email_hash_16) WHERE email_hash_16 IS NOT NULL;

COMMENT ON TABLE nex.user_account IS
  'Founder Phase 10 · P10-1 · opaque per-user identity. No PII required.';

-- ═══════════════════════════════════════════════════════════════════
-- user_session
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.user_session (
  session_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash  text        NOT NULL,       -- sha256 of the opaque cookie token
  user_id             uuid        NOT NULL REFERENCES nex.user_account(user_id) ON DELETE CASCADE,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz NULL,
  ip_hash_16          text        NULL,           -- SHA-256 first 16 hex · never raw IP
  user_agent_hash_16  text        NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_user_session_token
  ON nex.user_session (session_token_hash);
CREATE INDEX IF NOT EXISTS idx_nex_user_session_user_active
  ON nex.user_session (user_id, expires_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nex_user_session_expires
  ON nex.user_session (expires_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE nex.user_session IS
  'Founder Phase 10 · P10-1 · session tokens · HMAC-signed opaque strings.';

-- ═══════════════════════════════════════════════════════════════════
-- Ensure existing user_memory / user_profile still scope by user_id
-- consistently. user_id in those tables is currently TEXT · we do NOT
-- change the type here to avoid breaking existing memory rows.
-- The identity layer accommodates by casting user_id to text in reads.
-- A future migration can promote user_memory.user_id to uuid.
-- ═══════════════════════════════════════════════════════════════════
