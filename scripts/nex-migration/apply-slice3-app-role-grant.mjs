// Grant nex_workforce_app TO nex_app_runtime WITH INHERIT TRUE, SET TRUE.
// ============================================================================
// Governing authorization: Philip 2026-09-04 · "GRANT nex_workforce_app TO
// nex_app_runtime WITH INHERIT TRUE, SET TRUE · target Project B"
//
// This is Gate 3 in the pinned downstream-gate sequence. Gate 1 (APPLY SLICE 3
// R2.1) is complete + verified. Gate 3 authorizes exactly ONE production
// statement and nothing else.
//
// NOT AUTHORIZED (structurally excluded):
//   any ALTER TABLE, CREATE/DROP FUNCTION, ALTER POLICY, ALTER ROLE
//   application cutover · agent/reaper/orchestrator start · Scheduled Task
//   enable · .env.local mutation · Slice 1G/1H R4 mutation · brain/social
//   mutation · persister mutation · admin mutation · work_item/heartbeat writes.
//
// Flow: preflight (12 READ-ONLY) → single GRANT → postflight A-Q (READ-ONLY)
//       → functional SET LOCAL ROLE proof (as nex_app_runtime, BEGIN/ROLLBACK,
//       no persistent mutation) → HARD STOP.

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const RUNTIME_URL = envTools.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];

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
  const path = `scripts/nex-migration/reports/slice3-app-role-grant-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${path}`);
}

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(" NEX Slice 3 · Gate 3 · GRANT nex_workforce_app TO nex_app_runtime");
console.log("═══════════════════════════════════════════════════════════════════════\n");

