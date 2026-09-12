-- ═════════════════════════════════════════════════════════════════════════════
-- SLICE 3 R2.1 · POST-APPLY READ-ONLY VERIFICATION CHECKLIST (A–T)
-- ═════════════════════════════════════════════════════════════════════════════
-- Purpose: to be executed ONLY after "APPLY SLICE 3 R2.1 TO PROJECT B" has been
-- explicitly authorized and executed. Every statement below is SELECT-only.
-- Zero DDL. Zero DML. Zero ALTER. No side-effects.
--
-- Execution model:
--   - Run each labelled block against Project B via the Supabase Management API
--     `/database/query` endpoint (same pattern as apply-slice1h-r4.mjs).
--   - Compare each result to the "expected" column below.
--   - Any single "expected" mismatch is a HARD STOP — investigate before
--     proceeding to Gate 3 (workforce app role grant).
--
-- Coverage is A through T · exactly the properties enumerated in the
-- FINAL PRODUCTION APPLY PREPARATION gate.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- IDENTITY · confirm we are talking to Project B PG 17.6
-- ─────────────────────────────────────────────────────────────────────────────
SELECT current_database() AS db, current_setting('server_version') AS pg_version, current_user AS usr;
-- expected: db=postgres · pg=17.x · usr=postgres

-- ─────────────────────────────────────────────────────────────────────────────
-- A + B · nex_workforce_admin AND nex_workforce_app both exist
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_admin') AS admin_role_exists,
  (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_app')   AS app_role_exists;
-- expected: admin_role_exists=1 · app_role_exists=1

-- ─────────────────────────────────────────────────────────────────────────────
-- C + D · admin/app role attributes match Slice 3 design
--   NOLOGIN · NOBYPASSRLS · rolsuper=false · CREATEROLE=false · CREATEDB=false
--   rolinherit=true (default · irrelevant since NOLOGIN)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolinherit
FROM pg_roles
WHERE rolname IN ('nex_workforce_admin','nex_workforce_app')
ORDER BY rolname;
-- expected:
--   nex_workforce_admin | f | f | f | f | f | t
--   nex_workforce_app   | f | f | f | f | f | t

-- ─────────────────────────────────────────────────────────────────────────────
-- E + F · admin owns 11 hardened SECURITY DEFINER wrappers with hardened search_path
-- ─────────────────────────────────────────────────────────────────────────────
SELECT p.proname,
       r.rolname                AS owner,
       p.prosecdef              AS security_definer,
       array_to_string(p.proconfig, ',') AS proconfig
FROM pg_proc p
JOIN pg_roles r     ON r.oid = p.proowner
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'nex_workforce'
  AND p.proname IN ('claim','heartbeat','checkpoint','complete',
                    'fail_soft','fail_hard','stage_candidates','persist_batch',
                    'reap_expired_leases','requeue_soft_fail_backoff_elapsed',
                    'enqueue_from_view')
ORDER BY p.proname;
-- expected: 11 rows, every row:
--   owner              = nex_workforce_admin
--   security_definer   = t
--   proconfig contains "search_path=pg_catalog, pg_temp"

-- Summary rollup (should be 11):
SELECT count(*)::int AS hardened_matching_all_three
FROM pg_proc p
JOIN pg_roles r     ON r.oid = p.proowner
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'nex_workforce'
  AND p.proname IN ('claim','heartbeat','checkpoint','complete',
                    'fail_soft','fail_hard','stage_candidates','persist_batch',
                    'reap_expired_leases','requeue_soft_fail_backoff_elapsed',
                    'enqueue_from_view')
  AND r.rolname = 'nex_workforce_admin'
  AND p.prosecdef = true
  AND EXISTS (SELECT 1 FROM unnest(p.proconfig) s WHERE s = 'search_path=pg_catalog, pg_temp');
-- expected: 11

-- ─────────────────────────────────────────────────────────────────────────────
-- G · PUBLIC has zero EXECUTE on all 11 hardened wrappers
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*)::int AS public_execute_on_hardened
FROM (
  SELECT p.proname, (aclexplode(p.proacl)).*
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'nex_workforce'
    AND p.proname IN ('claim','heartbeat','checkpoint','complete',
                      'fail_soft','fail_hard','stage_candidates','persist_batch',
                      'reap_expired_leases','requeue_soft_fail_backoff_elapsed',
                      'enqueue_from_view')
) t
WHERE t.grantee = 0 AND t.privilege_type = 'EXECUTE';
-- expected: 0

