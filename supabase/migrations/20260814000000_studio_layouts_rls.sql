-- =========================================================================
-- NEX Studio · RLS migration for public.studio_layouts (Philip 2026-08-14)
--
-- Enforces merchant-ownership at the DATABASE boundary, not just app code.
-- Closes the audit finding that service-role writes to studio_layouts can
-- leak cross-merchant if application session logic loosens (e.g. dev-bypass).
--
-- Depends on:
--   - src/lib/studio/scopedClient.ts issuing ES256 JWTs with `merchant_id` claim
--   - src/app/api/auth/nex-jwks/route.ts serving the public JWK
--   - Supabase Auth → JWT Issuers registration pointing at that JWKS URL
--
-- Policy shape verified: 12/12 assertions passed on
-- public.nex_security_test_studio_layouts (see scripts/nex-security/
-- stage2-rls-4scenarios.mjs).
--
-- APPLICATION ORDER (do NOT reorder):
--   Stage 1  ✅  scoped JWT client + JWKS route (local)
--   Stage 2  ✅  RLS pattern proven on test table
--   Stage 3  ⏸  deploy JWKS route to Vercel + register with Supabase
--   Stage 4  ⏸  migrate 5 studio_layouts writers off supabaseAdmin
--   Stage 5  ⏸  APPLY THIS MIGRATION to production
--
-- SAFETY NOTE: service_role has BYPASSRLS by default. Applying RLS in
-- production BEFORE writers are migrated is technically a no-op for
-- existing traffic, but that hides policy bugs. Apply only after Stages 3-4.
-- =========================================================================

begin;

-- Helper: read merchant_id from the incoming JWT claim.
-- Returns NULL for service_role or missing/malformed claim, which will
-- correctly deny access under the policies below (with_check fails,
-- using-clause returns 0 rows).
create or replace function public.nex_current_merchant_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $function$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'merchant_id', '')::uuid
$function$;

comment on function public.nex_current_merchant_id()
  is 'Reads merchant_id from the caller''s JWT claim. Returns NULL for service_role or unauthenticated. Used by RLS policies on tenant tables.';

-- Enable RLS. Existing service_role callers unaffected (BYPASSRLS).
alter table public.studio_layouts enable row level security;

-- Fail closed by default: drop any existing policies so re-runs converge.
drop policy if exists studio_layouts_select_own on public.studio_layouts;
drop policy if exists studio_layouts_insert_own on public.studio_layouts;
drop policy if exists studio_layouts_update_own on public.studio_layouts;
drop policy if exists studio_layouts_delete_own on public.studio_layouts;

-- SELECT · merchants can read only their own layouts.
create policy studio_layouts_select_own
  on public.studio_layouts
  for select
  to authenticated
  using ( merchant_id = public.nex_current_merchant_id() );

-- INSERT · merchants can insert only rows they own.
create policy studio_layouts_insert_own
  on public.studio_layouts
  for insert
  to authenticated
  with check ( merchant_id = public.nex_current_merchant_id() );

-- UPDATE · both USING and WITH CHECK — prevents changing merchant_id to steal.
create policy studio_layouts_update_own
  on public.studio_layouts
  for update
  to authenticated
  using      ( merchant_id = public.nex_current_merchant_id() )
  with check ( merchant_id = public.nex_current_merchant_id() );

-- DELETE · only own rows.
create policy studio_layouts_delete_own
  on public.studio_layouts
  for delete
  to authenticated
  using ( merchant_id = public.nex_current_merchant_id() );

-- PostgREST needs table-level GRANTs on top of RLS.
grant select, insert, update, delete on public.studio_layouts to authenticated;

-- Anon explicitly denied — no unauthenticated writes/reads.
revoke all on public.studio_layouts from anon;

commit;

-- =========================================================================
-- Verification (run manually after apply, do NOT include in migration txn):
--   select relrowsecurity from pg_class where relname = 'studio_layouts';
--   -- expect true
--   select policyname, cmd from pg_policies
--     where schemaname = 'public' and tablename = 'studio_layouts'
--     order by policyname;
--   -- expect 4 rows
-- =========================================================================
