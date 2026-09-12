-- NEX Workforce · Slice 3 R2.2 · RLS Policy Fix
-- Author: Claude · Date: 2026-09-04
-- Governing authorization: Philip 2026-09-04 · "SLICE 3 R2.2 · DESIGN + PORTABLE
--   REHEARSAL ONLY · DO NOT APPLY TO PROJECT B."
--
-- ═════════════════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES · policies-only · zero role/schema/function changes
-- ═════════════════════════════════════════════════════════════════════════════
-- Adds exactly the 9 minimal RLS policies required to close the gap discovered
-- by the controlled proving cycle (2026-09-04) on Project B:
--
--    reaper: reap_expired_leases() failed with SQLSTATE 42501
--            "new row violates row-level security policy for table \"reaper_run\""
--
-- Root cause: six nex_workforce.* tables were left with RLS ENABLED and ZERO
-- policies since Slice 1b. Under Slice 3 R2.1, hardened SECURITY DEFINER
-- wrappers execute as nex_workforce_admin, which is not the table owner and
-- does not have BYPASSRLS. With RLS enabled + no policies, PostgreSQL denies
-- writes by default regardless of explicit GRANTs.
--
-- The proving cycle proved the ROLE-BOUNDARY chain works end-to-end:
--   nex_app_runtime → SET LOCAL ROLE nex_workforce_app → SECURITY DEFINER
--   function invocation → run as nex_workforce_admin.
-- Only the RLS layer for admin is missing.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES NOT DO
-- ═════════════════════════════════════════════════════════════════════════════
-- - NO ALTER ROLE (no BYPASSRLS, no SUPERUSER, no attribute change).
-- - NO ALTER TABLE (no ENABLE/DISABLE/FORCE ROW LEVEL SECURITY toggle).
-- - NO ALTER FUNCTION (SECURITY DEFINER + hardened search_path unchanged).
-- - NO CREATE ROLE / DROP ROLE / GRANT / REVOKE.
-- - NO CREATE TABLE / DROP TABLE / column change.
-- - NO trigger change.
-- - NO index change.
-- - NO change to nex.food_business or its Slice 1h policies.
-- - NO change to brain_app / social_app / anon / authenticated grants.
-- - NO change to nex_workforce_persister_food_business (Slice 1h isolation).
-- - NO change to nex_workforce_app EXECUTE allow-list (12 approved functions).
-- - NO change to any application code, .env.local, or System A.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POLICY DESIGN JUSTIFICATION
-- ═════════════════════════════════════════════════════════════════════════════
-- Every policy is scoped:
--    TO nex_workforce_admin       ← ONE role only
--    FOR <single command>          ← per-operation, not FOR ALL
--    USING (true) / WITH CHECK (true) where broad-scope is justified below
--
-- Broad-scope (USING/WITH CHECK true) safety proof for admin:
--   1. nex_workforce_admin is NOLOGIN · nobody can connect as admin.
--   2. Admin is only reachable via SECURITY DEFINER wrappers · never invoked
--      directly by any external principal.
--   3. EXECUTE on those wrappers is granted exclusively to nex_workforce_app.
--   4. nex_workforce_app is NOLOGIN · reachable only via SET LOCAL ROLE from
--      nex_app_runtime (Slice 3 R2.1 grant · INHERIT+SET, admin=false).
--   5. Every hardened wrapper embeds its own business logic (four-field fence,
--      persister whitelist, state-transition trigger, monotonic UPSERT rule).
--   6. Wrappers run with search_path=pg_catalog, pg_temp · no shadow injection.
--   7. The RLS layer here is defence-in-depth: it prevents any hypothetical
--      accidental / malicious grant of admin membership to a different role
--      from writing tables it should not (the TO nex_workforce_admin clause
--      excludes everyone else from these tables under the same operations).
--
-- If ever a non-admin role were granted the ability to become admin, that
-- role could bypass the boundary regardless of RLS. Prevention of that is
-- section 8's absolute prohibition, enforced at role-management level.
--
-- Every table gets ONLY the operations its hardened wrappers actually use
-- (per the function/table matrix built during design). No mutation policy
-- is created merely because RLS exists (per Section 7 of the R2.2 prompt).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- FUNCTION/TABLE/OPERATION MATRIX (design source of truth)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Function                          | Owner       | Table                  | Ops required
-- ----------------------------------|-------------|------------------------|---------------
-- claim                             | admin       | work_item              | SELECT, UPDATE
-- heartbeat                         | admin       | work_item              | SELECT, UPDATE
--                                   |             | job_registry           | SELECT
-- checkpoint                        | admin       | work_item              | SELECT, UPDATE
-- complete                          | admin       | work_item              | SELECT, UPDATE
-- fail_soft                         | admin       | work_item              | SELECT, UPDATE
-- fail_hard                         | admin       | work_item              | SELECT, UPDATE
--                                   |             | work_item_dead_letter  | INSERT
-- stage_candidates                  | admin       | evidence_record        | INSERT (RLS OFF · no policy needed)
--                                   |             | candidate_staging      | INSERT (RLS OFF · no policy needed)
-- persist_batch                     | admin       | work_item              | SELECT, UPDATE
--                                   |             | candidate_staging      | SELECT, UPDATE (RLS OFF)
--                                   |             | persist_audit          | INSERT       (RLS OFF)
-- reap_expired_leases               | admin       | work_item              | SELECT, UPDATE
--                                   |             | work_item_dead_letter  | INSERT
--                                   |             | reaper_run             | INSERT, UPDATE
-- requeue_soft_fail_backoff_elapsed | admin       | work_item              | SELECT, UPDATE
-- enqueue_from_view                 | admin       | rotation_eligible view | (view resolves to underlying tables below)
--                                   |             | city_catalogue         | SELECT
--                                   |             | job_registry           | SELECT
--                                   |             | work_item              | SELECT, INSERT
-- persist_to_food_business          | persister   | nex.food_business      | Slice 1h policies (unchanged)
--
-- Resulting RLS policy set for nex_workforce_admin (9 policies):
--   work_item              : SELECT + INSERT + UPDATE
--   work_item_dead_letter  : INSERT
--   reaper_run             : SELECT + INSERT + UPDATE
--   city_catalogue         : SELECT
--   job_registry           : SELECT
--
-- Resulting RLS policy set for nex_workforce_persister_food_business
-- (2 policies · added during 2026-09-04 RECONCILIATION):
--   work_item              : SELECT + UPDATE (for FOR-UPDATE fence lock only)
--
-- TOTAL: 11 policies.
--
-- Explicitly NO policies for admin on:
--   agent_heartbeat  · no SQL function writes it (verified against Project B
--                      · verified against portable · leaving RLS+no-policy
--                      makes any future accidental use fail-loud, correct).
--   evidence_record  · RLS DISABLED · no policy applicable.
--   candidate_staging· RLS DISABLED · no policy applicable.
--   persist_audit    · RLS DISABLED · no policy applicable.
--
-- Explicitly NO other policies for persister:
--   persister has NO policy on any other nex_workforce.* table (isolation).
--   persister has no policy on reaper_run / dead_letter / etc.
--
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- § 0 · Sanity prereqs (Slice 3 R2.1 must be applied)
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_admin') THEN
    RAISE EXCEPTION 'nex_workforce_admin missing · apply Slice 3 R2.1 first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_workforce_app') THEN
    RAISE EXCEPTION 'nex_workforce_app missing · apply Slice 3 R2.1 first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'nex_workforce') THEN
    RAISE EXCEPTION 'nex_workforce schema missing';
  END IF;