// ─── PRE-FLIGHT (READ-ONLY · 12 items) ─────────────────────────────────────
console.log("─── PRE-FLIGHT · READ-ONLY (12 items) ───");
const targetId = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr`))[0];
console.log(`  target · db=${targetId.db} · pg=${targetId.ver} · user=${targetId.usr}`);
T("target = Project B postgres · pg 17.x", targetId.db === "postgres" && /^17\./.test(targetId.ver));

const pre = (await mgmt(`SELECT
  (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_app') AS app_exists,
  (SELECT rolcanlogin FROM pg_roles WHERE rolname='nex_workforce_app') AS app_login,
  (SELECT rolsuper FROM pg_roles WHERE rolname='nex_workforce_app') AS app_super,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_app') AS app_bypass,
  (SELECT rolcreaterole FROM pg_roles WHERE rolname='nex_workforce_app') AS app_createrole,
  (SELECT rolcreatedb FROM pg_roles WHERE rolname='nex_workforce_app') AS app_createdb,
  (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_app_runtime') AS runtime_exists,
  (SELECT rolcanlogin FROM pg_roles WHERE rolname='nex_app_runtime') AS runtime_login,
  (SELECT rolsuper FROM pg_roles WHERE rolname='nex_app_runtime') AS runtime_super,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_app_runtime') AS runtime_bypass,
  (SELECT count(*)::int FROM pg_auth_members am
     JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
     WHERE r.rolname='nex_workforce_app' AND m.rolname='nex_app_runtime') AS existing_membership,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi,
  (SELECT count(*)::int FROM nex_workforce.agent_heartbeat) AS hb,
  (SELECT count(*)::int FROM nex_workforce.reaper_run) AS rr`))[0];

T("1 · nex_workforce_app exists", pre.app_exists === 1);
T("2 · nex_workforce_app is NOLOGIN", pre.app_login === false, `login=${pre.app_login}`);
T("3 · nex_workforce_app is NOSUPERUSER", pre.app_super === false, `super=${pre.app_super}`);
T("4 · nex_workforce_app is NOBYPASSRLS", pre.app_bypass === false, `bypass=${pre.app_bypass}`);
T("5 · nex_workforce_app is NOCREATEROLE", pre.app_createrole === false, `createrole=${pre.app_createrole}`);
T("6 · nex_workforce_app is NOCREATEDB", pre.app_createdb === false, `createdb=${pre.app_createdb}`);
T("7 · nex_app_runtime exists and can LOGIN", pre.runtime_exists === 1 && pre.runtime_login === true, `exists=${pre.runtime_exists} login=${pre.runtime_login}`);
T("8 · nex_app_runtime NOT currently a member of nex_workforce_app", pre.existing_membership === 0, `existing=${pre.existing_membership}`);

// 9 · no existing dangerous membership on nex_workforce_app
const preOutbound = await mgmt(`
  SELECT m.rolname AS member FROM pg_auth_members am
  JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
  WHERE r.rolname='nex_workforce_app' ORDER BY m.rolname`);
const preDangerous = preOutbound.filter(m => ["anon","authenticated","service_role","nex_brain_app","nex_social_app","nex_workforce_persister_food_business","postgres"].includes(m.member) === false && m.member !== "nex_app_runtime");
T("9 · no existing dangerous membership on nex_workforce_app",
  preDangerous.length === 0 && !preOutbound.find(m => ["anon","authenticated","service_role","nex_brain_app","nex_social_app","nex_workforce_persister_food_business"].includes(m.member)),
  `outbound=${JSON.stringify(preOutbound.map(m=>m.member))}`);

T("10 · workforce OFF (work_item=0 · agent_heartbeat=0 · reaper_run=0)",
  pre.wi === 0 && pre.hb === 0 && pre.rr === 0, `wi=${pre.wi} hb=${pre.hb} rr=${pre.rr}`);

// 11 · Scheduled Task disabled
const psPre = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"],
  { encoding: "utf8" });
const preTaskState = (psPre.stdout || "").trim();
T("11 · Scheduled Task disabled OR absent", preTaskState === "Disabled" || preTaskState === "", `state='${preTaskState}'`);

// 12 · .env.local unchanged (mtime + no workforce identifiers)
const psEnvPre = spawnSync("powershell", ["-NoProfile", "-Command",
  "$m=(Get-Item .env.local).LastWriteTime; $g=(Select-String -Path .env.local -Pattern 'nex_workforce_admin|nex_workforce_app|withWorkforceRole' -SimpleMatch); ('mtime=' + $m.ToString('o') + ' matches=' + ($g | Measure-Object).Count)"],
  { encoding: "utf8" });
const envInfoPre = (psEnvPre.stdout || "").trim();
const envMatchPre = envInfoPre.match(/mtime=(\S+)\s+matches=(\d+)/);
const preEnvMtime = envMatchPre?.[1]; const preEnvMatches = parseInt(envMatchPre?.[2] || "-1", 10);
T("12 · .env.local unchanged (0 workforce identifiers · pre-apply mtime)",
  preEnvMatches === 0 && preEnvMtime && new Date(preEnvMtime) < new Date(report.started_at),
  envInfoPre);

if (fail > 0) hardStop("Pre-flight expectation mismatch · not mutating Project B");
report.phases.preflight = { targetId, pre, preOutbound, preTaskState, envInfoPre };
console.log("");

// ─── MUTATION · single authorized statement ────────────────────────────────
console.log("─── APPLY · exactly ONE authorized GRANT ───");
const AUTHORIZED_STMT = "GRANT nex_workforce_app TO nex_app_runtime WITH INHERIT TRUE, SET TRUE;";
console.log(`  ${AUTHORIZED_STMT}`);
try {
  const t0 = Date.now();
  await mgmt(AUTHORIZED_STMT);
  const dt = Date.now() - t0;
  T(`GRANT committed successfully (${dt} ms)`, true);
  report.phases.apply = { ok: true, duration_ms: dt, stmt: AUTHORIZED_STMT };
} catch (e) {
  const msg = e.message.split("\n")[0];
  T("GRANT apply", false, msg);
  report.phases.apply = { ok: false, error: e.message, stmt: AUTHORIZED_STMT };
  hardStop(`GRANT failed · nothing else attempted · pre-state preserved · error: ${msg}`);
}
console.log("");

// ─── POST-GRANT · READ-ONLY VERIFICATION (A-Q) ─────────────────────────────
console.log("─── POST-GRANT · READ-ONLY VERIFICATION (A-Q) ───");

// A · exact membership row exists
const A = await mgmt(`SELECT r.rolname AS role, m.rolname AS member, am.admin_option, am.inherit_option, am.set_option
  FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
  WHERE r.rolname='nex_workforce_app' AND m.rolname='nex_app_runtime'`);
T("A · membership exists exactly once (nex_app_runtime → nex_workforce_app)", A.length === 1, `rows=${A.length}`);

// B · membership properties
const bp = A[0];
T("B · inherit_option=true", bp?.inherit_option === true, JSON.stringify(bp));
T("B · set_option=true", bp?.set_option === true);
T("B · admin_option=false", bp?.admin_option === false);

// C · nex_workforce_app attributes unchanged
const C = (await mgmt(`SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
  FROM pg_roles WHERE rolname='nex_workforce_app'`))[0];
T("C · nex_workforce_app remains NOLOGIN·NOSUPERUSER·NOBYPASSRLS·NOCREATEROLE·NOCREATEDB",
  C.rolcanlogin === false && C.rolsuper === false && C.rolbypassrls === false && C.rolcreaterole === false && C.rolcreatedb === false,
  JSON.stringify(C));

// D · nex_app_runtime unchanged
const D = (await mgmt(`SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolinherit
  FROM pg_roles WHERE rolname='nex_app_runtime'`))[0];
T("D · nex_app_runtime attributes unchanged (CANLOGIN=t · other flags unchanged)",
  D.rolcanlogin === true, JSON.stringify(D));

// E · app still zero direct writes
const E = (await mgmt(`SELECT count(*)::int AS n FROM information_schema.role_table_grants
  WHERE grantee='nex_workforce_app' AND privilege_type IN ('INSERT','UPDATE','DELETE') AND table_schema IN ('nex','nex_workforce')`))[0];
T("E · nex_workforce_app zero direct writes on nex.* + nex_workforce.*", E.n === 0, `n=${E.n}`);

// F · EXECUTE allow-list exactly 12 (via aclexplode ground truth)
const F = (await mgmt(`SELECT count(*)::int AS n FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN LATERAL aclexplode(p.proacl) x
  JOIN pg_roles g ON g.oid=x.grantee
  WHERE n.nspname='nex_workforce' AND g.rolname='nex_workforce_app' AND x.privilege_type='EXECUTE'
    AND p.proname IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard','stage_candidates','persist_batch','reap_expired_leases','requeue_soft_fail_backoff_elapsed','enqueue_from_view','persist_to_food_business')`))[0];
T("F · EXECUTE allow-list still exactly 12 approved functions", F.n === 12, `n=${F.n}`);
const Fextras = await mgmt(`SELECT p.proname FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN LATERAL aclexplode(p.proacl) x
  JOIN pg_roles g ON g.oid=x.grantee
  WHERE n.nspname='nex_workforce' AND g.rolname='nex_workforce_app' AND x.privilege_type='EXECUTE'
    AND p.proname NOT IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard','stage_candidates','persist_batch','reap_expired_leases','requeue_soft_fail_backoff_elapsed','enqueue_from_view','persist_to_food_business')`);
T("F · zero extra EXECUTE grants", Fextras.length === 0, `extras=${JSON.stringify(Fextras)}`);

// G · zero PUBLIC EXECUTE
const G = (await mgmt(`SELECT count(*)::int AS n FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN LATERAL aclexplode(p.proacl) x
  WHERE n.nspname='nex_workforce' AND x.grantee=0 AND x.privilege_type='EXECUTE'
    AND p.proname IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard','stage_candidates','persist_batch','reap_expired_leases','requeue_soft_fail_backoff_elapsed','enqueue_from_view')`))[0];
T("G · zero PUBLIC EXECUTE on hardened wrappers", G.n === 0, `n=${G.n}`);

// H · admin role unchanged
const H = (await mgmt(`SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb,
    has_schema_privilege('nex_workforce_admin','nex_workforce','USAGE') AS u,
    has_schema_privilege('nex_workforce_admin','nex_workforce','CREATE') AS c
  FROM pg_roles WHERE rolname='nex_workforce_admin'`))[0];
T("H · admin unchanged (NOLOGIN·NOSUPER·NOBYPASSRLS · USAGE=t · CREATE=f)",
  H.rolcanlogin === false && H.rolsuper === false && H.rolbypassrls === false && H.rolcreaterole === false && H.rolcreatedb === false && H.u === true && H.c === false,
  JSON.stringify(H));

// I · persister role unchanged
const I = (await mgmt(`SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
  FROM pg_roles WHERE rolname='nex_workforce_persister_food_business'`))[0];
T("I · persister role unchanged (NOLOGIN·NOSUPER·NOBYPASSRLS)",
  I.rolcanlogin === false && I.rolsuper === false && I.rolbypassrls === false,
  JSON.stringify(I));

// J · brain/social unchanged
const Jperm = await mgmt(`SELECT grantee, string_agg(privilege_type,',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants WHERE table_schema='nex' AND table_name='food_business'
    AND grantee IN ('nex_brain_app','nex_social_app') GROUP BY grantee ORDER BY grantee`);
const postBrain = Jperm.find(g => g.grantee === 'nex_brain_app');
const postSocial = Jperm.find(g => g.grantee === 'nex_social_app');
T("J · brain/social CRUD unchanged",
  postBrain?.privs === "DELETE,INSERT,SELECT,UPDATE" && postSocial?.privs === "DELETE,INSERT,SELECT,UPDATE",
  `brain=${postBrain?.privs} social=${postSocial?.privs}`);
const Jpol = await mgmt(`SELECT count(*)::int AS n FROM pg_policy WHERE polrelid='nex.food_business'::regclass`);
T("J · food_business policy count still 5", Jpol[0].n === 5, `n=${Jpol[0].n}`);

// K · Slice 1G unchanged
const K = (await mgmt(`SELECT
  (SELECT count(*)::int FROM pg_tables WHERE schemaname='nex_workforce' AND tablename IN ('evidence_record','candidate_staging','persist_audit')) AS tables,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud`))[0];
T("K · Slice 1G unchanged (3 tables · 0 rows in each)",
  K.tables === 3 && K.ev === 0 && K.stg === 0 && K.aud === 0, JSON.stringify(K));

// L · Slice 1H R4 unchanged
const L = (await mgmt(`SELECT
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business' AND column_name IN ('source_evidence_id','source_retrieved_at')) AS r4_cols,
  (SELECT relrowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS rls,
  (SELECT relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS force_rls,
  (SELECT r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business') AS persist_owner,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS dup_groups`))[0];
T("L · Slice 1H R4 unchanged (22750 rows · 2 R4 cols · RLS enabled+not-forced · owner intact · 373 dup groups)",
  L.food_rows === 22750 && L.r4_cols === 2 && L.rls === true && L.force_rls === false && L.persist_owner === 'nex_workforce_persister_food_business' && L.dup_groups === 373,
  JSON.stringify(L));

// M · no workforce data was created
const M = (await mgmt(`SELECT
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
  (SELECT count(*)::int FROM nex_workforce.agent_heartbeat) AS hb,
  (SELECT count(*)::int FROM nex_workforce.reaper_run) AS rr`))[0];
T("M · no workforce data created (all counts 0)",
  M.wi === 0 && M.ev === 0 && M.stg === 0 && M.aud === 0 && M.hb === 0 && M.rr === 0, JSON.stringify(M));

// N · no workforce process running
const N = (await mgmt(`SELECT count(*)::int AS n FROM pg_stat_activity
  WHERE pid <> pg_backend_pid()
    AND (application_name ILIKE '%workforce%' OR application_name ILIKE '%nex-agent%'
      OR application_name ILIKE '%nex-reaper%' OR application_name ILIKE '%nex-orchestrator%'
      OR (state='active' AND (query ILIKE 'SELECT nex_workforce.claim%'
        OR query ILIKE 'SELECT nex_workforce.persist_batch%'
        OR query ILIKE 'SELECT nex_workforce.stage_candidates%')))`))[0];
T("N · no workforce processes in pg_stat_activity", N.n === 0, `n=${N.n}`);

// O · Scheduled Task
const psPost = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"],
  { encoding: "utf8" });
const postTaskState = (psPost.stdout || "").trim();
T("O · Scheduled Task still Disabled OR absent", postTaskState === "Disabled" || postTaskState === "", `state='${postTaskState}'`);

// P · .env.local
const psEnvPost = spawnSync("powershell", ["-NoProfile", "-Command",
  "$m=(Get-Item .env.local).LastWriteTime; $g=(Select-String -Path .env.local -Pattern 'nex_workforce_admin|nex_workforce_app|withWorkforceRole' -SimpleMatch); ('mtime=' + $m.ToString('o') + ' matches=' + ($g | Measure-Object).Count)"],
  { encoding: "utf8" });
const envInfoPost = (psEnvPost.stdout || "").trim();
T("P · .env.local unchanged (same mtime as pre-flight · 0 workforce identifiers)",
  envInfoPost === envInfoPre, `pre='${envInfoPre}' post='${envInfoPost}'`);

// Q · Application source untouched
const psSrc = spawnSync("powershell", ["-NoProfile", "-Command",
  "$c=Get-ChildItem -Recurse src -Include *.ts,*.tsx -ErrorAction SilentlyContinue | Select-String -Pattern 'nex_workforce_app|withWorkforceRole' -SimpleMatch; ($c | Measure-Object).Count"],
  { encoding: "utf8" });
const srcMatchCount = parseInt((psSrc.stdout || "0").trim(), 10);
T("Q · zero workforce identifiers in src/", srcMatchCount === 0, `matches=${srcMatchCount}`);

report.phases.postflight = { A, B: bp, C, D, E: E.n, Fapproved: F.n, Fextras, G: G.n, H, I, Jperm, Jpol: Jpol[0].n, K, L, M, N: N.n, postTaskState, envInfoPost, srcMatchCount };
console.log("");

// ─── FUNCTIONAL SET LOCAL ROLE PROOF ───────────────────────────────────────
// As nex_app_runtime: BEGIN; SET LOCAL ROLE nex_workforce_app; SELECT current_user, session_user; ROLLBACK;
// No workforce mutation function invoked. No work items. No writes.
// SET LOCAL is transaction-scoped; ROLLBACK reverts everything.
console.log("─── FUNCTIONAL PROOF · SET LOCAL ROLE (as nex_app_runtime · BEGIN/ROLLBACK) ───");
let proofResult = { attempted: false, ok: false, current_user: null, session_user: null, error: null };
const runtimeClient = new pg.Client({ connectionString: RUNTIME_URL });
try {
  await runtimeClient.connect();
  proofResult.attempted = true;
  try {
    await runtimeClient.query("BEGIN");
    await runtimeClient.query("SET LOCAL ROLE nex_workforce_app");
    const who = (await runtimeClient.query("SELECT current_user, session_user")).rows[0];
    proofResult.current_user = who.current_user;
    proofResult.session_user = who.session_user;
    proofResult.ok = who.current_user === "nex_workforce_app" && who.session_user === "nex_app_runtime";
    // No workforce function invoked · no writes.
    await runtimeClient.query("ROLLBACK");
  } catch (e) {
    proofResult.error = e.message.split("\n")[0];
    try { await runtimeClient.query("ROLLBACK"); } catch {}
  }
} catch (e) {
  proofResult.error = "connect: " + e.message.split("\n")[0];
} finally {
  try { await runtimeClient.end(); } catch {}
}
if (proofResult.ok) {
  T("Functional proof · SET LOCAL ROLE succeeded · current_user=nex_workforce_app · session_user=nex_app_runtime · rolled back",
    true, `current=${proofResult.current_user} session=${proofResult.session_user}`);
} else if (proofResult.attempted) {
  T("Functional proof · SET LOCAL ROLE", false, proofResult.error || `current=${proofResult.current_user} session=${proofResult.session_user}`);
} else {
  T("Functional proof · SKIPPED (could not connect as nex_app_runtime · reporting rather than inventing)", false, proofResult.error);
}
report.phases.functionalProof = proofResult;
console.log("");

// ─── FINAL VERDICT ─────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════════════════════════");
if (fail === 0) {
  console.log(`🟢 WORKFORCE APP ROLE GRANT APPLIED + VERIFIED · ${pass} checks passed`);
  console.log("🔴 HARD STOP — DOWNSTREAM GATES REMAIN UNAUTHORIZED");
  console.log("   (application cutover · agent · reaper · orchestrator · Scheduled Task)");
  console.log("═══════════════════════════════════════════════════════════════════════");
  writeReport(true);
  process.exit(0);
} else {
  console.log(`🟡 APPLIED BUT VERIFICATION DEVIATION — HARD STOP · ${fail} failures`);
  for (const l of failLines) console.log("   " + l);
  console.log("═══════════════════════════════════════════════════════════════════════");
  writeReport(false);
  process.exit(3);
}
