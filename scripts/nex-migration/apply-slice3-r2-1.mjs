// Apply Slice 3 R2.1 to Project B via Supabase Management API.
// ============================================================================
// Governing authorization: Philip 2026-09-04 · "APPLY SLICE 3 R2.1 TO PROJECT B"
//
// AUTHORIZED SCOPE — ONLY:
//   Apply the exact staged migration at
//   supabase/migrations/_slice3_workforce_role_hardening.sql
//   with SHA-256 = dd349a7f893a80aa623d099a4e038fe5d3a405d0598f9169a130e8f6ea11d7be
//
// NOT AUTHORIZED (structurally impossible in this script):
//   GRANT nex_workforce_app TO nex_app_runtime · application cutover ·
//   agent/reaper/orchestrator start · Scheduled Task enable ·
//   .env.local mutation · Slice 1G/1H R4 mutation · brain/social mutation.
//
// Flow: preflight (READ-ONLY) → file integrity → atomic apply → postflight (READ-ONLY A-T) → HARD STOP.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];

const EXPECTED_SHA = "dd349a7f893a80aa623d099a4e038fe5d3a405d0598f9169a130e8f6ea11d7be";
const MIG_PATH = "supabase/migrations/_slice3_workforce_role_hardening.sql";

async function mgmt(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (r.status >= 400) throw new Error(`mgmt ${r.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

let pass = 0, fail = 0;
const failLines = [];
function T(label, ok, detail) {
  const glyph = ok ? "✓" : "❌";
  const line = `${glyph} ${label}${detail ? ` · ${detail}` : ""}`;
  console.log(line);
  if (ok) pass++; else { fail++; failLines.push(line); }
}
function hardStop(reason, code = 2) {
  console.log(`\n🔴 HARD STOP · ${reason}`);
  console.log(`Failures so far: ${fail}. Aborting without further action.`);
  writeReport(false);
  process.exit(code);
}
const report = { started_at: new Date().toISOString(), phases: {} };
function writeReport(finalOK) {
  try { mkdirSync("scripts/nex-migration/reports", { recursive: true }); } catch {}
  report.finished_at = new Date().toISOString();
  report.final_ok = finalOK;
  report.pass = pass; report.fail = fail;
  const path = `scripts/nex-migration/reports/slice3-r2-1-apply-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${path}`);
}

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(" NEX Slice 3 R2.1 · Project B APPLY (one production mutation only)");
console.log("═══════════════════════════════════════════════════════════════════════\n");

// ─── PRE-FLIGHT (READ-ONLY) ─────────────────────────────────────────────────
console.log("─── PRE-FLIGHT · READ-ONLY ───");
const targetId = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr`))[0];
console.log(`  target · db=${targetId.db} · pg=${targetId.ver} · user=${targetId.usr}`);
T("1 · target = Project B postgres · pg 17.x", targetId.db === "postgres" && /^17\./.test(targetId.ver));

const pre = (await mgmt(`
  SELECT
    (SELECT count(*)::int FROM pg_namespace WHERE nspname='nex_workforce') AS wf_schema,
    (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_admin') AS admin_role,
    (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_app') AS app_role,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname='enqueue_from_view') AS enqueue_fn,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard','stage_candidates','persist_batch','reap_expired_leases','requeue_soft_fail_backoff_elapsed') AND p.prosecdef=true) AS secdef_prior,
    (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_role,
    (SELECT count(*)::int FROM nex.food_business) AS food_rows,
    (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS dup_groups,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business') AS food_cols,
    (SELECT relrowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS rls,
    (SELECT relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS force_rls,
    (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
    (SELECT count(*)::int FROM nex_workforce.work_item) AS work_item_rows,
    (SELECT count(*)::int FROM nex_workforce.evidence_record) AS evidence_rows,
    (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS staging_rows,
    (SELECT count(*)::int FROM nex_workforce.persist_audit) AS audit_rows
`))[0];
T("2 · nex_workforce schema present + persister role present (post-R4)", pre.wf_schema === 1 && pre.persister_role === 1);
T("3 · Slice 3 objects ABSENT (admin=0 · app=0 · enqueue_fn=0 · secdef_prior=0)",
  pre.admin_role === 0 && pre.app_role === 0 && pre.enqueue_fn === 0 && pre.secdef_prior === 0,
  `admin=${pre.admin_role} app=${pre.app_role} enqueue=${pre.enqueue_fn} secdef=${pre.secdef_prior}`);