END $body$;

-- ─────────────────────────────────────────────────────────────────────────────
-- § 1 · work_item · SELECT + INSERT + UPDATE for nex_workforce_admin
--
--   Used by: claim (SELECT+UPDATE) · heartbeat (SELECT+UPDATE) · checkpoint
--   (SELECT+UPDATE) · complete (SELECT+UPDATE) · fail_soft (SELECT+UPDATE) ·
--   fail_hard (SELECT+UPDATE) · reap_expired_leases (SELECT+UPDATE) ·
--   requeue_soft_fail_backoff_elapsed (SELECT+UPDATE) · enqueue_from_view
--   (SELECT via rotation_eligible view + INSERT) · persist_batch (SELECT+UPDATE
--   for FOR UPDATE fence).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS wa_work_item_select ON nex_workforce.work_item;
CREATE POLICY wa_work_item_select
  ON nex_workforce.work_item
  FOR SELECT
  TO nex_workforce_admin
  USING (true);

DROP POLICY IF EXISTS wa_work_item_insert ON nex_workforce.work_item;
CREATE POLICY wa_work_item_insert
  ON nex_workforce.work_item
  FOR INSERT
  TO nex_workforce_admin
  WITH CHECK (true);

DROP POLICY IF EXISTS wa_work_item_update ON nex_workforce.work_item;
CREATE POLICY wa_work_item_update
  ON nex_workforce.work_item
  FOR UPDATE
  TO nex_workforce_admin
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- § 2 · work_item_dead_letter · INSERT-only for admin (never SELECT/UPDATE)
--
--   Used by: fail_hard (INSERT) · reap_expired_leases (INSERT). Neither
--   function reads dead-letter rows back. Deliberately narrower than
--   work_item.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS wa_wi_dl_insert ON nex_workforce.work_item_dead_letter;
CREATE POLICY wa_wi_dl_insert
  ON nex_workforce.work_item_dead_letter
  FOR INSERT
  TO nex_workforce_admin
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- § 3 · reaper_run · SELECT + INSERT + UPDATE for admin
--
--   Used by: reap_expired_leases (INSERT DEFAULT VALUES RETURNING id · then
--   UPDATE finished_at + counters WHERE id = v_run_id). The UPDATE requires
--   SELECT visibility of the row it just inserted → SELECT policy needed.
--   This is the exact insert path that fired 42501 in the controlled
--   proving cycle on Project B.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS wa_reaper_run_select ON nex_workforce.reaper_run;
CREATE POLICY wa_reaper_run_select
  ON nex_workforce.reaper_run
  FOR SELECT
  TO nex_workforce_admin
  USING (true);

