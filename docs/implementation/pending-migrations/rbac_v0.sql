-- Pending migration · RBAC V0 · 3-role model
-- Depends on: ADR-0019 (Workforce Trust Ladder) · ES-04 §2 (RBAC design)
-- Status: PREPARED · not yet in supabase/migrations/ · awaiting ADR acceptance
-- Promotion path: on ADR-0019 acceptance, copy to supabase/migrations/20260728_rbac_v0.sql
--
-- Rationale: Owner/Manager/Member simplified from ES-01 correction #13 (was 5 roles · 3 for V0).
-- Custom overrides + Auditor role deferred to V1.

BEGIN;

-- ─── Team membership per merchant ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_team_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug     TEXT NOT NULL,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'member')),

  -- Manager scope: list of module names they can manage (Finance · Site · Marketing · etc.)
  -- NULL for owner (implicit *) · NULL for member (irrelevant · always task-scoped)
  module_scope      TEXT[],

  invited_by        UUID REFERENCES auth.users(id),
  invited_at        TIMESTAMPTZ,
  joined_at         TIMESTAMPTZ,
  last_active_at    TIMESTAMPTZ,

  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('invited', 'active', 'suspended', 'removed')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (merchant_slug, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_merchant
  ON public.hammerex_nex_team_members (merchant_slug, status);

CREATE INDEX IF NOT EXISTS idx_team_members_user
  ON public.hammerex_nex_team_members (user_id);

-- ─── Permission matrix per role ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role           TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'member')),
  module         TEXT NOT NULL,       -- 'finance' · 'sitebook' · 'estimator' · etc.
  action         TEXT NOT NULL,       -- 'read' · 'write' · 'approve' · 'delete'
  scope          TEXT NOT NULL,       -- '*' (all) · 'own' (own records) · 'module' (assigned module)
  UNIQUE (role, module, action, scope)
);

-- ─── Seed default permissions ───────────────────────────────────

-- Owner: everything, everywhere
INSERT INTO public.hammerex_nex_permissions (role, module, action, scope) VALUES
  ('owner', '*', '*', '*');

-- Manager: full control within assigned modules
INSERT INTO public.hammerex_nex_permissions (role, module, action, scope) VALUES
  ('manager', 'assigned', 'read', '*'),
  ('manager', 'assigned', 'write', '*'),
  ('manager', 'assigned', 'approve', '*'),
  -- Manager cannot delete merchant · cannot manage billing · cannot manage other team members' roles
  ('manager', 'billing', 'read', '*');

-- Member: read + write own · read module summary
INSERT INTO public.hammerex_nex_permissions (role, module, action, scope) VALUES
  ('member', 'assigned', 'read', 'module'),
  ('member', 'assigned', 'write', 'own'),
  ('member', 'assigned', 'read', 'own');

-- ─── RLS policies ───────────────────────────────────────────────

ALTER TABLE public.hammerex_nex_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_nex_permissions ENABLE ROW LEVEL SECURITY;

-- Owner can read all team members in their merchant
CREATE POLICY "team_members_read_by_merchant"
  ON public.hammerex_nex_team_members
  FOR SELECT
  USING (
    merchant_slug IN (
      SELECT merchant_slug FROM public.hammerex_nex_team_members
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Only owner can invite/modify team members
CREATE POLICY "team_members_write_by_owner"
  ON public.hammerex_nex_team_members
  FOR ALL
  USING (
    merchant_slug IN (
      SELECT merchant_slug FROM public.hammerex_nex_team_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- Permissions table is read-only for all authenticated users (helper for enforcement)
CREATE POLICY "permissions_read_all"
  ON public.hammerex_nex_permissions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── Comment metadata ────────────────────────────────────────────

COMMENT ON TABLE public.hammerex_nex_team_members IS
  'Phase 0 Week 3 · RBAC V0 · Team members per merchant · 3 roles (Owner/Manager/Member) per ADR-0019 + ES-01 correction #13.';
COMMENT ON TABLE public.hammerex_nex_permissions IS
  'Phase 0 Week 3 · RBAC V0 · Permission matrix per role · used by application-layer enforcement middleware.';

COMMIT;
