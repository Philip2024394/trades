// Apply Slice 1h R4 to Project B via Supabase Management API.
// ============================================================================
// Governing authorization: Philip 2026-09-04 · "AUTHORIZE: APPLY SLICE 1H R4 TO PROJECT B"
//
// This is ONE production mutation only: Slice 1h R4.
// Slice 1g remains applied (already in Project B). Do not modify.
// No Slice 3. No workforce. No Scheduled Task. No cutover.
//
// Preflight (11 checks) → apply as one atomic TX → postflight (21 checks) → HARD STOP.

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const RUNTIME_URL = envTools.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];

const EXPECTED_R4_SHA = "db3c8c8ec9d414f4c3abe0ccf0b989b353a6ce6067fe15f541ddddeb12524b12";
const R4_PATH = "supabase/migrations/_slice1h_food_business_persister.sql";

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
  process.exit(code);
}
const report = { started_at: new Date().toISOString(), phases: {} };

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(" NEX Slice 1H R4 · Project B APPLY (one production mutation only)");
console.log("═══════════════════════════════════════════════════════════════════════\n");

// ─── PRE-FLIGHT (READ-ONLY · 11 checks) ─────────────────────────────────────
console.log("─── PRE-FLIGHT · READ-ONLY ───");
const targetId = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr`))[0];
console.log(`  target · db=${targetId.db} · pg=${targetId.ver} · user=${targetId.usr}`);
T("1 · target = Project B (postgres · pg 17.x)",
  targetId.db === "postgres" && /^17\./.test(targetId.ver));

const preSnap = (await mgmt(`
  SELECT
    (SELECT count(*)::int FROM pg_namespace WHERE nspname='nex_workforce') AS wf_schema,
    (SELECT count(*)::int FROM pg_tables WHERE schemaname='nex_workforce' AND tablename IN ('evidence_record','candidate_staging','persist_audit')) AS slice1g_tables,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname IN ('stage_candidates','persist_batch')) AS slice1g_functions,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business' AND column_name IN ('source_evidence_id','source_retrieved_at')) AS r4_cols_pre,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname IN ('persist_to_food_business','_crockford5')) AS r4_functions_pre,
    (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_role_pre,
    (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies_pre,
    (SELECT relrowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS rls_pre,
    (SELECT count(*)::int FROM nex.food_business) AS food_rows,
    (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS dup_groups,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business') AS food_cols,
    (SELECT count(*)::int FROM pg_roles WHERE rolname IN ('nex_workforce_admin','nex_workforce_app')) AS slice3_roles_pre
`))[0];

T("2 · nex_workforce present + Slice 1G tables (3) + functions (2)",
  preSnap.wf_schema === 1 && preSnap.slice1g_tables === 3 && preSnap.slice1g_functions === 2,
  `wf=${preSnap.wf_schema} 1g_tables=${preSnap.slice1g_tables} 1g_functions=${preSnap.slice1g_functions}`);
T("3 · evidence_record + candidate_staging + persist_audit present",
  preSnap.slice1g_tables === 3);
T("4 · Slice 1H R4 objects absent (columns=0 · functions=0 · persister=0 · policies=0)",
  preSnap.r4_cols_pre === 0 && preSnap.r4_functions_pre === 0 && preSnap.persister_role_pre === 0 && preSnap.food_policies_pre === 0,
  `cols=${preSnap.r4_cols_pre} fns=${preSnap.r4_functions_pre} persister=${preSnap.persister_role_pre} policies=${preSnap.food_policies_pre}`);
T("5 · food_business row count = 22,750", preSnap.food_rows === 22750, `actual=${preSnap.food_rows}`);
T("6 · food_business columns = 50", preSnap.food_cols === 50, `actual=${preSnap.food_cols}`);
T("7 · duplicate-group baseline = 373", preSnap.dup_groups === 373, `actual=${preSnap.dup_groups}`);
T("8 · food_business RLS OFF", preSnap.rls_pre === false);

const preGrants = await mgmt(`
  SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
  WHERE table_schema='nex' AND table_name='food_business' AND grantee IN ('nex_brain_app','nex_social_app')
  GROUP BY grantee ORDER BY grantee`);
const preBrain  = preGrants.find((g) => g.grantee === "nex_brain_app");
const preSocial = preGrants.find((g) => g.grantee === "nex_social_app");
T("9 · nex_brain_app CRUD intact + nex_social_app CRUD intact",
  preBrain?.privs === "DELETE,INSERT,SELECT,UPDATE" && preSocial?.privs === "DELETE,INSERT,SELECT,UPDATE",
  `brain=${preBrain?.privs} social=${preSocial?.privs}`);

// 10 · No workforce processes running · exclude our own inspection session
// via pid != pg_backend_pid() (this SELECT's own query text mentions
// persist_to_food_business · would false-positive without this filter).
const wfProcsPre = (await mgmt(`
  SELECT count(*)::int AS n FROM pg_stat_activity
  WHERE pid <> pg_backend_pid()
    AND (application_name ILIKE '%workforce%'
      OR application_name ILIKE '%nex-agent%'
      OR application_name ILIKE '%nex-reaper%'
      OR application_name ILIKE '%nex-orchestrator%'
      OR (state='active' AND (
           query ILIKE 'SELECT nex_workforce.claim%'
        OR query ILIKE 'SELECT nex_workforce.persist_batch%'
        OR query ILIKE 'SELECT nex_workforce.stage_candidates%'
        OR query ILIKE 'SELECT nex_workforce.persist_to_food_business%'
      )))`))[0].n;
T("10 · no external workforce processes in pg_stat_activity (excluding self)",
  wfProcsPre === 0, `count=${wfProcsPre}`);

// 11 · Scheduled Task disabled (local check)
const psPre = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"],
  { encoding: "utf8" });
const preTaskState = (psPre.stdout || "").trim();
T("11 · local Scheduled Task disabled OR absent",
  preTaskState === "Disabled" || preTaskState === "", `state='${preTaskState}'`);

// Slice 3 must remain absent (bonus safety check)
T("Slice 3 roles absent (bonus safety)", preSnap.slice3_roles_pre === 0);

if (fail > 0) hardStop("Pre-flight expectation mismatch · not mutating Project B");
report.phases.preflight = { targetId, preSnap, preGrants, preTaskState };
console.log("");

// ─── FILE INTEGRITY CHECK ───────────────────────────────────────────────────
console.log("─── FILE INTEGRITY ───");
const r4 = readFileSync(R4_PATH, "utf8");
const r4Sha = createHash("sha256").update(r4).digest("hex");
const r4Lines = (r4.match(/\n/g) || []).length;
console.log(`  R4 · ${r4Lines} lines · sha256=${r4Sha}`);
T("R4 SHA-256 matches approved package", r4Sha === EXPECTED_R4_SHA,
  r4Sha === EXPECTED_R4_SHA ? "byte-identical to R4 doctrine" : `expected=${EXPECTED_R4_SHA} actual=${r4Sha}`);
if (fail > 0) hardStop("File integrity mismatch · not mutating Project B");
report.phases.integrity = { r4_sha: r4Sha, r4_lines: r4Lines };
console.log("");

// ─── APPLY R4 · one atomic TX · fail-closed timeouts ───────────────────────
console.log("─── APPLY · Slice 1h R4 (lock_timeout=5s statement_timeout=60s · atomic) ───");
const wrapped = "SET lock_timeout = '5s';\nSET statement_timeout = '60s';\n" + r4;
try {
  const t0 = Date.now();
  await mgmt(wrapped);
  const dt = Date.now() - t0;
  T(`Slice 1h R4 committed successfully (${dt} ms)`, true);
  report.phases.apply = { ok: true, duration_ms: dt };
} catch (e) {
  const msg = e.message.split("\n")[0];
  T("Slice 1h R4 apply", false, msg);
  report.phases.apply = { ok: false, error: e.message };
  hardStop(`Slice 1h R4 failed · transaction rolled back atomically · Slice 1g unchanged · error: ${msg}`);
}
console.log("");

// ─── POST-FLIGHT · READ-ONLY · 21 checks per prompt ─────────────────────────
console.log("─── POST-FLIGHT · READ-ONLY (21 checks) ───");
const post = (await mgmt(`
  SELECT
    -- 1G preservation
    (SELECT count(*)::int FROM pg_tables WHERE schemaname='nex_workforce' AND tablename IN ('evidence_record','candidate_staging','persist_audit')) AS slice1g_tables,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname IN ('stage_candidates','persist_batch')) AS slice1g_functions,
    -- 1H R4 objects
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business') AS food_cols,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business' AND column_name IN ('source_evidence_id','source_retrieved_at')) AS r4_cols,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname IN ('persist_to_food_business','_crockford5')) AS r4_functions,
    (SELECT count(*)::int FROM nex.food_business) AS food_rows,
    (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS dup_groups,
    (SELECT relrowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS rls,
    (SELECT relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS force_rls,
    (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
    -- Persister role state
    (SELECT rolcanlogin  FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS p_login,
    (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS p_bypassrls,
    (SELECT rolsuper     FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS p_super,
    -- Persister effective schema privileges
    has_schema_privilege('nex_workforce_persister_food_business', 'nex',           'USAGE')  AS p_nex_usage,
    has_schema_privilege('nex_workforce_persister_food_business', 'nex',           'CREATE') AS p_nex_create,
    has_schema_privilege('nex_workforce_persister_food_business', 'nex_workforce', 'USAGE')  AS p_wf_usage,
    has_schema_privilege('nex_workforce_persister_food_business', 'nex_workforce', 'CREATE') AS p_wf_create,
    -- Function state
    (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business') AS fn_secdef,
    (SELECT r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business') AS fn_owner,
    (SELECT p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business') AS fn_config,
    -- Runtime tables · must be empty
    (SELECT count(*)::int FROM nex_workforce.evidence_record) AS evidence_rows,
    (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS staging_rows,
    (SELECT count(*)::int FROM nex_workforce.persist_audit) AS audit_rows,
    -- Slice 3 absence
    (SELECT count(*)::int FROM pg_roles WHERE rolname IN ('nex_workforce_admin','nex_workforce_app')) AS slice3_roles
`))[0];

T("1 · Slice 1G tables + functions unchanged (3 tables, 2 functions)",
  post.slice1g_tables === 3 && post.slice1g_functions === 2);
T("2 · nex_workforce contains 1G + 1H persist_to_food_business + _crockford5",
  post.slice1g_tables === 3 && post.slice1g_functions === 2 && post.r4_functions === 2);
T("3 · nex.food_business now has 52 columns (50 + 2 R4 provenance)",
  post.food_cols === 52 && post.r4_cols === 2, `total=${post.food_cols} r4=${post.r4_cols}`);
T("4 · food_business row count remains exactly 22,750", post.food_rows === 22750, `actual=${post.food_rows}`);
T("5 · duplicate-group count preserved at 373 (legacy untouched)", post.dup_groups === 373, `actual=${post.dup_groups}`);

// 6 · Existing food_business data not rewritten (spot-check via representative rows)
const dataSpotCheck = await mgmt(`
  SELECT count(*)::int AS n_v1 FROM nex.food_business WHERE source='openstreetmap_overpass_v1';
`);
T("6 · openstreetmap_overpass_v1 rows preserved (796)", dataSpotCheck[0].n_v1 === 796, `actual=${dataSpotCheck[0].n_v1}`);

T("7 · RLS = ENABLED (true) but NOT FORCE (false)", post.rls === true && post.force_rls === false,
  `rls=${post.rls} force=${post.force_rls}`);
T("8 · exactly 5 food_business policies", post.food_policies === 5, `actual=${post.food_policies}`);

// 9 · No PUBLIC/anon/authenticated policies
const policyRoles = await mgmt(`
  SELECT p.polname, r.rolname
  FROM pg_policy p JOIN LATERAL unnest(p.polroles) rid ON true LEFT JOIN pg_roles r ON r.oid=rid
  WHERE p.polrelid='nex.food_business'::regclass ORDER BY p.polname`);
const rolesUsed = policyRoles.map((r) => r.rolname);
T("9 · no PUBLIC / anon / authenticated policy",
  !rolesUsed.some((r) => r === null || r === "anon" || r === "authenticated"),
  `roles: ${rolesUsed.join(",")}`);

// 10/11 · brain/social CRUD preserved
const postGrants = await mgmt(`
  SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
  WHERE table_schema='nex' AND table_name='food_business' AND grantee IN ('nex_brain_app','nex_social_app')
  GROUP BY grantee ORDER BY grantee`);
const postBrain  = postGrants.find((g) => g.grantee === "nex_brain_app");
const postSocial = postGrants.find((g) => g.grantee === "nex_social_app");
T("10 · nex_brain_app CRUD unchanged (DELETE,INSERT,SELECT,UPDATE)",
  postBrain?.privs === "DELETE,INSERT,SELECT,UPDATE", `actual=${postBrain?.privs}`);
T("11 · nex_social_app CRUD unchanged (DELETE,INSERT,SELECT,UPDATE)",
  postSocial?.privs === "DELETE,INSERT,SELECT,UPDATE", `actual=${postSocial?.privs}`);

// 12 · Persister role state
T("12a · persister NOLOGIN", post.p_login === false);
T("12b · persister NOBYPASSRLS", post.p_bypassrls === false);
T("12c · persister rolsuper=false", post.p_super === false);
const inbound = await mgmt(`
  SELECT r.rolname FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
  WHERE m.rolname='nex_workforce_persister_food_business'`);
T("12d · persister has zero inbound memberships (never inherits any role)",
  inbound.length === 0, `count=${inbound.length}`);
const outbound = await mgmt(`
  SELECT m.rolname AS member, am.admin_option, am.set_option, am.inherit_option
  FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
  WHERE r.rolname='nex_workforce_persister_food_business' ORDER BY m.rolname`);
console.log(`  persister outbound memberships (${outbound.length}):`);
for (const m of outbound) console.log(`    ${m.member} · admin=${m.admin_option} set=${m.set_option} inherit=${m.inherit_option}`);
T("12e · no dangerous inherited memberships (no member has inherit_option=true)",
  outbound.every((m) => m.inherit_option === false),
  outbound.filter((m) => m.inherit_option === true).map((m) => m.member).join(",") || "clean");
const dangerousMembers = outbound.filter((m) => ["anon","authenticated","service_role","nex_brain_app","nex_social_app","nex_app_runtime"].includes(m.member));
T("12f · no app roles are members of persister",
  dangerousMembers.length === 0, dangerousMembers.map((m) => m.member).join(","));

// 13 · Persister schema privileges
T("13a · persister USAGE on nex", post.p_nex_usage === true);
T("13b · persister USAGE on nex_workforce", post.p_wf_usage === true);
T("13c · persister does NOT have CREATE on nex_workforce (REVOKE-after-migration worked)",
  post.p_wf_create === false);
T("13d · persister does NOT have CREATE on nex (never granted)", post.p_nex_create === false);
const persisterTableGrants = await mgmt(`
  SELECT table_schema, table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
  WHERE grantee='nex_workforce_persister_food_business'
  GROUP BY table_schema, table_name ORDER BY table_schema, table_name`);
const foodBusGrant = persisterTableGrants.find((g) => g.table_schema === "nex" && g.table_name === "food_business");
const evidenceGrant = persisterTableGrants.find((g) => g.table_schema === "nex_workforce" && g.table_name === "evidence_record");
const workItemGrant = persisterTableGrants.find((g) => g.table_schema === "nex_workforce" && g.table_name === "work_item");
T("13e · persister SELECT/INSERT/UPDATE on nex.food_business",
  foodBusGrant?.privs === "INSERT,SELECT,UPDATE", `actual=${foodBusGrant?.privs}`);
T("13f · persister SELECT on nex_workforce.evidence_record",
  evidenceGrant?.privs === "SELECT", `actual=${evidenceGrant?.privs}`);
T("13g · persister SELECT+UPDATE on nex_workforce.work_item",
  workItemGrant?.privs === "SELECT,UPDATE", `actual=${workItemGrant?.privs}`);

// 14 · Function state
T("14a · persist_to_food_business SECURITY DEFINER", post.fn_secdef === true);
T("14b · owner = nex_workforce_persister_food_business", post.fn_owner === "nex_workforce_persister_food_business",
  `actual=${post.fn_owner}`);
const hasHardSp = (post.fn_config || []).some((s) => s.startsWith("search_path=") && s.includes("pg_catalog") && s.includes("pg_temp"));
T("14c · hardened search_path (pg_catalog, pg_temp)", hasHardSp);
const publicExecCheck = (await mgmt(`
  SELECT NOT EXISTS (
    SELECT 1 FROM (
      SELECT (aclexplode(proacl)).*
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business'
    ) acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS revoked`))[0];
T("14d · PUBLIC EXECUTE revoked on persist_to_food_business", publicExecCheck.revoked === true);

// 15/16/17 · No workforce data
T("15 · zero evidence_record rows", post.evidence_rows === 0);
T("16 · zero candidate_staging rows", post.staging_rows === 0);
T("17 · zero persist_audit rows", post.audit_rows === 0);

// 18 · Slice 3 roles do not exist
T("18 · Slice 3 roles NOT created (nex_workforce_admin/nex_workforce_app absent)",
  post.slice3_roles === 0);

// 19 · nex_app_runtime membership unchanged
const runtimeMbr = await mgmt(`
  SELECT r.rolname FROM pg_auth_members am
  JOIN pg_roles r ON r.oid=am.roleid
  JOIN pg_roles m ON m.oid=am.member
  WHERE m.rolname='nex_app_runtime' ORDER BY r.rolname`);
const runtimeRoles = runtimeMbr.map((r) => r.rolname);
T("19 · nex_app_runtime memberships unchanged (brain + social only · no persister/workforce_app)",
  runtimeRoles.length === 2 && runtimeRoles.includes("nex_brain_app") && runtimeRoles.includes("nex_social_app") &&
  !runtimeRoles.includes("nex_workforce_persister_food_business") && !runtimeRoles.includes("nex_workforce_app"),
  runtimeRoles.join(","));

// 20 · Scheduled Task disabled (local check · unchanged since preflight)
const psPost = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"],
  { encoding: "utf8" });
const postTaskState = (psPost.stdout || "").trim();
T("20 · Scheduled Task still disabled OR absent",
  postTaskState === "Disabled" || postTaskState === "", `state='${postTaskState}'`);

// 21 · No worker/agent/reaper/orchestrator process
const psProcs = spawnSync("powershell", ["-NoProfile", "-Command",
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'nex-workforce|nex-acquisition|run-supervisor|_category-walker|run-production' } | ForEach-Object { $_.ProcessId }"],
  { encoding: "utf8" });
const runningPids = (psProcs.stdout || "").trim().split(/\s+/).filter(Boolean);
T(`21 · no worker/agent/reaper/orchestrator processes running (${runningPids.length})`,
  runningPids.length === 0, runningPids.length ? `PIDs=${runningPids.join(",")}` : "clean");

report.phases.postflight = { post, outbound, inbound, persisterTableGrants, postGrants, runtimeRoles, publicExec: publicExecCheck.revoked };
console.log("");

// ─── FINAL REPORT ──────────────────────────────────────────────────────────
report.summary = { pass, fail, failLines, finished_at: new Date().toISOString() };
mkdirSync("scripts/nex-migration", { recursive: true });
writeFileSync("scripts/nex-migration/slice1h-r4-apply-report.json", JSON.stringify(report, null, 2));
console.log(`─── FINAL · ${pass} pass · ${fail} fail ───`);
if (fail) {
  console.log("\nFailures:");
  for (const l of failLines) console.log("  " + l);
  console.log("\n🔴 APPLY FAILED / PARTIAL — INVESTIGATION REQUIRED");
  console.log("Report: scripts/nex-migration/slice1h-r4-apply-report.json");
  process.exit(1);
}

console.log("");
console.log("SLICE 1H R4 — APPLIED");
console.log("PROJECT B — CLEAN");
console.log("1G — UNCHANGED");
console.log("1H — VERIFIED");
console.log("WORKFORCE — NOT STARTED");
console.log("SLICE 3 — NOT APPLIED");
console.log("");
console.log("🛑 HARD STOP · No Slice 3 · no workforce · no Scheduled Task · no cutover");
console.log("Report: scripts/nex-migration/slice1h-r4-apply-report.json");
process.exit(0);
