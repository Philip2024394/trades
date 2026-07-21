-- Admin audit log · every admin action across every surface.
--
-- Phase 0.1 of the engine-first roadmap
-- (docs/ADMIN_OPS_ROADMAP_60D_2026_07_19.md).
--
-- Foundation for RBAC (Phase 0.2), fraud detection, dispute
-- resolution, and legal compliance. Every subsequent admin surface
-- writes here.
--
-- actor_admin_id is nullable in v1 because current admin auth is
-- shared-password (no per-admin identity). Phase 0.2 introduces
-- hammerex_admins and back-fills this column.
--
-- before_state / after_state stored as JSONB snapshots so
-- Rule-3 non-destructive-restore can reconstruct pre-action state
-- from log alone.

CREATE TABLE IF NOT EXISTS public.hammerex_admin_audit_log (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WHO did it
  actor_admin_id   UUID,                          -- back-filled in Phase 0.2
  actor_email      TEXT,                          -- fallback identity for v1
  actor_kind       TEXT          NOT NULL DEFAULT 'admin',
                                  -- 'admin' | 'moderator' | 'support' |
                                  -- 'analyst' | 'finance' | 'system' |
                                  -- 'scheduled' (cron)

  -- WHAT they did — free-text namespaced verb, e.g.
  -- "yard.post.moderate", "user.suspend", "merchant.tier.upgrade",
  -- "gdpr.export.fulfill", "cost.refund.issue"
  action           TEXT          NOT NULL,

  -- TARGET of the action
  target_type      TEXT,                          -- 'user' | 'merchant' | 'yard_post' | ...
  target_id        TEXT,                          -- polymorphic — string so any PK format fits
  target_slug      TEXT,                          -- human-readable identifier for grep

  -- STATE snapshots — before + after JSONB, small enough to inline
  before_state     JSONB,
  after_state      JSONB,

  -- WHY (free text, optional but recommended)
  reason           TEXT,

  -- REQUEST context
  ip_address       INET,
  user_agent       TEXT,

  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Hot-path indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_recent
  ON public.hammerex_admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON public.hammerex_admin_audit_log (actor_admin_id, created_at DESC)
  WHERE actor_admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON public.hammerex_admin_audit_log (target_type, target_id, created_at DESC)
  WHERE target_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON public.hammerex_admin_audit_log (action, created_at DESC);

ALTER TABLE public.hammerex_admin_audit_log ENABLE ROW LEVEL SECURITY;
-- Service-role only. Reads via admin API layer.
