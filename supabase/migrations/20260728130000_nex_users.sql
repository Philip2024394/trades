-- 20260728130000_nex_users.sql
-- D1 · NEX Users (Philip 2026-07-28)
--
-- Authorization source of truth. Supabase Auth handles identity
-- ("who is this?"). This table handles authorization
-- ("what are they allowed to do?"). Separation is deliberate per
-- Philip's architectural directive:
--
--   Supabase Session
--         ↓
--   Verified User ID
--         ↓
--   Lookup hammerex_nex_users
--         ↓
--   role · status · qualifications · permissions
--
-- The supabase_user_id links to auth.users(id) but is not a hard FK
-- (cross-schema FKs to Supabase-managed auth schema are fragile).

CREATE TABLE IF NOT EXISTS public.hammerex_nex_users (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id    uuid          NOT NULL UNIQUE,
  email               text          NOT NULL UNIQUE,
  display_name        text          NOT NULL,
  role                text          NOT NULL DEFAULT 'author',
    -- author | reviewer | admin | system | runtime
  status              text          NOT NULL DEFAULT 'active',
    -- active | suspended | invited | revoked
  qualifications      jsonb         NOT NULL DEFAULT '{}'::jsonb,
    -- Extensible per-user metadata. Examples:
    --   { "certified_expert": true, "credentials": "Certified Staircase Manufacturer" }
    --   { "verified_expert": true, "verification_body": "BWF Stair Scheme", "verified_at": "..." }
  organisation        text          NULL,
  approved_by         text          NULL,
    -- who authorised this user's account (usually an admin email)
  last_login_at       timestamptz   NULL,
  metadata            jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT role_valid   CHECK (role   IN ('author', 'reviewer', 'admin', 'system', 'runtime')),
  CONSTRAINT status_valid CHECK (status IN ('active', 'suspended', 'invited', 'revoked'))
);

CREATE INDEX IF NOT EXISTS ix_nex_users_supabase_id ON public.hammerex_nex_users(supabase_user_id);
CREATE INDEX IF NOT EXISTS ix_nex_users_email       ON public.hammerex_nex_users(email);
CREATE INDEX IF NOT EXISTS ix_nex_users_role        ON public.hammerex_nex_users(role);
CREATE INDEX IF NOT EXISTS ix_nex_users_status_not_active
  ON public.hammerex_nex_users(status) WHERE status != 'active';

CREATE OR REPLACE FUNCTION public.touch_nex_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_users_touch_updated_at ON public.hammerex_nex_users;
CREATE TRIGGER trg_nex_users_touch_updated_at
  BEFORE UPDATE ON public.hammerex_nex_users
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_nex_users_updated_at();

-- RLS: users see their own row; service_role has full access
ALTER TABLE public.hammerex_nex_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.hammerex_nex_users;
CREATE POLICY "service_role_all"
  ON public.hammerex_nex_users FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_reads_self" ON public.hammerex_nex_users;
CREATE POLICY "user_reads_self"
  ON public.hammerex_nex_users FOR SELECT
  TO authenticated
  USING (supabase_user_id = auth.uid());

COMMENT ON TABLE public.hammerex_nex_users IS
  'NEX authorization source of truth · separate from auth.users (Supabase identity) · Philip 2026-07-28 D1';