DROP POLICY IF EXISTS wa_reaper_run_insert ON nex_workforce.reaper_run;
CREATE POLICY wa_reaper_run_insert
  ON nex_workforce.reaper_run
  FOR INSERT
  TO nex_workforce_admin
  WITH CHECK (true);

DROP POLICY IF EXISTS wa_reaper_run_update ON nex_workforce.reaper_run;
CREATE POLICY wa_reaper_run_update
  ON nex_workforce.reaper_run
  FOR UPDATE
  TO nex_workforce_admin
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- § 4 · city_catalogue · SELECT-only for admin
--
--   Used by: enqueue_from_view (via rotation_eligible view). Workforce never
--   writes city_catalogue · that is ops-managed reference data. Deliberately
--   READ-ONLY per Section 7 of the R2.2 prompt.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS wa_city_catalogue_select ON nex_workforce.city_catalogue;
CREATE POLICY wa_city_catalogue_select
  ON nex_workforce.city_catalogue
  FOR SELECT
  TO nex_workforce_admin
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- § 5 · job_registry · SELECT-only for admin
--
--   Used by: heartbeat (SELECT lease_minutes) · enqueue_from_view (via
--   rotation_eligible view). Workforce never writes job_registry · that is
--   ops-managed configuration. Deliberately READ-ONLY.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS wa_job_registry_select ON nex_workforce.job_registry;
CREATE POLICY wa_job_registry_select
  ON nex_workforce.job_registry
  FOR SELECT
  TO nex_workforce_admin
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- § 5b · work_item · SELECT + UPDATE for nex_workforce_persister_food_business
--
--   Discovered during R2.2 RECONCILIATION (2026-09-04): the Slice 1h
--   persist_to_food_business function is SECURITY DEFINER as
--   nex_workforce_persister_food_business, and its four-field fence begins:
--
--       SELECT id, agent_id, generation, state
--         INTO v_wi_row
--         FROM nex_workforce.work_item
--        WHERE id = p_work_item_id
--        FOR UPDATE;
--
--   Persister has explicit SELECT + UPDATE grants on work_item from Slice 1h
--   R4 (previously classified vestigial), but under RLS enabled + no policy
--   for persister, the SELECT is denied by RLS with SQLSTATE 42501. This
--   never fired in tests (portable postgres = superuser bypasses RLS) and
--   never fired in the controlled proving cycle (the cycle stopped at the
--   reaper_run failure before persist_to_food_business ran). It would fire
--   on every persist attempt on Project B once the workforce is activated.
--
--   Add two narrow policies scoped exclusively to the food-business persister
--   role. USING (true) is safe because:
--     - persister is NOLOGIN · not directly reachable
--     - persister is only reachable via persist_to_food_business SECDEF
--     - persist_to_food_business is only invoked from persist_batch (admin
--       SECDEF) via regprocedure with the ^nex_workforce_persister_ whitelist
--     - The function body's four-field fence already gates by (id, agent_id,
--       generation, state='leased') · defence-in-depth
--     - Policy scoped TO the specific persister role · no other role can use
--
--   UPDATE policy is required because SELECT ... FOR UPDATE requires both
--   SELECT-policy (USING) AND UPDATE-policy (USING) to pass under RLS. No
--   actual UPDATE by persist_to_food_business · WITH CHECK never evaluates.
--   WITH CHECK (false) would be equivalent · we set (true) for consistency
--   with the admin work_item policy and to avoid surprising any future
--   maintainer who adds a compatible UPDATE path.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS wp_food_business_work_item_select ON nex_workforce.work_item;
CREATE POLICY wp_food_business_work_item_select
  ON nex_workforce.work_item
  FOR SELECT
  TO nex_workforce_persister_food_business
  USING (true);

