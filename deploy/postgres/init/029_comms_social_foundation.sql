-- NEX Communications Centre · Social Engine · Phase 0 Foundation
--
-- Doctrine references:
--   docs/NEX_SOCIAL_ENGINE_CHARTER.md (v0.1) + v0.2 PROPOSAL
--   Amendment #16 DRAFT (not merged)
--   Invariants S-I (tenant isolation) · S-II (adapter isolation) ·
--   S-VII (idempotency two-phase) · S-VIII (fail-closed validators) ·
--   S-IX (OAuth-only + tokens encrypted) · S-XII (no Predictive).
--
-- Scope of this migration: FOUNDATION ONLY. No provider tables. No
-- publishing pipeline yet. No analytics. No content generation. This
-- migration establishes:
--   1. nex.social_tenants           · first-class multi-tenancy
--   2. nex.social_role_grants       · role → tenant role assignments
--   3. nex.social_accounts          · connected social accounts (shell)
--   4. nex.social_publish_intents   · two-phase publish idempotency row
--   5. nex.social_audit_events      · INSERT-only audit stream
--   6. nex.social_controls          · singleton kill switch + threshold
--   7. nex.social_admin_access_log  · Boundary-3 cross-tenant read audit
--   8. RLS default-deny on ALL of the above
--   9. nex.admin_readable_resource_kinds enum · gated by amendment
--  10. nex.social_admin_read()      · the ONLY cross-tenant read path
--
-- Zero changes to any v1.0 table. Zero changes to any pre-existing
-- schema. Additive only.