-- ─────────────────────────────────────────────────────────────────────────────
-- H · admin has CREATE=false on nex_workforce (§ 6c fix operative)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  has_schema_privilege('nex_workforce_admin', 'nex_workforce', 'USAGE')  AS admin_usage,
  has_schema_privilege('nex_workforce_admin', 'nex_workforce', 'CREATE') AS admin_create;
-- expected: admin_usage=true · admin_create=false

-- ─────────────────────────────────────────────────────────────────────────────
-- I · nex_workforce_app has ZERO direct INSERT/UPDATE/DELETE on nex.* + nex_workforce.*
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*)::int AS app_direct_writes
FROM information_schema.role_table_grants
WHERE grantee = 'nex_workforce_app'
  AND privilege_type IN ('INSERT','UPDATE','DELETE')
  AND table_schema IN ('nex','nex_workforce');
-- expected: 0

-- Enumerate the SELECT grants app has (for evidence) · should be nex_workforce.* only
SELECT table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'nex_workforce_app'
  AND privilege_type = 'SELECT'
ORDER BY table_schema, table_name;
-- expected: SELECT on the workforce observability tables only
--   (work_item, evidence_record, candidate_staging, persist_audit,
--    agent_heartbeat, reaper_run, work_item_dead_letter, city_catalogue,
--    job_registry) · plus the rotation_eligible view

-- ─────────────────────────────────────────────────────────────────────────────
-- J · nex_workforce_app has EXECUTE on exactly the 12 approved functions
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*)::int AS app_execute_grants
FROM information_schema.role_routine_grants
WHERE grantee = 'nex_workforce_app'
  AND privilege_type = 'EXECUTE'
  AND routine_schema = 'nex_workforce'
  AND routine_name IN ('claim','heartbeat','checkpoint','complete',
                       'fail_soft','fail_hard','stage_candidates','persist_batch',
                       'reap_expired_leases','requeue_soft_fail_backoff_elapsed',
                       'enqueue_from_view','persist_to_food_business');
-- expected: 12

-- Confirm no EXTRA EXECUTE grants exist for app on nex_workforce
SELECT routine_name
FROM information_schema.role_routine_grants
WHERE grantee = 'nex_workforce_app'
  AND privilege_type = 'EXECUTE'
  AND routine_schema = 'nex_workforce'
  AND routine_name NOT IN ('claim','heartbeat','checkpoint','complete',
                           'fail_soft','fail_hard','stage_candidates','persist_batch',
                           'reap_expired_leases','requeue_soft_fail_backoff_elapsed',
                           'enqueue_from_view','persist_to_food_business')
ORDER BY routine_name;
-- expected: 0 rows

-- ─────────────────────────────────────────────────────────────────────────────
-- K · admin has ZERO inbound memberships (never inherits another role)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*)::int AS admin_inbound_memberships
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.roleid
JOIN pg_roles m ON m.oid = am.member
WHERE m.rolname = 'nex_workforce_admin';
-- expected: 0

-- ─────────────────────────────────────────────────────────────────────────────
-- L · app is NOT a member of admin OR persister (structural separation)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT r.rolname AS parent_role
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.roleid
JOIN pg_roles m ON m.oid = am.member
WHERE m.rolname = 'nex_workforce_app'
  AND r.rolname IN ('nex_workforce_admin','nex_workforce_persister_food_business')
ORDER BY r.rolname;
-- expected: 0 rows

