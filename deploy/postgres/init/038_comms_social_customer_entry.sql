-- NEX Comms Centre · Social · Phase 10 · Customer Entry
--
-- Adds the ownership link that lets an authenticated Nex user (Supabase
-- Auth user via hammerex_nex_users) resolve to exactly one Social tenant
-- without exposing tenant_id to the merchant UI.
--
-- Additive only. Zero changes to the frozen v1.0.0 kernel. Preserves
-- every S-I through S-XII invariant. RLS behaviour unchanged.

-- 1 · Ownership column (nullable so existing HQ + admin-created tenants
--     keep working; only merchant-provisioned tenants populate it).
ALTER TABLE nex.social_tenants
  ADD COLUMN IF NOT EXISTS owner_supabase_user_id TEXT;

-- 2 · Partial unique index enforces "one live tenant per merchant user".
--     Excludes deleted tenants so an owner can re-provision after
--     a soft-delete without violating uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS social_tenants_owner_uidx
  ON nex.social_tenants (owner_supabase_user_id)
  WHERE owner_supabase_user_id IS NOT NULL AND status <> 'deleted';

-- 3 · Non-unique lookup index for the resolver hot-path.
CREATE INDEX IF NOT EXISTS social_tenants_owner_lookup_idx
  ON nex.social_tenants (owner_supabase_user_id, status)
  WHERE owner_supabase_user_id IS NOT NULL;

COMMENT ON COLUMN nex.social_tenants.owner_supabase_user_id IS
  'Phase 10 · Supabase Auth user id (hammerex_nex_users.supabase_user_id) for merchant-provisioned tenants · nullable for legacy HQ/admin tenants · unique when set + not deleted';