T("4 · food_business unchanged: 22,750 rows · 373 dup groups · RLS enabled not forced · 5 policies",
  pre.food_rows === 22750 && pre.dup_groups === 373 && pre.rls === true && pre.force_rls === false && pre.food_policies === 5,
  `rows=${pre.food_rows} dup=${pre.dup_groups} rls=${pre.rls} force=${pre.force_rls} policies=${pre.food_policies}`);
T("5 · workforce tables empty (work_item=0 · evidence=0 · staging=0 · audit=0)",
  pre.work_item_rows === 0 && pre.evidence_rows === 0 && pre.staging_rows === 0 && pre.audit_rows === 0,
  `wi=${pre.work_item_rows} ev=${pre.evidence_rows} stg=${pre.staging_rows} aud=${pre.audit_rows}`);

const preGrants = await mgmt(`
  SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
  WHERE table_schema='nex' AND table_name='food_business' AND grantee IN ('nex_brain_app','nex_social_app')
  GROUP BY grantee ORDER BY grantee`);
const preBrain  = preGrants.find((g) => g.grantee === "nex_brain_app");
const preSocial = preGrants.find((g) => g.grantee === "nex_social_app");
T("6 · brain/social CRUD intact pre-apply",
  preBrain?.privs === "DELETE,INSERT,SELECT,UPDATE" && preSocial?.privs === "DELETE,INSERT,SELECT,UPDATE",
  `brain=${preBrain?.privs} social=${preSocial?.privs}`);

// Local Scheduled Task
const psPre = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"],
  { encoding: "utf8" });
const preTaskState = (psPre.stdout || "").trim();
T("7 · local Scheduled Task disabled OR absent", preTaskState === "Disabled" || preTaskState === "", `state='${preTaskState}'`);

if (fail > 0) hardStop("Pre-flight expectation mismatch · not mutating Project B");
report.phases.preflight = { targetId, pre, preBrain: preBrain?.privs, preSocial: preSocial?.privs, preTaskState };
console.log("");

// ─── FILE INTEGRITY CHECK ───────────────────────────────────────────────────
console.log("─── FILE INTEGRITY ───");
const migSrc = readFileSync(MIG_PATH, "utf8");
const migSha = createHash("sha256").update(migSrc).digest("hex");
const migLines = (migSrc.match(/\n/g) || []).length;
console.log(`  ${migLines} lines · sha256=${migSha}`);
T("SHA-256 matches approved package",
  migSha === EXPECTED_SHA,
  migSha === EXPECTED_SHA ? "byte-identical to R2.1 doctrine" : `expected=${EXPECTED_SHA} actual=${migSha}`);
if (fail > 0) hardStop("File integrity mismatch · not mutating Project B");
report.phases.integrity = { sha: migSha, lines: migLines };
console.log("");

// ─── APPLY · single atomic TX · fail-closed timeouts ───────────────────────
console.log("─── APPLY · Slice 3 R2.1 (lock_timeout=5s · statement_timeout=60s · atomic) ───");
const wrapped = "SET lock_timeout = '5s';\nSET statement_timeout = '60s';\n" + migSrc;
try {
  const t0 = Date.now();
  await mgmt(wrapped);
  const dt = Date.now() - t0;
  T(`Slice 3 R2.1 committed successfully (${dt} ms)`, true);
  report.phases.apply = { ok: true, duration_ms: dt };
} catch (e) {
  const msg = e.message.split("\n")[0];
  T("Slice 3 R2.1 apply", false, msg);
  report.phases.apply = { ok: false, error: e.message };
  hardStop(`Slice 3 R2.1 failed · transaction rolled back atomically · 1G + 1H R4 unchanged · error: ${msg}`);
}
console.log("");

// ─── POST-FLIGHT · READ-ONLY · items A-T ─────────────────────────────────
console.log("─── POST-FLIGHT · READ-ONLY (A-T) ───");

// A + B · roles exist
const AB = (await mgmt(`SELECT
  (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_admin') AS admin,
  (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_app') AS app`))[0];
T("A + B · nex_workforce_admin AND nex_workforce_app exist", AB.admin === 1 && AB.app === 1, JSON.stringify(AB));

// C + D · attributes
const CD = await mgmt(`SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolinherit
  FROM pg_roles WHERE rolname IN ('nex_workforce_admin','nex_workforce_app') ORDER BY rolname`);
