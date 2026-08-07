-- NEX Comms Centre · Social · non-superuser application role.
--
-- RLS on nex.social_* only enforces when the executing role is NOT a
-- superuser (superusers bypass RLS regardless of FORCE ROW LEVEL SECURITY).
-- Production runtime uses NEX_POSTGRES_URL that may connect as the DB
-- owner; the runtime MUST switch to `nex_social_app` before any query
-- against a nex.social_* table so RLS is authoritative.
--
-- Runtime helpers `withTenantClient` and `withAdminBypass` in
-- `src/lib/nex/comms-social/db.ts` issue `SET LOCAL ROLE nex_social_app`
-- at the start of every transaction.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_social_app') THEN
    CREATE ROLE nex_social_app NOLOGIN;
  END IF;
END $$;

-- Table-level grants · limited to nex.social_* only.
GRANT USAGE ON SCHEMA nex TO nex_social_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  nex.social_tenants,
  nex.social_role_grants,
  nex.social_accounts,
  nex.social_publish_intents,
  nex.social_controls
  TO nex_social_app;

-- Audit tables · INSERT + SELECT only (append-only pattern enforced
-- at table-grant level in addition to the REVOKE in 029).
GRANT SELECT, INSERT ON
  nex.social_audit_events,
  nex.social_admin_access_log
  TO nex_social_app;

-- Sequence grants so BIGSERIAL columns work under this role.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA nex TO nex_social_app;

-- Function usage · admin_read wrapper is the ONLY cross-tenant read entry.
GRANT EXECUTE ON FUNCTION nex.social_admin_read(TEXT, UUID, nex.social_admin_readable_resource, TEXT)
  TO nex_social_app;

-- Allow the connecting user (typically the DB owner) to SET ROLE
-- nex_social_app. In production this permission mirrors here:
--   GRANT nex_social_app TO <app_login_role>;
-- For local dev we grant to `postgres`.
GRANT nex_social_app TO postgres;
