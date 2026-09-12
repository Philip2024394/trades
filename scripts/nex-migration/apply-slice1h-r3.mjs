// Apply Slice 1h R3 to Project B via Supabase Management API.
// ============================================================================
// Governing authorization: Philip 2026-09-04 · "APPLY SLICE 1H R3 TO PROJECT B"
// This authorization covers ONLY Slice 1h R3.
// Slice 1g is already applied (from prior successful attempt) · not re-applied.
//
// Fail-closed via lock_timeout + statement_timeout · single transaction.
// Enhanced postflight per Philip's explicit list:
//   persister role NOLOGIN + NOBYPASSRLS
//   intended memberships only · no unexpected admin/set/inherit relationships
//   function owner = persister role
//   persist_to_food_business SECURITY DEFINER
//   hardened search_path (pg_catalog, pg_temp)
//   PUBLIC EXECUTE revoked

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const RUNTIME_URL = envTools.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];

const EXPECTED_R3_SHA = "3d8880a3fd004abb638ec2ec6672267be97643bb30888a1b0f664473eb9e03da";
const R3_PATH = "supabase/migrations/_slice1h_food_business_persister.sql";

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
function hardStop(reason) {
  console.log(`\n🔴 HARD STOP · ${reason}`);
  console.log(`Failures so far: ${fail}. Aborting without further action.`);
  process.exit(2);
}
const report = { started_at: new Date().toISOString(), phases: {} };

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(" NEX Slice 1H R3 · Project B APPLY (Path A · Slice 1g stays untouched)");
console.log("═══════════════════════════════════════════════════════════════════════\n");

