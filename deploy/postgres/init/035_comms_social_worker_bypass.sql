-- NEX Comms Centre · Social · Phase 4 addendum · worker write bypass
--
-- The system worker (nex.social_scheduled_posts consumer) needs to
-- pick + lease + update queue rows ACROSS tenants. Admin bypass
-- (Boundary 3) is deliberately READ-only. This migration introduces
-- a distinct `nex._worker_active()` GUC-backed function and adds it
-- as an OR branch on the UPDATE policies of the queue tables ONLY:
--   * nex.social_scheduled_posts    · workers move rows through
--     status='queued' → 'leased' → 'published'/'failed'/'refused_at_recheck'
--   * nex.social_publish_intents    · workers INSERT + UPDATE intent rows
--
-- Tenant-facing tables (contacts · accounts · content · rights) do NOT
-- get the worker branch. If the worker ever needs to touch those, it
-- routes through the admin_read wrapper (with audit) — no shortcut.
--
-- Enforcement note: the runtime helper that sets this GUC lives only
-- inside src/lib/nex/comms-social/worker/worker.ts. Anywhere else that
-- sets 'nex.social_worker' is a doctrine violation (grepable · adds to
-- the CI verifier list in a follow-up patch).

CREATE OR REPLACE FUNCTION nex._worker_active() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('nex.social_worker', TRUE) = 'on', FALSE)
$$;

-- Extend UPDATE policies on queue tables to accept worker bypass.
--
-- We drop the previous UPDATE policy (which had no bypass) and recreate
-- it with `tenant_id = _current_social_tenant() OR _worker_active()`.
-- We DO NOT touch SELECT · INSERT · DELETE policies.

DROP POLICY IF EXISTS social_scheduled_posts_tenant_update ON nex.social_scheduled_posts;
CREATE POLICY social_scheduled_posts_tenant_update ON nex.social_scheduled_posts
  FOR UPDATE
  USING (tenant_id = nex._current_social_tenant() OR nex._worker_active())
  WITH CHECK (tenant_id = nex._current_social_tenant() OR nex._worker_active());

-- Also allow SELECT under worker bypass so that FOR UPDATE SKIP LOCKED
-- can see rows across tenants during the pick phase. (SELECT alone was
-- already handled by the admin bypass; the worker uses its own GUC to
-- avoid coupling with the admin-access-log wrapper.)
DROP POLICY IF EXISTS social_scheduled_posts_tenant_select ON nex.social_scheduled_posts;
CREATE POLICY social_scheduled_posts_tenant_select ON nex.social_scheduled_posts
  FOR SELECT
  USING (tenant_id = nex._current_social_tenant() OR nex._admin_bypass_active() OR nex._worker_active());

-- Same for social_publish_intents (workers manage these rows too).
DROP POLICY IF EXISTS social_publish_intents_tenant_update ON nex.social_publish_intents;
CREATE POLICY social_publish_intents_tenant_update ON nex.social_publish_intents
  FOR UPDATE
  USING (tenant_id = nex._current_social_tenant() OR nex._worker_active())
  WITH CHECK (tenant_id = nex._current_social_tenant() OR nex._worker_active());

DROP POLICY IF EXISTS social_publish_intents_tenant_select ON nex.social_publish_intents;
CREATE POLICY social_publish_intents_tenant_select ON nex.social_publish_intents
  FOR SELECT
  USING (tenant_id = nex._current_social_tenant() OR nex._admin_bypass_active() OR nex._worker_active());

DROP POLICY IF EXISTS social_publish_intents_tenant_insert ON nex.social_publish_intents;
CREATE POLICY social_publish_intents_tenant_insert ON nex.social_publish_intents
  FOR INSERT
  WITH CHECK (tenant_id = nex._current_social_tenant() OR nex._worker_active());

COMMENT ON FUNCTION nex._worker_active() IS
  'Phase 4 · true when the system worker daemon is executing · GUC nex.social_worker=on · set ONLY by src/lib/nex/comms-social/worker/worker.ts';