-- ─────────────────────────────────────────────────────────────────────────────
-- M · no dangerous memberships · admin has ONLY the intended executor (postgres)
--     as member · brain/social/anon/authenticated/app/runtime are NEVER admin members
-- ─────────────────────────────────────────────────────────────────────────────
SELECT m.rolname AS member, am.admin_option, am.inherit_option, am.set_option
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.roleid
JOIN pg_roles m ON m.oid = am.member
WHERE r.rolname = 'nex_workforce_admin'
ORDER BY m.rolname, am.admin_option DESC;
-- expected: only postgres appears (1 or 2 rows depending on PG 16+ dual-row semantics)
--   Any row for nex_workforce_app / nex_brain_app / nex_social_app / nex_app_runtime
--   / anon / authenticated is a HARD STOP.
--   Every postgres row MUST have inherit_option=false (INHERIT FALSE preserved).

SELECT bool_and(am.inherit_option = false) AS all_admin_members_inherit_false
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.roleid
WHERE r.rolname = 'nex_workforce_admin';
-- expected: true (no member of admin can silently inherit admin privileges)

-- ─────────────────────────────────────────────────────────────────────────────
-- N · brain/social permissions on nex.food_business unchanged
-- ─────────────────────────────────────────────────────────────────────────────
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='nex' AND table_name='food_business'
  AND grantee IN ('nex_brain_app','nex_social_app')
ORDER BY grantee, privilege_type;
-- expected (unchanged from pre-apply · verified 2026-09-04 READ-ONLY snapshot):
--   nex_brain_app  DELETE
--   nex_brain_app  INSERT
--   nex_brain_app  SELECT
--   nex_brain_app  UPDATE
--   nex_social_app DELETE
--   nex_social_app INSERT
--   nex_social_app SELECT
--   nex_social_app UPDATE

SELECT polname, roles.rolname AS role
FROM pg_policy pol
LEFT JOIN LATERAL (SELECT r.rolname FROM pg_roles r WHERE r.oid = ANY(pol.polroles)) roles ON true
WHERE polrelid = 'nex.food_business'::regclass
ORDER BY polname, roles.rolname;
-- expected (unchanged · matches 2026-09-04 snapshot):
--   food_business_brain_app_all      -> nex_brain_app
--   food_business_persister_insert   -> nex_workforce_persister_food_business
--   food_business_persister_select   -> nex_workforce_persister_food_business
--   food_business_persister_update   -> nex_workforce_persister_food_business
--   food_business_social_app_all     -> nex_social_app

-- ─────────────────────────────────────────────────────────────────────────────
-- O · Slice 1G objects and row counts unchanged
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*)::int FROM pg_tables
     WHERE schemaname='nex_workforce'
       AND tablename IN ('evidence_record','candidate_staging','persist_audit')) AS slice1g_tables,
  (SELECT count(*)::int FROM nex_workforce.evidence_record)   AS evidence_record_rows,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS candidate_staging_rows,
  (SELECT count(*)::int FROM nex_workforce.persist_audit)     AS persist_audit_rows;
-- expected (unchanged since 2026-09-04 snapshot · workforce not activated):
--   slice1g_tables=3 · evidence_record_rows=0 · candidate_staging_rows=0 · persist_audit_rows=0