const adminAttrs = CD.find(r => r.rolname === 'nex_workforce_admin');
const appAttrs   = CD.find(r => r.rolname === 'nex_workforce_app');
const attrsOK = (a) => a && a.rolcanlogin === false && a.rolsuper === false && a.rolcreaterole === false && a.rolcreatedb === false && a.rolbypassrls === false && a.rolinherit === true;
T("C + D · admin attributes (NOLOGIN·NOSUPER·NOCREATEROLE·NOCREATEDB·NOBYPASSRLS·INHERIT=t)", attrsOK(adminAttrs), JSON.stringify(adminAttrs));
T("C + D · app attributes (NOLOGIN·NOSUPER·NOCREATEROLE·NOCREATEDB·NOBYPASSRLS·INHERIT=t)", attrsOK(appAttrs), JSON.stringify(appAttrs));

// E + F · 11 hardened wrappers owned by admin + SECDEF + hardened search_path
const EF = (await mgmt(`SELECT count(*)::int AS n FROM pg_proc p
  JOIN pg_roles r ON r.oid=p.proowner JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='nex_workforce'
    AND p.proname IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard',
      'stage_candidates','persist_batch','reap_expired_leases',
      'requeue_soft_fail_backoff_elapsed','enqueue_from_view')
    AND r.rolname='nex_workforce_admin' AND p.prosecdef=true
    AND EXISTS (SELECT 1 FROM unnest(p.proconfig) s WHERE s='search_path=pg_catalog, pg_temp')`))[0];
T("E + F · 11 hardened wrappers: admin-owned + SECDEF + hardened search_path", EF.n === 11, `n=${EF.n}`);

// G · zero PUBLIC EXECUTE
const G = (await mgmt(`SELECT count(*)::int AS n FROM (
  SELECT p.proname, (aclexplode(p.proacl)).* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='nex_workforce' AND p.proname IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard','stage_candidates','persist_batch','reap_expired_leases','requeue_soft_fail_backoff_elapsed','enqueue_from_view')
) t WHERE t.grantee=0 AND t.privilege_type='EXECUTE'`))[0];
T("G · zero PUBLIC EXECUTE on hardened wrappers", G.n === 0, `n=${G.n}`);

// H · admin USAGE=t · CREATE=f
const H = (await mgmt(`SELECT
  has_schema_privilege('nex_workforce_admin','nex_workforce','USAGE') AS u,
  has_schema_privilege('nex_workforce_admin','nex_workforce','CREATE') AS c`))[0];
T("H · admin CREATE revoked (USAGE=t · CREATE=f)", H.u === true && H.c === false, JSON.stringify(H));

// I · app zero direct writes
const I = (await mgmt(`SELECT count(*)::int AS n FROM information_schema.role_table_grants
  WHERE grantee='nex_workforce_app' AND privilege_type IN ('INSERT','UPDATE','DELETE') AND table_schema IN ('nex','nex_workforce')`))[0];
T("I · nex_workforce_app zero direct writes on nex.* + nex_workforce.*", I.n === 0, `n=${I.n}`);

// J · app EXECUTE on exactly 12 approved fns + zero extras
const Japproved = (await mgmt(`SELECT count(*)::int AS n FROM information_schema.role_routine_grants
  WHERE grantee='nex_workforce_app' AND privilege_type='EXECUTE' AND routine_schema='nex_workforce'
    AND routine_name IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard','stage_candidates','persist_batch','reap_expired_leases','requeue_soft_fail_backoff_elapsed','enqueue_from_view','persist_to_food_business')`))[0];
const Jextras = await mgmt(`SELECT routine_name FROM information_schema.role_routine_grants
  WHERE grantee='nex_workforce_app' AND privilege_type='EXECUTE' AND routine_schema='nex_workforce'
    AND routine_name NOT IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard','stage_candidates','persist_batch','reap_expired_leases','requeue_soft_fail_backoff_elapsed','enqueue_from_view','persist_to_food_business')`);
T("J · nex_workforce_app EXECUTE on exactly 12 approved functions", Japproved.n === 12, `n=${Japproved.n}`);
T("J · zero extra EXECUTE grants on nex_workforce", Jextras.length === 0, `extras=${JSON.stringify(Jextras)}`);