// ─── PHASE 0 · READ-ONLY preflight ──────────────────────────────────────────
console.log("─── PHASE 0 · READ-ONLY preflight ───");
const targetId = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr`))[0];
console.log(`  target · db=${targetId.db} · pg=${targetId.ver} · user=${targetId.usr}`);
T("target database = postgres", targetId.db === "postgres");
T("PostgreSQL 17.x", /^17\./.test(targetId.ver));

const preSnap = (await mgmt(`
  SELECT
    -- Slice 1g objects (must be present · applied in prior gate)
    (SELECT count(*)::int FROM pg_tables WHERE schemaname='nex_workforce' AND tablename IN ('evidence_record','candidate_staging','persist_audit')) AS slice1g_tables,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname IN ('stage_candidates','persist_batch')) AS slice1g_functions,
    (SELECT count(*)::int FROM nex_workforce.evidence_record) AS evidence_rows_pre,
    (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS staging_rows_pre,
    (SELECT count(*)::int FROM nex_workforce.persist_audit) AS audit_rows_pre,
    -- Slice 1h R3 objects (must be absent)
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business' AND column_name IN ('source_evidence_id','source_retrieved_at')) AS slice1h_cols_pre,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname IN ('persist_to_food_business','_crockford5')) AS slice1h_functions_pre,
    (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_role_pre,
    (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies_pre,
    (SELECT relrowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS rls_pre,
    -- Preservation baseline
    (SELECT count(*)::int FROM nex.food_business) AS food_rows,
    (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS dup_groups,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business') AS food_cols,
    (SELECT count(*)::int FROM pg_indexes WHERE schemaname='nex' AND tablename='food_business') AS food_indexes,
    -- Slice 3 objects (must be absent)
    (SELECT count(*)::int FROM pg_roles WHERE rolname IN ('nex_workforce_admin','nex_workforce_app')) AS slice3_roles_pre
`))[0];

T("Slice 1g tables present (3)",     preSnap.slice1g_tables === 3);
T("Slice 1g functions present (2)",  preSnap.slice1g_functions === 2);
T("Slice 1g tables STILL EMPTY (0/0/0)",
  preSnap.evidence_rows_pre === 0 && preSnap.staging_rows_pre === 0 && preSnap.audit_rows_pre === 0,
  `evidence=${preSnap.evidence_rows_pre} staging=${preSnap.staging_rows_pre} audit=${preSnap.audit_rows_pre}`);
T("Slice 1h R3 columns NOT yet present (0)",   preSnap.slice1h_cols_pre === 0);
T("Slice 1h R3 functions NOT yet present (0)", preSnap.slice1h_functions_pre === 0);
T("Slice 1h R3 persister role NOT yet present", preSnap.persister_role_pre === 0);
T("food_business policies NOT yet present (0)", preSnap.food_policies_pre === 0);
T("food_business RLS still OFF",                preSnap.rls_pre === false);
T("food_business row count preserved (22750)",  preSnap.food_rows === 22750);
T("duplicate groups preserved (373)",           preSnap.dup_groups === 373);
T("food_business columns still 50",             preSnap.food_cols === 50);
T("food_business indexes still 16",             preSnap.food_indexes === 16);
T("Slice 3 roles NOT present (0)",              preSnap.slice3_roles_pre === 0);

const preGrants = await mgmt(`
  SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
  WHERE table_schema='nex' AND table_name='food_business' AND grantee IN ('nex_brain_app','nex_social_app')
  GROUP BY grantee ORDER BY grantee`);
const preBrain  = preGrants.find((g) => g.grantee === "nex_brain_app");
const preSocial = preGrants.find((g) => g.grantee === "nex_social_app");
T("nex_brain_app CRUD grants intact",  preBrain?.privs  === "DELETE,INSERT,SELECT,UPDATE",  `actual=${preBrain?.privs}`);
T("nex_social_app CRUD grants intact", preSocial?.privs === "DELETE,INSERT,SELECT,UPDATE", `actual=${preSocial?.privs}`);

const preRuntimeMbr = await mgmt(`
  SELECT r.rolname FROM pg_auth_members am
  JOIN pg_roles r ON r.oid=am.roleid
  JOIN pg_roles m ON m.oid=am.member
  WHERE m.rolname='nex_app_runtime' ORDER BY r.rolname`);
const preRuntimeRoles = preRuntimeMbr.map((r) => r.rolname);
T("nex_app_runtime memberships = [brain, social] · no workforce yet",
  preRuntimeRoles.length === 2 && preRuntimeRoles.includes("nex_brain_app") && preRuntimeRoles.includes("nex_social_app"),
  preRuntimeRoles.join(","));

if (fail > 0) hardStop("Phase 0 preflight failed");
report.phases.phase0 = { targetId, preSnap, preGrants, preRuntimeRoles };
console.log("");

// ─── PHASE 1 · File integrity check ─────────────────────────────────────────
console.log("─── PHASE 1 · Migration file integrity (SHA-256) ───");
const r3 = readFileSync(R3_PATH, "utf8");
const r3Sha = createHash("sha256").update(r3).digest("hex");
const r3Lines = (r3.match(/\n/g) || []).length;
console.log(`  R3 · ${r3Lines} lines · sha256=${r3Sha}`);
T("R3 SHA-256 matches approved package", r3Sha === EXPECTED_R3_SHA,
  r3Sha === EXPECTED_R3_SHA ? "byte-identical to R3 doctrine" : `expected=${EXPECTED_R3_SHA} actual=${r3Sha}`);
T("R3 line count = 688 (per R3 doctrine)", r3Lines === 688, `actual=${r3Lines}`);
if (fail > 0) hardStop("Phase 1 file integrity mismatch");
report.phases.phase1 = { r3_sha: r3Sha, r3_lines: r3Lines };
console.log("");

// ─── PHASE 2 · Apply Slice 1h R3 with lock_timeout ─────────────────────────
console.log("─── PHASE 2 · Apply Slice 1h R3 (lock_timeout=5s statement_timeout=60s) ───");
const wrapped =
  "SET lock_timeout = '5s';\n" +
  "SET statement_timeout = '60s';\n" +
  r3;
try {
  const t0 = Date.now();
  await mgmt(wrapped);
  const dt = Date.now() - t0;
  T(`Slice 1h R3 apply succeeded (${dt} ms)`, true);
  report.phases.phase2 = { ok: true, duration_ms: dt };
} catch (e) {
  T("Slice 1h R3 apply", false, e.message.split("\n")[0]);
  report.phases.phase2 = { ok: false, error: e.message };
  hardStop("Slice 1h R3 apply failed · transaction rolled back atomically · Slice 1g unchanged · investigate");
}
console.log("");

// ─── PHASE 3 · Enhanced postflight per Philip's list ────────────────────────
console.log("─── PHASE 3 · Enhanced postflight verification ───");

const post = (await mgmt(`
  SELECT
    -- Persister role attributes (Philip's list)
    (SELECT rolcanlogin  FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_login,
    (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_bypassrls,
    (SELECT rolinherit   FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_inherit,
    (SELECT rolsuper     FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_super,
    -- Function owner + attributes (Philip's list)
    (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business') AS fn_secdef,
    (SELECT r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business') AS fn_owner,
    (SELECT p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business') AS fn_config,
    -- PUBLIC EXECUTE revoked (Philip's list)
    (SELECT has_function_privilege('PUBLIC', 'nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)', 'EXECUTE')) AS public_exec,
    -- Preservation invariants
    (SELECT count(*)::int FROM nex.food_business) AS food_rows,
    (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS dup_groups,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business') AS food_cols,
    (SELECT count(*)::int FROM pg_indexes WHERE schemaname='nex' AND tablename='food_business') AS food_indexes,
    (SELECT relrowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS rls,
    (SELECT relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS force_rls,
    (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
    -- Slice 1g state should still be intact (0 rows in tables)
    (SELECT count(*)::int FROM nex_workforce.evidence_record) AS evidence_rows_post,
    (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS staging_rows_post,
    (SELECT count(*)::int FROM nex_workforce.persist_audit) AS audit_rows_post,
    -- Slice 3 must still be absent
    (SELECT count(*)::int FROM pg_roles WHERE rolname IN ('nex_workforce_admin','nex_workforce_app')) AS slice3_roles_post
`))[0];

// Philip's mandatory checks
T("A · persister NOLOGIN",                          post.persister_login === false);
T("B · persister NOBYPASSRLS",                      post.persister_bypassrls === false);
T("C · persister rolsuper=false",                   post.persister_super === false);
T("D · persist_to_food_business SECURITY DEFINER",  post.fn_secdef === true);
T("E · function owner = nex_workforce_persister_food_business", post.fn_owner === "nex_workforce_persister_food_business", `actual=${post.fn_owner}`);
const hasHardSp = (post.fn_config || []).some((s) => s.startsWith("search_path=") && s.includes("pg_catalog") && s.includes("pg_temp"));
T("F · hardened search_path = pg_catalog, pg_temp", hasHardSp, `proconfig=${JSON.stringify(post.fn_config)}`);
T("G · PUBLIC EXECUTE revoked",                     post.public_exec === false);

// Persister role's inbound memberships · Philip's "intended memberships only"
const persisterInMbr = await mgmt(`
  SELECT r.rolname AS role_of, am.admin_option, am.set_option, am.inherit_option
  FROM pg_auth_members am
  JOIN pg_roles r ON r.oid=am.roleid
  JOIN pg_roles m ON m.oid=am.member
  WHERE m.rolname='nex_workforce_persister_food_business'
  ORDER BY r.rolname`);
console.log(`  persister inbound memberships (${persisterInMbr.length}):`);
for (const m of persisterInMbr) console.log(`    persister IS MEMBER OF ${m.role_of} · admin=${m.admin_option} set=${m.set_option} inherit=${m.inherit_option}`);
T("H · persister has ZERO inbound memberships (never inherits any other role)",
  persisterInMbr.length === 0, `count=${persisterInMbr.length}`);

// Persister role's outbound memberships · roles that have persister as member
const persisterOutMbr = await mgmt(`
  SELECT m.rolname AS member, am.admin_option, am.set_option, am.inherit_option
  FROM pg_auth_members am
  JOIN pg_roles r ON r.oid=am.roleid
  JOIN pg_roles m ON m.oid=am.member
  WHERE r.rolname='nex_workforce_persister_food_business'
  ORDER BY m.rolname`);
console.log(`  persister outbound memberships (${persisterOutMbr.length}):`);
for (const m of persisterOutMbr) console.log(`    ${m.member} IS MEMBER OF persister · admin=${m.admin_option} set=${m.set_option} inherit=${m.inherit_option}`);

// The R3 migration explicitly grants postgres SET on persister (that's the fix)
// so we expect exactly one member: postgres with set_option=true
const postgresMbr = persisterOutMbr.find((m) => m.member === "postgres");
T("I · persister has postgres as member (from R3 GRANT WITH SET TRUE · required for ALTER OWNER)",
  !!postgresMbr, "postgres membership expected");
T("I.1 · postgres membership · admin_option=true (from CREATE ROLE)",
  postgresMbr?.admin_option === true, `admin=${postgresMbr?.admin_option}`);
T("I.2 · postgres membership · set_option=true (from R3 fix)",
  postgresMbr?.set_option === true, `set=${postgresMbr?.set_option}`);
T("I.3 · postgres membership · inherit_option=false (NOT accidentally widened)",
  postgresMbr?.inherit_option === false, `inherit=${postgresMbr?.inherit_option}`);
T("J · no OTHER role has persister as member (no anon/authenticated/service_role/brain/social/etc.)",
  persisterOutMbr.length === 1 && persisterOutMbr[0].member === "postgres",
  `members: ${persisterOutMbr.map((m) => m.member).join(",") || "(none)"}`);

// Policies
const policies = await mgmt(`
  SELECT p.polname, p.polcmd, r.rolname AS role
  FROM pg_policy p JOIN LATERAL unnest(p.polroles) rid ON true LEFT JOIN pg_roles r ON r.oid=rid
  WHERE p.polrelid='nex.food_business'::regclass
  ORDER BY p.polname`);
T("K · food_business policy count = 5", post.food_policies === 5, `actual=${post.food_policies}`);
const policyNames = new Set(policies.map((p) => p.polname));
for (const expected of ["food_business_brain_app_all", "food_business_social_app_all",
                        "food_business_persister_insert", "food_business_persister_update", "food_business_persister_select"]) {
  T(`K.${expected}`, policyNames.has(expected));
}
const policyRoles = policies.map((p) => p.role);
T("L · no policy targets PUBLIC/anon/authenticated",
  !policyRoles.some((r) => r === null || r === "anon" || r === "authenticated"),
  `roles=${policyRoles.join(",")}`);

// Preservation invariants
T("M · food_business row count preserved (22750)",  post.food_rows === 22750, `pre=${preSnap.food_rows} post=${post.food_rows}`);
T("N · duplicate groups preserved (373)",           post.dup_groups === 373, `pre=${preSnap.dup_groups} post=${post.dup_groups}`);
T("O · food_business columns = 52 (50 + 2 R3)",     post.food_cols === 52, `actual=${post.food_cols}`);
T("P · food_business indexes = 17 (16 + provenance)", post.food_indexes === preSnap.food_indexes + 1, `pre=${preSnap.food_indexes} post=${post.food_indexes}`);
T("Q · RLS = TRUE (ENABLE · matches production convention)",  post.rls === true);
T("R · FORCE RLS = FALSE (NOT forced · matches production)",  post.force_rls === false);

// Slice 1g preservation
T("S · evidence_record still 0 rows",   post.evidence_rows_post === 0);
T("T · candidate_staging still 0 rows", post.staging_rows_post === 0);
T("U · persist_audit still 0 rows",     post.audit_rows_post === 0);

// Slice 3 boundary
T("V · Slice 3 roles STILL absent",     post.slice3_roles_post === 0);

// Existing brain/social grants unchanged
const postGrants = await mgmt(`
  SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
  WHERE table_schema='nex' AND table_name='food_business' AND grantee IN ('nex_brain_app','nex_social_app')
  GROUP BY grantee ORDER BY grantee`);
const postBrain  = postGrants.find((g) => g.grantee === "nex_brain_app");
const postSocial = postGrants.find((g) => g.grantee === "nex_social_app");
T("W · nex_brain_app grants byte-identical",  postBrain?.privs  === preBrain?.privs);
T("X · nex_social_app grants byte-identical", postSocial?.privs === preSocial?.privs);

// nex_app_runtime membership unchanged
const postRuntimeMbr = await mgmt(`
  SELECT r.rolname FROM pg_auth_members am
  JOIN pg_roles r ON r.oid=am.roleid
  JOIN pg_roles m ON m.oid=am.member
  WHERE m.rolname='nex_app_runtime' ORDER BY r.rolname`);
const postRuntimeRoles = postRuntimeMbr.map((r) => r.rolname);
T("Y · nex_app_runtime memberships unchanged (still [brain, social] · NOT persister/workforce_app)",
  postRuntimeRoles.length === 2 && postRuntimeRoles.includes("nex_brain_app") && postRuntimeRoles.includes("nex_social_app") &&
  !postRuntimeRoles.includes("nex_workforce_persister_food_business"),
  postRuntimeRoles.join(","));

report.phases.phase3 = { post, persisterInMbr, persisterOutMbr, policies, postGrants, postRuntimeRoles };
console.log("");

// ─── PHASE 4 · Application access smoke (brain/social · ROLLBACK-only) ─────
console.log("─── PHASE 4 · Application access smoke (READ + ROLLBACK-only write probe) ───");
const runtimePool = new pg.Pool({ connectionString: RUNTIME_URL, ssl: { rejectUnauthorized: false }, max: 2 });
try {
  // brain_app SELECT
  {
    const c = await runtimePool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_brain_app");
      const cu = await c.query("SELECT current_user");
      T("4.A brain_login SET LOCAL ROLE nex_brain_app · current_user switches",
        cu.rows[0].current_user === "nex_brain_app");
      const r = await c.query("SELECT count(*)::text AS n FROM nex.food_business");
      T("4.A brain_app SELECT nex.food_business succeeds under RLS",
        r.rows[0].n === "22750", `n=${r.rows[0].n}`);
      await c.query("ROLLBACK");
    } finally { c.release(); }
  }
  // social_app SELECT
  {
    const c = await runtimePool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_social_app");
      const cu = await c.query("SELECT current_user");
      T("4.B social_app SET LOCAL ROLE nex_social_app · current_user switches",
        cu.rows[0].current_user === "nex_social_app");
      const r = await c.query("SELECT count(*)::text AS n FROM nex.food_business");
      T("4.B social_app SELECT nex.food_business succeeds under RLS",
        r.rows[0].n === "22750", `n=${r.rows[0].n}`);
      await c.query("ROLLBACK");
    } finally { c.release(); }
  }
  // brain_app UPDATE probe · MUST ROLLBACK
  {
    const c = await runtimePool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_brain_app");
      const r = await c.query(`
        UPDATE nex.food_business
        SET business_name = business_name || ' [postflight-probe]'
        WHERE public_listing_ref = (SELECT public_listing_ref FROM nex.food_business ORDER BY internal_id LIMIT 1)
        RETURNING internal_id`);
      T("4.C brain_app UPDATE probe succeeds under RLS (ROLLBACK · no persistent change)",
        r.rowCount === 1);
      await c.query("ROLLBACK");
    } finally { c.release(); }
  }
  // runtime cannot EXECUTE persist_to_food_business (Slice 3 gate)
  {
    const c = await runtimePool.connect();
    try {
      await c.query("BEGIN");
      let denied = false;
      try {
        await c.query(`SELECT nex_workforce.persist_to_food_business(NULL, gen_random_uuid(), 1, 'x', now(), 'overpass', 'node/1', '{}'::jsonb)`);
      } catch (e) {
        denied = /permission denied/i.test(e.message);
      }
      T("4.D nex_app_runtime CANNOT EXECUTE persist_to_food_business (Slice 3 gate holds)",
        denied, denied ? "correctly denied" : "UNEXPECTED · execute succeeded pre-Slice-3");
      await c.query("ROLLBACK");
    } finally { c.release(); }
  }
} finally {
  await runtimePool.end();
}
console.log("");

// ─── PHASE 5 · Workforce boundary ───────────────────────────────────────────
console.log("─── PHASE 5 · Workforce boundary ───");
const psTask = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"],
  { encoding: "utf8" });
const taskState = (psTask.stdout || "").trim();
T("Scheduled Task NEX-Acquisition-Workforce = Disabled OR absent",
  taskState === "Disabled" || taskState === "", `actual='${taskState}'`);
const psProcs = spawnSync("powershell", ["-NoProfile", "-Command",
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'nex-workforce|nex-acquisition|run-supervisor|_category-walker' } | ForEach-Object { $_.ProcessId }"],
  { encoding: "utf8" });
const runningPids = (psProcs.stdout || "").trim().split(/\s+/).filter(Boolean);
T(`no workforce processes running (found ${runningPids.length})`,
  runningPids.length === 0, runningPids.length ? `PIDs=${runningPids.join(",")}` : "clean");
console.log("");

// ─── FINAL REPORT ──────────────────────────────────────────────────────────
report.summary = { pass, fail, failLines, finished_at: new Date().toISOString() };
mkdirSync("scripts/nex-migration", { recursive: true });
writeFileSync("scripts/nex-migration/slice1h-r3-apply-report.json", JSON.stringify(report, null, 2));
console.log(`─── FINAL REPORT · ${pass} pass · ${fail} fail ───`);
if (fail) {
  console.log("\nFailures:");
  for (const l of failLines) console.log("  " + l);
  console.log("\n🔴 APPLY FAILED / PARTIAL — INVESTIGATION REQUIRED");
  process.exit(1);
}
console.log("");
console.log("🟢 APPLY SUCCESSFUL — SLICE 1H R3 ONLY");
console.log("Report: scripts/nex-migration/slice1h-r3-apply-report.json");
console.log("");
console.log("🛑 HARD STOP · Slice 3 NOT applied · Workforce NOT activated · Scheduled Task remains disabled");
process.exit(0);