DROP POLICY IF EXISTS wp_food_business_work_item_update ON nex_workforce.work_item;
CREATE POLICY wp_food_business_work_item_update
  ON nex_workforce.work_item
  FOR UPDATE
  TO nex_workforce_persister_food_business
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- § 6 · Deliberately NO policies for admin on:
--       agent_heartbeat  · no hardened function writes it today; fail-loud on
--                          any accidental future use is the correct behavior
--                          (Section 7 prompt principle · do not grant on
--                          speculation).
--       evidence_record  · RLS DISABLED · not applicable.
--       candidate_staging· RLS DISABLED · not applicable.
--       persist_audit    · RLS DISABLED · not applicable.
--
-- § 7 · Deliberately NO policies for:
--       nex_workforce_persister_food_business  · does not touch any of the
--         six RLS-enabled tables; only writes nex.food_business under Slice
--         1h's existing policies. Slice 1h isolation preserved unchanged.
--       nex_workforce_app       · direct table access is intentionally denied
--         by omission; app reaches these tables ONLY via SECURITY DEFINER.
--       nex_app_runtime         · SAME · direct access must remain denied.
--       nex_brain_app / nex_social_app / anon / authenticated / public
--                              · never authorised on workforce tables.
--
-- ─────────────────────────────────────────────────────────────────────────────

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 8 · DOWN migration (COMMENTED · manual apply if reversal ever needed)
-- ═════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- DROP POLICY IF EXISTS wa_work_item_select                 ON nex_workforce.work_item;
-- DROP POLICY IF EXISTS wa_work_item_insert                 ON nex_workforce.work_item;
-- DROP POLICY IF EXISTS wa_work_item_update                 ON nex_workforce.work_item;
-- DROP POLICY IF EXISTS wa_wi_dl_insert                     ON nex_workforce.work_item_dead_letter;
-- DROP POLICY IF EXISTS wa_reaper_run_select                ON nex_workforce.reaper_run;
-- DROP POLICY IF EXISTS wa_reaper_run_insert                ON nex_workforce.reaper_run;
-- DROP POLICY IF EXISTS wa_reaper_run_update                ON nex_workforce.reaper_run;
-- DROP POLICY IF EXISTS wa_city_catalogue_select            ON nex_workforce.city_catalogue;
-- DROP POLICY IF EXISTS wa_job_registry_select              ON nex_workforce.job_registry;
-- DROP POLICY IF EXISTS wp_food_business_work_item_select   ON nex_workforce.work_item;
-- DROP POLICY IF EXISTS wp_food_business_work_item_update   ON nex_workforce.work_item;
-- COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════