// K · admin inbound memberships = 0
const K = (await mgmt(`SELECT count(*)::int AS n FROM pg_auth_members am
  JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
  WHERE m.rolname='nex_workforce_admin'`))[0];
T("K · admin has zero inbound memberships", K.n === 0, `n=${K.n}`);

// L · app is NOT member of admin or persister
const L = await mgmt(`SELECT r.rolname AS parent FROM pg_auth_members am
  JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
  WHERE m.rolname='nex_workforce_app' AND r.rolname IN ('nex_workforce_admin','nex_workforce_persister_food_business')`);
T("L · app NOT a member of admin or persister", L.length === 0, `rows=${JSON.stringify(L)}`);

// M · admin outbound: only postgres member · all members INHERIT=false
const Mmembers = await mgmt(`SELECT m.rolname AS member, am.admin_option, am.inherit_option, am.set_option
  FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
  WHERE r.rolname='nex_workforce_admin' ORDER BY m.rolname, am.admin_option DESC`);
const badMembers = Mmembers.filter(m => !['postgres'].includes(m.member));
const allInheritFalse = Mmembers.every(m => m.inherit_option === false);
T("M · admin outbound: only postgres appears as member", badMembers.length === 0, `bad=${JSON.stringify(badMembers)}`);
T("M · every admin member has INHERIT=false (no runtime leak)", allInheritFalse, `members=${JSON.stringify(Mmembers)}`);

// N · brain/social permissions + policies unchanged
const Nperm = await mgmt(`SELECT grantee, string_agg(privilege_type,',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants WHERE table_schema='nex' AND table_name='food_business'
    AND grantee IN ('nex_brain_app','nex_social_app') GROUP BY grantee ORDER BY grantee`);
const postBrain = Nperm.find(g => g.grantee === 'nex_brain_app');
const postSocial = Nperm.find(g => g.grantee === 'nex_social_app');
T("N · brain/social CRUD unchanged post-apply",
  postBrain?.privs === "DELETE,INSERT,SELECT,UPDATE" && postSocial?.privs === "DELETE,INSERT,SELECT,UPDATE",
  `brain=${postBrain?.privs} social=${postSocial?.privs}`);
const Npolicies = await mgmt(`SELECT polname FROM pg_policy WHERE polrelid='nex.food_business'::regclass ORDER BY polname`);
const policyNames = Npolicies.map(p => p.polname).sort();
const expectedPolicies = ["food_business_brain_app_all","food_business_persister_insert","food_business_persister_select","food_business_persister_update","food_business_social_app_all"];
T("N · food_business policies unchanged (5 · brain + social + 3 persister)",
  policyNames.length === 5 && expectedPolicies.every(p => policyNames.includes(p)),
  `actual=${JSON.stringify(policyNames)}`);

// O · Slice 1G unchanged
const O = (await mgmt(`SELECT
  (SELECT count(*)::int FROM pg_tables WHERE schemaname='nex_workforce' AND tablename IN ('evidence_record','candidate_staging','persist_audit')) AS tables,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud`))[0];
T("O · Slice 1G unchanged (3 tables · all 0 rows)", O.tables === 3 && O.ev === 0 && O.stg === 0 && O.aud === 0, JSON.stringify(O));

// P · Slice 1H R4 unchanged
const P = (await mgmt(`SELECT
  (SELECT rolcanlogin FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS p_login,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS p_bypass,
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business' AND column_name IN ('source_evidence_id','source_retrieved_at')) AS r4_cols,
  (SELECT relrowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS rls,
  (SELECT relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS force_rls,
  (SELECT r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business') AS persist_owner,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS dup_groups`))[0];
T("P · Slice 1H R4 unchanged (persister NOLOGIN/NOBYPASSRLS · 22750 rows · 2 R4 cols · RLS enabled not forced · persist_to_food_business owner intact · 373 dup groups)",
  P.p_login === false && P.p_bypass === false && P.food_rows === 22750 && P.r4_cols === 2 && P.rls === true && P.force_rls === false && P.persist_owner === 'nex_workforce_persister_food_business' && P.dup_groups === 373,
  JSON.stringify(P));

// Q · .env.local unchanged (local file)
const psEnv = spawnSync("powershell", ["-NoProfile", "-Command",
  "$m=(Get-Item .env.local).LastWriteTime; $g=(Select-String -Path .env.local -Pattern 'nex_workforce_admin|nex_workforce_app|withWorkforceRole' -SimpleMatch); ('mtime=' + $m.ToString('o') + ' matches=' + ($g | Measure-Object).Count)"],
  { encoding: "utf8" });
