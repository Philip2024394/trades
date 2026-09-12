-- 160_nex_api_key.sql
--
-- Founder Phase 14 · P14-1 · API key issuance.
-- 2026-09-10.
--
-- One table:
--   nex.api_key · opaque bearer tokens · sha256 hashed at rest
--
-- Tokens are prefixed nex_live_<32-hex> so leaked tokens are grep-detectable
-- in customer code / logs. Only the prefix + hash are stored — the raw
-- token is shown ONCE at creation, then never again.

CREATE SCHEMA IF NOT EXISTS nex;

CREATE TABLE IF NOT EXISTS nex.api_key (
  api_key_id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text        NOT NULL,
  name              text        NOT NULL,                 -- human label, e.g. "prod-server"
  token_prefix      text        NOT NULL,                 -- first 12 chars for display, e.g. "nex_live_ab1"
  token_hash        text        NOT NULL,                 -- sha256(token) full hex
  tier              text        NOT NULL DEFAULT 'free',  -- free | pro | enterprise
  scopes            text[]      NOT NULL DEFAULT ARRAY['chat:read','chat:write'],
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_used_at      timestamptz NULL,
  revoked_at        timestamptz NULL,
  request_count     bigint      NOT NULL DEFAULT 0,
  CONSTRAINT ck_api_key_tier CHECK (tier IN ('free','pro','enterprise'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_api_key_hash
  ON nex.api_key (token_hash);
CREATE INDEX IF NOT EXISTS idx_nex_api_key_user_active
  ON nex.api_key (user_id, created_at DESC) WHERE revoked_at IS NULL;

COMMENT ON TABLE nex.api_key IS
  'Founder Phase 14 · P14-1 · opaque bearer tokens · sha256 hashed at rest.';
