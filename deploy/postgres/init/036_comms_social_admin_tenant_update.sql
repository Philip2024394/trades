-- NEX Comms Centre · Social · Phase 7 addendum · admin UPDATE on social_tenants.
--
-- Phase 0 (migration 029) set social_tenants UPDATE to tenant-scoped
-- only. HQ mission control needs to suspend/reactivate tenants — a
-- legitimate admin operation. This migration extends the UPDATE policy
-- to accept admin_bypass in addition to tenant self-match.
--
-- Tenant-owned columns are still self-updatable (unchanged). Admin
-- bypass allows status flips (active↔suspended↔deleted) and any other
-- HQ-managed field. The Boundary-3 wrapper still runs before every
-- admin action so we get an audit row.
--
-- Zero changes to any other table. Zero risk of scope creep — this is
-- the ONLY table where admin write-bypass is added, and only for the
-- explicit HQ management use case.

DROP POLICY IF EXISTS social_tenants_self_update ON nex.social_tenants;
CREATE POLICY social_tenants_self_update ON nex.social_tenants
  FOR UPDATE
  USING (tenant_id = nex._current_social_tenant() OR nex._admin_bypass_active())
  WITH CHECK (tenant_id = nex._current_social_tenant() OR nex._admin_bypass_active());

COMMENT ON POLICY social_tenants_self_update ON nex.social_tenants IS
  'Phase 7 · self-update OR admin bypass · admin bypass writes audited via Boundary-3 wrapper';