const envInfo = (psEnv.stdout || "").trim();
const envMatch = envInfo.match(/mtime=(\S+)\s+matches=(\d+)/);
const envMtime = envMatch?.[1]; const envMatches = parseInt(envMatch?.[2] || "-1", 10);
// mtime should be pre-apply · matches must be 0
T("Q · .env.local no workforce identifiers", envMatches === 0, envInfo);
T("Q · .env.local mtime pre-apply (< now)", envMtime && new Date(envMtime) < new Date(report.started_at), `mtime=${envMtime}`);
report.phases.envInfo = envInfo;

// R · no application cutover · runtime NOT member of app · no workforce identifiers in src/
const R1 = (await mgmt(`SELECT count(*)::int AS n FROM pg_auth_members am
  JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
  WHERE r.rolname='nex_workforce_app' AND m.rolname IN ('nex_app_runtime','anon','authenticated')`))[0];
T("R · nex_workforce_app NOT granted to any runtime role", R1.n === 0, `n=${R1.n}`);
const grepR = spawnSync("powershell", ["-NoProfile", "-Command",
  "$c=Get-ChildItem -Recurse src -Include *.ts,*.tsx -ErrorAction SilentlyContinue | Select-String -Pattern 'nex_workforce_app|withWorkforceRole' -SimpleMatch; ($c | Measure-Object).Count"],
  { encoding: "utf8" });
const srcMatchCount = parseInt((grepR.stdout || "0").trim(), 10);
T("R · zero workforce identifiers in src/", srcMatchCount === 0, `matches=${srcMatchCount}`);

// S · workforce processes not started
const S = (await mgmt(`SELECT
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi,
  (SELECT count(*)::int FROM nex_workforce.agent_heartbeat) AS hb,
  (SELECT count(*)::int FROM nex_workforce.reaper_run) AS rr,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS pa`))[0];
T("S · workforce tables still empty (wi/hb/rr/pa = 0)", S.wi === 0 && S.hb === 0 && S.rr === 0 && S.pa === 0, JSON.stringify(S));
const activeWF = (await mgmt(`SELECT count(*)::int AS n FROM pg_stat_activity
  WHERE pid <> pg_backend_pid()
    AND (application_name ILIKE '%workforce%' OR application_name ILIKE '%nex-agent%'
      OR application_name ILIKE '%nex-reaper%' OR application_name ILIKE '%nex-orchestrator%'
      OR (state='active' AND (query ILIKE 'SELECT nex_workforce.claim%'
        OR query ILIKE 'SELECT nex_workforce.persist_batch%'
        OR query ILIKE 'SELECT nex_workforce.stage_candidates%')))`))[0];
T("S · no active workforce processes in pg_stat_activity", activeWF.n === 0, `n=${activeWF.n}`);

// T · Scheduled Task disabled/absent
const psT = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"],
  { encoding: "utf8" });
const postTaskState = (psT.stdout || "").trim();
T("T · local Scheduled Task remains Disabled OR absent",
  postTaskState === "Disabled" || postTaskState === "", `state='${postTaskState}'`);

report.phases.postflight = {
  AB, adminAttrs, appAttrs, EF: EF.n, G: G.n, H, I: I.n,
  Japproved: Japproved.n, Jextras, K: K.n, L, Mmembers, badMembers, allInheritFalse,
  Nperm, policies: policyNames, O, P, envInfo, srcMatchCount, S, activeWF: activeWF.n, postTaskState
};

console.log("");
console.log("═══════════════════════════════════════════════════════════════════════");
if (fail === 0) {
  console.log(`🟢 SLICE 3 R2.1 APPLIED + VERIFIED · ${pass} checks passed`);
  console.log("🔴 HARD STOP — DOWNSTREAM GATES REMAIN UNAUTHORIZED");
  console.log("═══════════════════════════════════════════════════════════════════════");
  writeReport(true);
  process.exit(0);
} else {
  console.log(`🔴 POST-FLIGHT FAILED · ${fail} failures · migration is committed but state does not match design`);
  for (const l of failLines) console.log("   " + l);
  console.log("═══════════════════════════════════════════════════════════════════════");
  writeReport(false);
  process.exit(3);
}
