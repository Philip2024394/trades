-- NEX Comms Centre · Social · Phase 1 · OAuth + envelope encryption
--
-- Doctrine references:
--   Charter §S-IX (v0.2 hardened): envelope encryption · per-tenant DEK
--   wrapped by KMS master key · separate DEK for refresh vs access ·
--   automatic rotation · never expose tokens to UI · scope drift check.
--
-- Two new tables:
--   1. nex.social_dek_wraps       — wrapped Data Encryption Keys (DEKs)
--      per (tenant, purpose). Wrapped by the KEK (Key Encryption Key)
--      which lives in a KMS-abstraction backend (env-var in Phase 1,
--      AWS KMS drop-in later without schema change).
--   2. nex.social_oauth_states    — inflight OAuth state values for
--      CSRF protection. Single-use · expires · consumed on callback.
--
-- Plus column additions to nex.social_accounts to reference DEKs by ID
-- rather than the previous TEXT "dek_ref" placeholder from Phase 0.

-- ── 1 · DEK wraps ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.social_dek_wraps (
  dek_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE,
  purpose         TEXT NOT NULL CHECK (purpose IN ('access_token','refresh_token','oauth_state')),
  wrapped_dek     BYTEA NOT NULL,                                       -- KEK-encrypted DEK material
  wrap_nonce      BYTEA NOT NULL,                                       -- AEAD nonce used to wrap the DEK
  wrap_auth_tag   BYTEA NOT NULL,                                       -- AEAD auth tag
  kek_version     TEXT NOT NULL,                                        -- e.g. 'local:v1' · used for rotation tracking
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','rotating','retired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at      TIMESTAMPTZ,
  retired_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS social_dek_wraps_tenant_purpose_idx
  ON nex.social_dek_wraps (tenant_id, purpose, status);
-- Only ONE active DEK per (tenant, purpose) at any time (S-IX rotation invariant).
CREATE UNIQUE INDEX IF NOT EXISTS social_dek_wraps_one_active_per_purpose
  ON nex.social_dek_wraps (tenant_id, purpose) WHERE status = 'active';

-- ── 2 · OAuth states ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.social_oauth_states (
  state_token     TEXT PRIMARY KEY,                                     -- URL-safe random · presented in provider URL
  tenant_id       UUID NOT NULL REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,                                        -- target platform for the OAuth handshake
  initiated_by    TEXT NOT NULL,                                        -- user_id who clicked Connect
  redirect_to     TEXT,                                                 -- optional post-callback redirect URL
  code_verifier   BYTEA,                                                -- PKCE (nullable · encrypted at rest with tenant DEK when present)
  code_verifier_nonce BYTEA,
  code_verifier_dek_id UUID REFERENCES nex.social_dek_wraps(dek_id),
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,                                          -- single-use enforcement
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS social_oauth_states_tenant_expires_idx
  ON nex.social_oauth_states (tenant_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS social_oauth_states_pending_idx
  ON nex.social_oauth_states (expires_at) WHERE consumed_at IS NULL;

-- ── 3 · Alter social_accounts to reference DEK ids ────────────
--
-- Phase 0 declared `access_token_dek_ref TEXT` as a placeholder. Phase 1
-- replaces it with proper FK columns to nex.social_dek_wraps plus AEAD
-- nonce/auth-tag columns. We drop the old placeholder columns and add
-- the new ones. No production data yet (Phase 0 stored no tokens).

ALTER TABLE nex.social_accounts
  DROP COLUMN IF EXISTS access_token_dek_ref,
  DROP COLUMN IF EXISTS refresh_token_dek_ref;

ALTER TABLE nex.social_accounts
  ADD COLUMN IF NOT EXISTS access_dek_id           UUID REFERENCES nex.social_dek_wraps(dek_id),
  ADD COLUMN IF NOT EXISTS access_token_nonce      BYTEA,
  ADD COLUMN IF NOT EXISTS access_token_auth_tag   BYTEA,
  ADD COLUMN IF NOT EXISTS refresh_dek_id          UUID REFERENCES nex.social_dek_wraps(dek_id),
  ADD COLUMN IF NOT EXISTS refresh_token_nonce     BYTEA,
  ADD COLUMN IF NOT EXISTS refresh_token_auth_tag  BYTEA;

-- ── 4 · RLS on the new tables ─────────────────────────────────

ALTER TABLE nex.social_dek_wraps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_dek_wraps      FORCE  ROW LEVEL SECURITY;
ALTER TABLE nex.social_oauth_states   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_oauth_states   FORCE  ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['social_dek_wraps','social_oauth_states']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_select ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_select ON nex.%I FOR SELECT USING ((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active())',
      t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_insert ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_insert ON nex.%I FOR INSERT WITH CHECK (tenant_id = nex._current_social_tenant())',
      t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_update ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_update ON nex.%I FOR UPDATE USING (tenant_id = nex._current_social_tenant()) WITH CHECK (tenant_id = nex._current_social_tenant())',
      t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_delete ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_delete ON nex.%I FOR DELETE USING (tenant_id = nex._current_social_tenant())',
      t, t);
  END LOOP;
END $$;

-- ── 5 · Grants for the app role ───────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON
  nex.social_dek_wraps,
  nex.social_oauth_states
  TO nex_social_app;

COMMENT ON TABLE nex.social_dek_wraps IS
  'Charter §S-IX · per-tenant per-purpose DEKs wrapped by KEK · one active DEK per (tenant,purpose) at a time · rotation-ready';
COMMENT ON TABLE nex.social_oauth_states IS
  'Phase 1 · single-use CSRF state for inflight OAuth flows · expires_at + consumed_at enforce one-shot semantics';
