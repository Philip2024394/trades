-- 20260728130100_nex_sessions.sql
-- D1 · NEX Sessions audit trail (Philip 2026-07-28)
--
-- Every login writes a row here. Enables incident investigation:
--   "Philip says he never approved that module."
--       → look up the session that performed the approval
--       → see device, IP, MFA status, time
--       → correlate against known logins vs anomalies
--
-- This is NOT Supabase's session management (which lives in
-- auth.sessions). This is an application-level audit log. Both exist
-- simultaneously and serve different purposes:
--   auth.sessions      · Supabase's cookie/refresh handling
--   hammerex_nex_sessions · NEX's tamper-visible audit trail

CREATE TABLE IF NOT EXISTS public.hammerex_nex_sessions (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid          NOT NULL
                                     REFERENCES public.hammerex_nex_users(id) ON DELETE RESTRICT,
  supabase_session_id  text          NULL,
    -- reference to auth.sessions where captured; may be null when the
    -- application layer records the session but the Supabase cookie
    -- surface didn't expose an id (e.g. server-side refresh path)
  login_at             timestamptz   NOT NULL DEFAULT now(),
  last_seen            timestamptz   NOT NULL DEFAULT now(),
  ip                   text          NULL,
  user_agent           text          NULL,
  device_name          text          NULL,
  mfa_used             boolean       NOT NULL DEFAULT false,
  revoked_at           timestamptz   NULL,
  revoke_reason        text          NULL,
  metadata             jsonb         NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_nex_sessions_user
  ON public.hammerex_nex_sessions(user_id, login_at DESC);

CREATE INDEX IF NOT EXISTS ix_nex_sessions_active
  ON public.hammerex_nex_sessions(revoked_at) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_nex_sessions_ip
  ON public.hammerex_nex_sessions(ip) WHERE ip IS NOT NULL;

ALTER TABLE public.hammerex_nex_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.hammerex_nex_sessions;
CREATE POLICY "service_role_all"
  ON public.hammerex_nex_sessions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_reads_own_sessions" ON public.hammerex_nex_sessions;
CREATE POLICY "user_reads_own_sessions"
  ON public.hammerex_nex_sessions FOR SELECT
  TO authenticated
  USING (user_id IN (
    SELECT id FROM public.hammerex_nex_users WHERE supabase_user_id = auth.uid()
  ));

COMMENT ON TABLE public.hammerex_nex_sessions IS
  'Application-level session audit trail · enables incident investigation of disputed actions · Philip 2026-07-28 D1';
