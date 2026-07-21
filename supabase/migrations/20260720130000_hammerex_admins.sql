-- Per-admin identities + roles.
-- Phase 0.2 of the engine-first roadmap.
--
-- v1 goal: separate admin actors so audit log has real actor_admin_id,
-- and route-guards can check role (moderator can't see finance,
-- support can't see analytics beyond their remit).
--
-- Preserves shared-password ADMIN_PASSWORD as fallback for the
-- solo-operator case (Philip). When ADMIN_PASSWORD login is used
-- without an email, actor_admin_id is null and actor_email captures
-- 'root' in audit log.
--
-- Password: bcrypt (server-side). Cookie: signed session token
-- containing admin_id + role (upgrade path from shared-password HMAC).

CREATE TABLE IF NOT EXISTS public.hammerex_admins (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT           NOT NULL UNIQUE,
  password_hash     TEXT           NOT NULL,       -- bcrypt

  -- Role — determines route-guard access. 'admin' = all; others
  -- see their remit only. Extend with new roles as ops grows.
  role              TEXT           NOT NULL DEFAULT 'admin'
                                    CHECK (role IN ('admin', 'moderator', 'support', 'analyst', 'finance')),

  display_name      TEXT,
  active            BOOLEAN        NOT NULL DEFAULT TRUE,

  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  last_login_at     TIMESTAMPTZ,

  -- Metadata for ops
  created_by        UUID,                          -- who invited them (nullable for seed admin)
  invitation_token  TEXT,                          -- one-time set-password link
  invitation_expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admins_email
  ON public.hammerex_admins (email) WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_admins_role
  ON public.hammerex_admins (role) WHERE active = TRUE;

ALTER TABLE public.hammerex_admins ENABLE ROW LEVEL SECURITY;
-- Service-role only. Read via admin API layer.
