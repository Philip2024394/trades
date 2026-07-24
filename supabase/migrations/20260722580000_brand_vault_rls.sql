-- Trade OS · Brand Vault RLS.
-- Every design-OS table already has RLS enabled but no policies.
-- Add merchant-slug-scoped policies so the anon key cannot see cross-
-- merchant data. The admin key (service role) bypasses RLS as usual.
--
-- Ownership model:
--   • hammerex_brand_identity  → merchant_slug OR homeowner_id
--   • hammerex_brand_snapshots → chained through brand_identity_id
--   • hammerex_van_sessions    → merchant_slug OR homeowner_id
--   • hammerex_van_generations → chained through session_id
--
-- Session context: the Studio always resolves the merchant on the
-- server via Route Handlers using the service role. This RLS is
-- defence-in-depth in case any client-side supabase-js call slips
-- through with an anon key. No client should ever hit these tables
-- directly.

-- ─── hammerex_brand_identity ─────────────────────────────────────

DROP POLICY IF EXISTS brand_identity_owner_read ON public.hammerex_brand_identity;
CREATE POLICY brand_identity_owner_read
  ON public.hammerex_brand_identity
  FOR SELECT
  TO authenticated
  USING (
    -- Match either merchant OR homeowner ownership via JWT claim.
    (auth.jwt() ->> 'merchant_slug') IS NOT NULL
    AND merchant_slug = (auth.jwt() ->> 'merchant_slug')
    OR (auth.jwt() ->> 'homeowner_id') IS NOT NULL
    AND homeowner_id::text = (auth.jwt() ->> 'homeowner_id')
  );

DROP POLICY IF EXISTS brand_identity_owner_write ON public.hammerex_brand_identity;
CREATE POLICY brand_identity_owner_write
  ON public.hammerex_brand_identity
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'merchant_slug') IS NOT NULL
    AND merchant_slug = (auth.jwt() ->> 'merchant_slug')
    OR (auth.jwt() ->> 'homeowner_id') IS NOT NULL
    AND homeowner_id::text = (auth.jwt() ->> 'homeowner_id')
  );

-- ─── hammerex_brand_snapshots ────────────────────────────────────
-- Chained through brand_identity_id. If you can see the identity, you
-- can see its snapshots.

DROP POLICY IF EXISTS brand_snapshots_owner_read ON public.hammerex_brand_snapshots;
CREATE POLICY brand_snapshots_owner_read
  ON public.hammerex_brand_snapshots
  FOR SELECT
  TO authenticated
  USING (
    brand_identity_id IN (
      SELECT id FROM public.hammerex_brand_identity
      WHERE (
        (auth.jwt() ->> 'merchant_slug') IS NOT NULL
        AND merchant_slug = (auth.jwt() ->> 'merchant_slug')
        OR (auth.jwt() ->> 'homeowner_id') IS NOT NULL
        AND homeowner_id::text = (auth.jwt() ->> 'homeowner_id')
      )
    )
  );

-- ─── hammerex_van_sessions ───────────────────────────────────────

DROP POLICY IF EXISTS van_sessions_owner_read ON public.hammerex_van_sessions;
CREATE POLICY van_sessions_owner_read
  ON public.hammerex_van_sessions
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'merchant_slug') IS NOT NULL
    AND merchant_slug = (auth.jwt() ->> 'merchant_slug')
    OR (auth.jwt() ->> 'homeowner_id') IS NOT NULL
    AND homeowner_id::text = (auth.jwt() ->> 'homeowner_id')
  );

-- ─── hammerex_van_generations ────────────────────────────────────
-- Chained through session_id.

DROP POLICY IF EXISTS van_generations_owner_read ON public.hammerex_van_generations;
CREATE POLICY van_generations_owner_read
  ON public.hammerex_van_generations
  FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.hammerex_van_sessions
      WHERE (
        (auth.jwt() ->> 'merchant_slug') IS NOT NULL
        AND merchant_slug = (auth.jwt() ->> 'merchant_slug')
        OR (auth.jwt() ->> 'homeowner_id') IS NOT NULL
        AND homeowner_id::text = (auth.jwt() ->> 'homeowner_id')
      )
    )
  );

-- ─── hammerex_trade_os_events (append-only) ───────────────────────────────
-- Merchants can see their own event stream. Cross-merchant events are
-- invisible. The service role always sees all.

ALTER TABLE IF EXISTS public.hammerex_trade_os_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_merchant_read ON public.hammerex_trade_os_events;
CREATE POLICY events_merchant_read
  ON public.hammerex_trade_os_events
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'merchant_slug') IS NOT NULL
    AND merchant_id = (auth.jwt() ->> 'merchant_slug')
  );

-- ─── Comment on isolation model ──────────────────────────────────
COMMENT ON TABLE public.hammerex_brand_identity IS
  'Brand DNA. RLS: merchant/homeowner sees own row only. Service role bypass. Client anon key MUST NOT be used to query this table directly.';

COMMENT ON TABLE public.hammerex_van_generations IS
  'Generated van assets + recipes. RLS chained through van_sessions.merchant_slug. Service role bypass. Cross-merchant isolation confirmed via RLS 2026-07-22.';