-- ─────────────────────────────────────────────────────────────────────────────
-- P · Slice 1H R4 unchanged
--   (persister role attrs · food_business row count · food_business columns ·
--    RLS state · persister policies · persist_to_food_business ownership)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_role,
  (SELECT rolcanlogin FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_login,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_bypass_rls,
  (SELECT count(*)::int FROM nex.food_business) AS food_row_count,
  (SELECT count(*)::int FROM information_schema.columns
     WHERE table_schema='nex' AND table_name='food_business'
       AND column_name IN ('source_evidence_id','source_retrieved_at')) AS r4_columns,
  (SELECT relrowsecurity   FROM pg_class WHERE oid='nex.food_business'::regclass) AS food_rls_enabled,
  (SELECT relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS food_rls_forced,
  (SELECT r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
     JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business') AS persist_food_owner;
-- expected:
--   persister_role=1
--   persister_login=false
--   persister_bypass_rls=false
--   food_row_count=22750       (unchanged since Slice 1G+1H R4 apply · will grow only after workforce activation)
--   r4_columns=2
--   food_rls_enabled=true
--   food_rls_forced=false      (per Slice 1h R2 RF-3 doctrine · ENABLE not FORCE)
--   persist_food_owner='nex_workforce_persister_food_business'

-- ─────────────────────────────────────────────────────────────────────────────
-- Q · .env.local unchanged  (LOCAL-DISK check · not a SQL query)
-- ─────────────────────────────────────────────────────────────────────────────
-- Run on the operator's workstation (READ-ONLY):
--   powershell -c "(Get-Item .env.local).LastWriteTime"
-- expected: mtime unchanged from the pre-apply snapshot (Sep 03 07:41 as of 2026-09-04 review)
--
-- Also assert no workforce identifiers appear inside .env.local:
--   powershell -c "Select-String -Path .env.local -Pattern 'nex_workforce_admin|nex_workforce_app|withWorkforceRole' -SimpleMatch"
-- expected: no matches

-- ─────────────────────────────────────────────────────────────────────────────
-- R · no application cutover · runtime is NOT a member of nex_workforce_app
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*)::int AS runtime_is_member_of_app
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.roleid
JOIN pg_roles m ON m.oid = am.member
WHERE r.rolname = 'nex_workforce_app'
  AND m.rolname IN ('nex_app_runtime','anon','authenticated');
-- expected: 0  (Phase B GRANT app TO nex_app_runtime is a SEPARATE downstream gate)

-- No workforce identifiers in application source (LOCAL-DISK):
--   powershell -c "Get-ChildItem -Recurse src\ -Include *.ts,*.tsx | Select-String -Pattern 'nex_workforce_app|withWorkforceRole' -SimpleMatch"
-- expected: no matches

-- ─────────────────────────────────────────────────────────────────────────────
-- S · no workforce processes started · zero activity in workforce tables
--     since apply moment
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*)::int FROM nex_workforce.work_item)          AS work_item_rows,
  (SELECT count(*)::int FROM nex_workforce.agent_heartbeat)    AS heartbeat_rows,
  (SELECT count(*)::int FROM nex_workforce.reaper_run)         AS reaper_run_rows,
  (SELECT count(*)::int FROM nex_workforce.persist_audit)      AS persist_audit_rows;
-- expected: all 0 (no agent/reaper/orchestrator has been started)

-- Confirm zero active backends have SET ROLE'd to any workforce role right now:
SELECT count(*)::int AS workforce_role_sessions
FROM pg_stat_activity
WHERE current_setting('server_version_num')::int >= 140000
  AND application_name IS NOT NULL
  AND (usename IN ('nex_workforce_admin','nex_workforce_app','nex_workforce_persister_food_business')
       OR query ILIKE '%SET LOCAL ROLE nex_workforce_%');
-- expected: 0

-- ─────────────────────────────────────────────────────────────────────────────
-- T · Scheduled Task disabled  (WINDOWS · not a SQL query)
-- ─────────────────────────────────────────────────────────────────────────────
-- Run on the operator's workstation (READ-ONLY):
--   powershell -c "Get-ScheduledTask -TaskName 'NEX_Workforce*' -ErrorAction SilentlyContinue |
--                    Select-Object TaskName, State"
-- expected:
--   - either no matching task exists at all, OR
--   - every matching task State = Disabled

-- ═════════════════════════════════════════════════════════════════════════════
-- END OF POST-APPLY READ-ONLY CHECKLIST
-- Any deviation from an "expected" value is a HARD STOP.
-- Do NOT proceed to Gate 3 (workforce app role grant) until every item passes.
-- ═════════════════════════════════════════════════════════════════════════════