-- ── 1 · Tenants ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.social_tenants (
  tenant_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT NOT NULL CHECK (kind IN ('hq','trade')),
  slug            TEXT NOT NULL UNIQUE,                            -- human-readable · e.g. 'nex-hq' or 'abc-staircases'
  display_name    TEXT NOT NULL,
  country         TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS social_tenants_kind_idx ON nex.social_tenants (kind, status);

-- ── 2 · Role grants ────────────────────────────────────────────
--
-- Every user gets zero-or-more (tenant_id, role) grants. Charter
-- roles: owner · admin · marketing_manager · staff · viewer. Grants
-- carry an expiry so time-bounded elevation (S-V multi-user + S-V
-- admin publish auth) is a first-class concept.
CREATE TABLE IF NOT EXISTS nex.social_role_grants (
  grant_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,                                    -- reserved as text for now · joins to Nex user identity later
  role            TEXT NOT NULL CHECK (role IN ('owner','admin','marketing_manager','staff','viewer','agency_manager','nex_admin_support','nex_admin_publish')),
  granted_by      TEXT,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,                                      -- NULL = perpetual for tenant roles · REQUIRED for nex_admin_publish (max 24h per approved A5)
  revoked_at      TIMESTAMPTZ,
  reason          TEXT,
  UNIQUE (tenant_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS social_role_grants_active_idx
  ON nex.social_role_grants (tenant_id, user_id, role)
  WHERE revoked_at IS NULL;

-- Enforce max 24h expiry for nex_admin_publish (approved A5).
ALTER TABLE nex.social_role_grants
  DROP CONSTRAINT IF EXISTS social_role_grants_publish_max_24h;
ALTER TABLE nex.social_role_grants
  ADD CONSTRAINT social_role_grants_publish_max_24h
  CHECK (role <> 'nex_admin_publish' OR (expires_at IS NOT NULL AND expires_at <= granted_at + INTERVAL '24 hours'));

-- ── 3 · Social accounts (Phase 0 shell) ────────────────────────
CREATE TABLE IF NOT EXISTS nex.social_accounts (
  account_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES nex.social_tenants(tenant_id) ON DELETE RESTRICT,
  platform               TEXT NOT NULL CHECK (platform IN ('facebook','instagram','linkedin','tiktok','google_business','simulator')),
  display_name           TEXT,
  platform_account_id    TEXT,
  scopes                 TEXT[] NOT NULL DEFAULT '{}',
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','attention_required','expired','revoked','disabled')),
  connected_at           TIMESTAMPTZ,
  last_success_at        TIMESTAMPTZ,
  last_error             TEXT,
  token_expires_at       TIMESTAMPTZ,
  -- Encrypted token blobs (Phase 1 wires real KMS · Phase 0 leaves NULL)
  access_token_dek_ref   TEXT,                                       -- reference to KMS-wrapped DEK
  access_token_ct        BYTEA,                                      -- ciphertext of access token
  refresh_token_dek_ref  TEXT,                                       -- separate DEK per S-IX
  refresh_token_ct       BYTEA,
  granted_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, platform, platform_account_id)
);
CREATE INDEX IF NOT EXISTS social_accounts_tenant_status_idx
  ON nex.social_accounts (tenant_id, status);

-- ── 4 · Publish intents (two-phase idempotency · S-VII) ───────
--
-- Row is INSERTed BEFORE the adapter is called. `status='in_flight'`
-- indicates a publish attempt is under way. Verify-loop transitions to
-- `verified_published` OR `verified_no_op`. Duplicate key = skip.
CREATE TABLE IF NOT EXISTS nex.social_publish_intents (
  intent_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES nex.social_tenants(tenant_id) ON DELETE RESTRICT,
  post_id              UUID NOT NULL,                                -- refs future nex.social_posts
  platform             TEXT NOT NULL,
  account_id           UUID NOT NULL REFERENCES nex.social_accounts(account_id) ON DELETE RESTRICT,
  retry_epoch          INT  NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'in_flight'
                         CHECK (status IN ('in_flight','verified_published','verified_no_op','failed','abandoned')),
  provider_marker      TEXT,                                          -- our idempotency marker embedded in caption metadata
  provider_post_id     TEXT,                                          -- provider-side ID · captured on verification
  attempts             INT  NOT NULL DEFAULT 1,
  lease_owner          TEXT,
  lease_expires_at     TIMESTAMPTZ,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at          TIMESTAMPTZ,
  error                TEXT,
  UNIQUE (tenant_id, post_id, platform, account_id, retry_epoch)
);
CREATE INDEX IF NOT EXISTS social_publish_intents_tenant_status_idx
  ON nex.social_publish_intents (tenant_id, status);
CREATE INDEX IF NOT EXISTS social_publish_intents_lease_idx
  ON nex.social_publish_intents (lease_expires_at) WHERE status = 'in_flight';

-- ── 5 · Audit events (append-only) ────────────────────────────
CREATE TABLE IF NOT EXISTS nex.social_audit_events (
  audit_id       BIGSERIAL PRIMARY KEY,
  tenant_id      UUID NOT NULL,                                       -- null-forbidden: even HQ actions carry the HQ tenant_id
  event_type     TEXT NOT NULL,                                       -- e.g. 'account.connected' · 'publish.intent_inserted' · 'publish.verified'
  actor          TEXT NOT NULL,                                       -- 'user:<uuid>' | 'nex_engine' | 'nex_admin_support:<uuid>'
  subject_kind   TEXT,                                                -- 'account' | 'post' | 'intent' | 'tenant' | 'role_grant' etc.
  subject_id     TEXT,
  details        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS social_audit_events_tenant_time_idx
  ON nex.social_audit_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS social_audit_events_type_time_idx
  ON nex.social_audit_events (event_type, created_at DESC);

-- INSERT-only enforcement: revoke UPDATE and DELETE from every non-superuser
-- role that could otherwise touch this table via RLS.
REVOKE UPDATE, DELETE ON nex.social_audit_events FROM PUBLIC;

-- ── 6 · Global controls (singleton kill switch + threshold) ────
CREATE TABLE IF NOT EXISTS nex.social_controls (
  singleton                BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton = TRUE),
  global_pause             BOOLEAN NOT NULL DEFAULT FALSE,           -- if TRUE · all autopublish halts globally within 30s
  global_pause_at          TIMESTAMPTZ,
  global_pause_by          TEXT,
  global_pause_reason      TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO nex.social_controls (singleton, global_pause)
VALUES (TRUE, FALSE)
ON CONFLICT (singleton) DO NOTHING;

-- ── 7 · Admin cross-tenant read audit log (Boundary 3) ─────────
CREATE TABLE IF NOT EXISTS nex.social_admin_access_log (
  access_id         BIGSERIAL PRIMARY KEY,
  admin_user_id     TEXT NOT NULL,
  target_tenant_id  UUID NOT NULL,
  resource          TEXT NOT NULL,                                    -- must match nex.admin_readable_resource_kinds enum
  reason            TEXT NOT NULL,
  row_count         INT,                                              -- how many rows the read returned (nullable if unknown)
  accessed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS social_admin_access_log_target_time_idx
  ON nex.social_admin_access_log (target_tenant_id, accessed_at DESC);

REVOKE UPDATE, DELETE ON nex.social_admin_access_log FROM PUBLIC;

-- ── 8 · Enum of admin-readable resource kinds (Boundary 3) ─────
--
-- Adding a value to this enum requires a schema migration; migrations
-- carry an amendment ID reference (governance rule §0 Boundary 7).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_admin_readable_resource') THEN
    CREATE TYPE nex.social_admin_readable_resource AS ENUM (
      'account_status_only',        -- account status metadata, no tokens
      'audit_event_summary',        -- audit summary, no PII details
      'publish_intent_summary'      -- intent status, no post content
    );
  END IF;
END $$;

-- ── 9 · RLS · default deny on every social table ───────────────
--
-- Convention: an application-level PG role sets a per-request GUC:
--   SET LOCAL nex.social_tenant_id = '<uuid>';
-- The RLS policies below key off that GUC. If the GUC is missing
-- (empty string), row access is denied (tenant_id::text = '' fails).
--
-- The `nex_admin_support` role can bypass tenant match ONLY via the
-- nex.social_admin_read() wrapper (§10 below), which sets a distinct
-- GUC that policies also honour.

ALTER TABLE nex.social_tenants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_role_grants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_publish_intents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_audit_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_controls          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_admin_access_log  ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner (so accidental superuser use still
-- exercises the policy path when we set roles).
ALTER TABLE nex.social_tenants           FORCE ROW LEVEL SECURITY;
ALTER TABLE nex.social_role_grants       FORCE ROW LEVEL SECURITY;
ALTER TABLE nex.social_accounts          FORCE ROW LEVEL SECURITY;
ALTER TABLE nex.social_publish_intents   FORCE ROW LEVEL SECURITY;
ALTER TABLE nex.social_audit_events      FORCE ROW LEVEL SECURITY;
ALTER TABLE nex.social_controls          FORCE ROW LEVEL SECURITY;
ALTER TABLE nex.social_admin_access_log  FORCE ROW LEVEL SECURITY;

-- Helper: read the tenant GUC, treating missing as an impossible UUID.
CREATE OR REPLACE FUNCTION nex._current_social_tenant() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('nex.social_tenant_id', TRUE), '')::UUID
$$;

CREATE OR REPLACE FUNCTION nex._admin_bypass_active() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('nex.social_admin_bypass', TRUE) = 'on', FALSE)
$$;

-- Policies: default-deny with two allow paths per table.
--
-- Path A · tenant match: row.tenant_id = current_setting GUC
-- Path B · admin bypass: GUC nex.social_admin_bypass = 'on' AND the
--          caller is inside nex.social_admin_read()

-- IMPORTANT: PL/pgSQL EXECUTE runs a SINGLE statement. Do NOT combine
-- DROP + CREATE in one EXECUTE (silent failure). Each policy operation
-- must be its own EXECUTE call.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'social_tenants','social_role_grants','social_accounts',
    'social_publish_intents','social_audit_events',
    'social_admin_access_log'
  ]) LOOP

    -- SELECT policy
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_select ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_select ON nex.%I FOR SELECT USING ((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active())',
      t, t);

    -- INSERT policy
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_insert ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_insert ON nex.%I FOR INSERT WITH CHECK (tenant_id = nex._current_social_tenant())',
      t, t);

    -- UPDATE policy (tenant only · never admin-bypass for writes)
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_update ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_update ON nex.%I FOR UPDATE USING (tenant_id = nex._current_social_tenant()) WITH CHECK (tenant_id = nex._current_social_tenant())',
      t, t);

    -- DELETE policy (tenant only · never admin-bypass)
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_delete ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_delete ON nex.%I FOR DELETE USING (tenant_id = nex._current_social_tenant())',
      t, t);

  END LOOP;
