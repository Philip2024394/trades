-- 183_nex_directory_dp3_grant_revoke.sql
--
-- NEX Directory Canonical Spine · DP-3 lockdown wave.
-- Phase-1 build authorised 2026-10-09.
--
-- WHAT THIS MIGRATION DOES
--   Enforces the sealed role separation between NEX surfaces (reader
--   path) and the canonical truth tables:
--
--     · REVOKE direct SELECT on:
--         nex.business_canonical
--         nex.business_evidence
--         nex.business_fact_conflict
--         nex.business_canonical_lifecycle_log
--         nex.business_media
--         nex.business_claim
--       from the sealed `nex_directory_reader` role.
--
--     · GRANT SELECT on the sealed publication boundary:
--         nex.business_directory_v
--         nex.business_directory_attribution_v
--         nex.business_freshness_v  (safe · derived from canonical only)
--       to the sealed `nex_directory_reader` role.
--
--   The sealed role `nex_directory_reader` is used by the Directory
--   service (`src/lib/nex-native/directory/directory-service.ts`) to
--   query the publication view. After DP-3 lands, the service literally
--   cannot read raw canonical rows even if a developer tries to point
--   it at the base table.
--
-- SEALED DOCTRINE SEPARATION (preserved by this migration)
--   NEX Intelligence (truth)          — reads canonical directly;
--                                       role: nex_intelligence_reader
--                                       (not touched by DP-3)
--   NEX Directory (what's publishable) — reads business_directory_v
--                                       ONLY; role: nex_directory_reader
--                                       (sealed by DP-3)
--   NEX Business (owner-controls)     — reads/writes nex_business +
--                                       nex.business_claim;
--                                       role: nex_business_owner
--                                       (not touched by DP-3)
--   NEX Marketing (acquisition)       — reads NO sealed-spine tables;
--                                       role: nex_marketing_reader
--                                       (not touched by DP-3)
--
-- IDEMPOTENCE
--   Every GRANT / REVOKE is guarded by a DO block that checks if the
--   role exists first. On a DB where `nex_directory_reader` has not yet
--   been created, this migration is a safe no-op · it does NOT create
--   the role (that is operator infrastructure work, not schema work).
--
-- ROLLBACK (operational)
--   BEGIN;
--     GRANT SELECT ON TABLE nex.business_canonical           TO nex_directory_reader;
--     GRANT SELECT ON TABLE nex.business_evidence            TO nex_directory_reader;
--     GRANT SELECT ON TABLE nex.business_fact_conflict       TO nex_directory_reader;
--     GRANT SELECT ON TABLE nex.business_canonical_lifecycle_log TO nex_directory_reader;
--     GRANT SELECT ON TABLE nex.business_media               TO nex_directory_reader;
--     GRANT SELECT ON TABLE nex.business_claim               TO nex_directory_reader;
--     REVOKE SELECT ON TABLE nex.business_directory_v        FROM nex_directory_reader;
--     REVOKE SELECT ON TABLE nex.business_directory_attribution_v FROM nex_directory_reader;
--     REVOKE SELECT ON TABLE nex.business_freshness_v        FROM nex_directory_reader;
--   COMMIT;
--
-- SAFE ON POPULATED DB
--   Yes. Role-based GRANT/REVOKE. No ALTER TABLE on data. No DML.
--   The Directory service's existing deployments must have been migrated
--   to the sealed `nex_directory_reader` role before DP-3 is applied;
--   otherwise the service will see "permission denied for table
--   business_canonical" after apply.
--
-- OPERATOR PREREQUISITE
--   The sealed role `nex_directory_reader` must exist in the target DB
--   before this migration runs. Role creation is operator infrastructure
--   work; see the sealed deployment runbook. On a DB without the role,
--   this migration is a no-op.
--
-- WHAT THIS MIGRATION IS NOT
--   · Not a service rewrite. The Directory service was already cut over
--     to read `business_directory_v` in DP-2 (commit `79686ea4`).
--   · Not a GRANT to any role other than `nex_directory_reader`. Other
--     roles (`nex_intelligence_reader`, `nex_business_owner`, admin, etc.)
--     have their own GRANT/REVOKE waves.
--   · Not a public-schema permission change. The sealed convention
--     keeps `nex.*` out of the default search path for untrusted roles.
--
-- NOT APPLIED
--   Phase 1 of the sealed architecture. MUST NOT be applied to any live
--   database without an explicit founder authorisation AND operator
--   confirmation that the `nex_directory_reader` role exists AND that
--   the Directory service deployment is already configured to use that
--   role as its connection identity.

-- ═══════════════════════════════════════════════════════════════════
-- Idempotency guard · check role exists first
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'nex_directory_reader'
  ) THEN
    RAISE NOTICE 'Migration 183: role nex_directory_reader not present · migration is a no-op. Create the role (operator infrastructure) before re-applying.';
    RETURN;
  END IF;

  -- ═════════════════════════════════════════════════════════════════
  -- REVOKE direct SELECT on sealed base tables
  -- ═════════════════════════════════════════════════════════════════

  REVOKE SELECT ON TABLE nex.business_canonical
    FROM nex_directory_reader;

  REVOKE SELECT ON TABLE nex.business_evidence
    FROM nex_directory_reader;

  -- business_fact_conflict and business_canonical_lifecycle_log exist
  -- after migrations 174 and 168 respectively. If 174/168 have not been
  -- applied yet (shouldn't happen under correct apply order 166→183),
  -- the REVOKEs would fail. The outer DO block refuses on any error
  -- to keep the apply atomic.
  REVOKE SELECT ON TABLE nex.business_fact_conflict
    FROM nex_directory_reader;

  REVOKE SELECT ON TABLE nex.business_canonical_lifecycle_log
    FROM nex_directory_reader;

  REVOKE SELECT ON TABLE nex.business_media
    FROM nex_directory_reader;

  REVOKE SELECT ON TABLE nex.business_claim
    FROM nex_directory_reader;

  -- ═════════════════════════════════════════════════════════════════
  -- GRANT SELECT on sealed publication boundary views
  -- ═════════════════════════════════════════════════════════════════

  GRANT SELECT ON TABLE nex.business_directory_v
    TO nex_directory_reader;

  GRANT SELECT ON TABLE nex.business_directory_attribution_v
    TO nex_directory_reader;

  GRANT SELECT ON TABLE nex.business_freshness_v
    TO nex_directory_reader;

  RAISE NOTICE 'Migration 183 complete · DP-3 lockdown applied to nex_directory_reader';
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 183.
--
-- Operator verification (expected after apply · requires superuser or
-- a role granted SELECT on information_schema):
--
--   SELECT table_schema, table_name, privilege_type
--   FROM information_schema.table_privileges
--   WHERE grantee = 'nex_directory_reader'
--     AND table_schema = 'nex'
--   ORDER BY table_name;
--
-- Expected shape:
--   nex | business_directory_attribution_v | SELECT
--   nex | business_directory_v             | SELECT
--   nex | business_freshness_v             | SELECT
--
-- (No rows for business_canonical, business_evidence, etc. · they
-- have been REVOKEd.)
-- ═══════════════════════════════════════════════════════════════════
