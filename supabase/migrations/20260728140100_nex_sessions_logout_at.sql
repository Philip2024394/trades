-- 20260728140100_nex_sessions_logout_at.sql
-- D1 Turn 2 · Session logout distinct from revoke (Philip 2026-07-28)
--
-- Original schema had `revoked_at` (admin cut off) but no `logout_at`
-- (user chose to end). These are different events and should be tracked
-- separately for audit clarity:
--
--   logout_at   · user clicked "sign out"
--   revoked_at  · admin killed the session (compromise, policy, etc.)
--
-- Either can be set independently. Both mean the session is over.

ALTER TABLE public.hammerex_nex_sessions
  ADD COLUMN IF NOT EXISTS logout_at timestamptz NULL;

COMMENT ON COLUMN public.hammerex_nex_sessions.logout_at IS
  'Timestamp when the user chose to end the session. Distinct from revoked_at (admin action) · Philip 2026-07-28';

CREATE INDEX IF NOT EXISTS ix_nex_sessions_open
  ON public.hammerex_nex_sessions(user_id, login_at DESC)
  WHERE logout_at IS NULL AND revoked_at IS NULL;