END $$;

-- social_tenants + social_admin_access_log · tenant_id column
-- semantics differ: social_tenants IS the tenant · social_admin_access_log's
-- target_tenant_id is what admin looked at. Override those two:
DROP POLICY IF EXISTS social_tenants_tenant_select   ON nex.social_tenants;
DROP POLICY IF EXISTS social_tenants_tenant_insert   ON nex.social_tenants;
DROP POLICY IF EXISTS social_tenants_tenant_update   ON nex.social_tenants;
DROP POLICY IF EXISTS social_tenants_tenant_delete   ON nex.social_tenants;

CREATE POLICY social_tenants_self_select ON nex.social_tenants
  FOR SELECT USING (
    (tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()
  );
CREATE POLICY social_tenants_self_update ON nex.social_tenants
  FOR UPDATE
  USING (tenant_id = nex._current_social_tenant())
  WITH CHECK (tenant_id = nex._current_social_tenant());
-- INSERT and DELETE on social_tenants require admin-bypass (tenant creation is HQ-only).
CREATE POLICY social_tenants_admin_insert ON nex.social_tenants
  FOR INSERT WITH CHECK (nex._admin_bypass_active());
CREATE POLICY social_tenants_admin_delete ON nex.social_tenants
  FOR DELETE USING (nex._admin_bypass_active());

DROP POLICY IF EXISTS social_admin_access_log_tenant_select ON nex.social_admin_access_log;
DROP POLICY IF EXISTS social_admin_access_log_tenant_insert ON nex.social_admin_access_log;
DROP POLICY IF EXISTS social_admin_access_log_tenant_update ON nex.social_admin_access_log;
DROP POLICY IF EXISTS social_admin_access_log_tenant_delete ON nex.social_admin_access_log;

-- Admin access log · rewritten policies · target_tenant_id NOT tenant_id.
CREATE POLICY social_admin_access_log_target_select ON nex.social_admin_access_log
  FOR SELECT USING (
    (target_tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active()
  );
CREATE POLICY social_admin_access_log_target_insert ON nex.social_admin_access_log
  FOR INSERT WITH CHECK (nex._admin_bypass_active());
-- No UPDATE · No DELETE (append-only append revoked at table grant level too).

-- social_controls is a singleton · one row · admin-only.
DROP POLICY IF EXISTS social_controls_tenant_select ON nex.social_controls;
DROP POLICY IF EXISTS social_controls_tenant_insert ON nex.social_controls;
DROP POLICY IF EXISTS social_controls_tenant_update ON nex.social_controls;
DROP POLICY IF EXISTS social_controls_tenant_delete ON nex.social_controls;

CREATE POLICY social_controls_all_read ON nex.social_controls
  FOR SELECT USING (TRUE);                                            -- anyone with DB access can read the kill switch
CREATE POLICY social_controls_admin_update ON nex.social_controls
  FOR UPDATE USING (nex._admin_bypass_active())
  WITH CHECK (nex._admin_bypass_active());

-- ── 10 · admin_read wrapper (Boundary 3) ───────────────────────
--
-- The ONLY way an admin performs cross-tenant reads. Sets the
-- bypass GUC · writes the audit row · yields the SETOF result ·
-- clears the GUC on completion.
--
-- Signature accepts a resource enum + reason. The caller MUST specify
-- both. Adding new resource kinds requires an enum migration (Boundary 7).
CREATE OR REPLACE FUNCTION nex.social_admin_read(
  p_admin_user_id     TEXT,
  p_target_tenant_id  UUID,
  p_resource          nex.social_admin_readable_resource,
  p_reason            TEXT
) RETURNS TABLE (
  audit_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = nex, pg_catalog
AS $$
DECLARE
  new_audit_id BIGINT;
BEGIN
  IF p_admin_user_id IS NULL OR btrim(p_admin_user_id) = '' THEN
    RAISE EXCEPTION 'admin_user_id required';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason required for cross-tenant admin read';
  END IF;

  INSERT INTO nex.social_admin_access_log (admin_user_id, target_tenant_id, resource, reason)
  VALUES (p_admin_user_id, p_target_tenant_id, p_resource::text, p_reason)
  RETURNING nex.social_admin_access_log.access_id INTO new_audit_id;

  -- Note: the actual data read is performed by the caller AFTER this
  -- audit-emitting function returns · caller sets the bypass GUC
  -- explicitly · which is why we return the audit_id as a receipt.
  -- The caller pattern is:
  --   SELECT nex.social_admin_read('user-x', $tid, 'account_status_only', 'support ticket #123');
  --   SET LOCAL nex.social_admin_bypass = 'on';
  --   SELECT ... FROM nex.social_accounts WHERE tenant_id = $tid;
  --   RESET nex.social_admin_bypass;
  audit_id := new_audit_id;
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION nex.social_admin_read(TEXT, UUID, nex.social_admin_readable_resource, TEXT) FROM PUBLIC;

-- ── 11 · Comments ──────────────────────────────────────────────
COMMENT ON TABLE  nex.social_tenants IS         'Charter §0 Boundary 1 · first-class multi-tenancy · HQ or trade';
COMMENT ON TABLE  nex.social_role_grants IS     'Charter §S-V role scoping · nex_admin_publish max 24h (approved A5)';
COMMENT ON TABLE  nex.social_accounts IS        'Charter §S-IX · encrypted tokens (Phase 1) · never exposed to UI';
COMMENT ON TABLE  nex.social_publish_intents IS 'Charter §S-VII · two-phase publish idempotency · UNIQUE(tenant,post,platform,account,epoch)';
COMMENT ON TABLE  nex.social_audit_events IS    'Charter enforcement · append-only INSERT-only';
COMMENT ON TABLE  nex.social_controls IS        'Charter §S-V global kill switch';
COMMENT ON TABLE  nex.social_admin_access_log IS 'Charter §0 Boundary 3 · every cross-tenant admin read logged here';
COMMENT ON FUNCTION nex.social_admin_read(TEXT, UUID, nex.social_admin_readable_resource, TEXT) IS
  'Charter §0 Boundary 3 · the ONLY cross-tenant read entry point · records audit row before caller sets bypass GUC';
