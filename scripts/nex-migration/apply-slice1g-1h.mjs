// Apply Slice 1g + Slice 1h R2 to Project B via Supabase Management API.
// ============================================================================
// Governing authorization: Philip 2026-09-04 · "APPLY SLICE 1G + 1H TO PROJECT B"
//
// This script mirrors phase12-regrant-with-inherit.mjs · fail-closed semantics
// via lock_timeout + statement_timeout. Executes:
//
//   PHASE 0  · READ-ONLY preflight + baseline capture (19 checks)
//   PHASE 1  · Freeze 373-group identity_ambiguous baseline (READ-ONLY)
//   PHASE 2  · Migration file integrity check (line counts + SHA-256)
//   PHASE 3  · SET lock_timeout='5s' + statement_timeout='60s'
//   PHASE 4  · Apply _slice1g_persistence_boundary.sql
//   PHASE 5  · Apply _slice1h_food_business_persister.sql
//   PHASE 6  · Persister behavior sanity (function present · duplicates NOT touched)
//   PHASE 7  · Post-flight verification (35 checks)
//   PHASE 8  · Application access smoke (brain/social · ROLLBACK-only)
//   PHASE 9  · Preflight-vs-post-flight integrity delta
//   PHASE 10 · Workforce boundary (Scheduled Task disabled · no processes)
//   PHASE 11 · Final report
//
// HARD STOP on any unexpected condition. NO Slice 3. NO activation.

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
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
function hardStop(reason) {
  console.log(`\n🔴 HARD STOP · ${reason}`);
  console.log(`Failures so far: ${fail}. Aborting without further action.`);
  process.exit(2);
}

const report = { phases: {}, warnings: [], errors: [] };

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(" NEX Slice 1G + 1H R2 · Project B APPLY");
console.log("═══════════════════════════════════════════════════════════════════════\n");

// ─── PHASE 0 · READ-ONLY PREFLIGHT ──────────────────────────────────────────
console.log("─── PHASE 0 · READ-ONLY preflight ───");
const targetId = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr, current_setting('port') AS port`))[0];
console.log(`  target · db=${targetId.db} · pg=${targetId.ver} · user=${targetId.usr} · port=${targetId.port}`);
T("target database = postgres", targetId.db === "postgres", targetId.db);
T("PostgreSQL version 17.x", /^17\./.test(targetId.ver), targetId.ver);

const preSnap = (await mgmt(`
  SELECT
    (SELECT count(*)::int FROM nex.food_business) AS food_rows,
    (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS dup_groups,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business') AS food_cols,
    (SELECT relrowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS rls,
    (SELECT relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS force_rls,
    (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
    (SELECT count(*)::int FROM pg_indexes WHERE schemaname='nex' AND tablename='food_business') AS food_indexes,
    (SELECT count(*)::int FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid WHERE cl.relname='food_business') AS food_constraints,
    (SELECT count(*)::int FROM pg_tables WHERE schemaname='nex_workforce') AS wf_tables,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce') AS wf_functions,
    (SELECT count(*)::int FROM pg_tables WHERE schemaname='nex_workforce' AND tablename IN ('evidence_record','candidate_staging','persist_audit')) AS slice1g_tables_present,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname IN ('stage_candidates','persist_batch','persist_to_food_business','_crockford5')) AS slice1g_1h_functions_present,
    (SELECT count(*)::int FROM pg_roles WHERE rolname IN ('nex_workforce_persister_food_business','nex_workforce_admin','nex_workforce_app')) AS slice1g_1h_3_roles_present
`))[0];
console.log(`  baseline · food_rows=${preSnap.food_rows} · dup_groups=${preSnap.dup_groups} · food_cols=${preSnap.food_cols}`);
console.log(`  baseline · RLS=${preSnap.rls} · FORCE=${preSnap.force_rls} · policies=${preSnap.food_policies} · indexes=${preSnap.food_indexes} · constraints=${preSnap.food_constraints}`);
console.log(`  baseline · nex_workforce · tables=${preSnap.wf_tables} · functions=${preSnap.wf_functions}`);

T("food_business row count = 22750", preSnap.food_rows === 22750, `actual=${preSnap.food_rows}`);
T("duplicate groups = 373",           preSnap.dup_groups === 373, `actual=${preSnap.dup_groups}`);
T("food_business columns = 50",       preSnap.food_cols === 50, `actual=${preSnap.food_cols}`);
T("food_business RLS currently OFF",   preSnap.rls === false, `actual=${preSnap.rls}`);
T("food_business FORCE currently OFF", preSnap.force_rls === false);
T("food_business policies = 0",        preSnap.food_policies === 0);
T("food_business indexes = 16",        preSnap.food_indexes === 16, `actual=${preSnap.food_indexes}`);
T("food_business constraints (all types) present", preSnap.food_constraints > 0);
T("nex_workforce tables = 6 (R4 inert)", preSnap.wf_tables === 6);
T("nex_workforce functions = 9 (R4 inert)", preSnap.wf_functions === 9);
T("Slice 1g tables NOT yet present (0)", preSnap.slice1g_tables_present === 0);
T("Slice 1g/1h functions NOT yet present (0)", preSnap.slice1g_1h_functions_present === 0);
T("Slice 1g/1h/3 roles NOT yet present (0)", preSnap.slice1g_1h_3_roles_present === 0);

const preGrants = await mgmt(`
  SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
  WHERE table_schema='nex' AND table_name='food_business'
  GROUP BY grantee ORDER BY grantee`);
console.log(`  baseline · food_business grants: ${JSON.stringify(preGrants)}`);
const brainGrant  = preGrants.find((g) => g.grantee === "nex_brain_app");
const socialGrant = preGrants.find((g) => g.grantee === "nex_social_app");
T("nex_brain_app grants = DELETE,INSERT,SELECT,UPDATE",  brainGrant?.privs === "DELETE,INSERT,SELECT,UPDATE",  `actual=${brainGrant?.privs}`);
T("nex_social_app grants = DELETE,INSERT,SELECT,UPDATE", socialGrant?.privs === "DELETE,INSERT,SELECT,UPDATE", `actual=${socialGrant?.privs}`);

const preFK = await mgmt(`SELECT count(*)::int AS n FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid WHERE cl.relname='food_business' AND c.conname='food_business_cycle_run_id_fkey'`);
T("cycle_run_id FK exists", preFK[0].n === 1);

const preRunMbr = await mgmt(`
  SELECT r.rolname FROM pg_auth_members am
  JOIN pg_roles r ON r.oid=am.roleid
  JOIN pg_roles m ON m.oid=am.member
  WHERE m.rolname='nex_app_runtime' ORDER BY r.rolname`);
const runtimeRoles = preRunMbr.map((r) => r.rolname);
console.log(`  baseline · nex_app_runtime memberships: ${JSON.stringify(runtimeRoles)}`);
T("nex_app_runtime member of nex_brain_app + nex_social_app · NOT nex_workforce_app",
  runtimeRoles.includes("nex_brain_app") && runtimeRoles.includes("nex_social_app") && !runtimeRoles.includes("nex_workforce_app"),
  runtimeRoles.join(","));

if (fail > 0) hardStop("Phase 0 baseline mismatch");
report.phases.phase0 = { targetId, preSnap, preGrants, runtimeRoles, pass, fail };
console.log("");

// ─── PHASE 1 · Freeze identity_ambiguous baseline ────────────────────────────
console.log("─── PHASE 1 · Freeze 373-group identity_ambiguous baseline (READ-ONLY) ───");
const dupBaseline = await mgmt(`
  SELECT source_reference, count(*)::int AS n
  FROM nex.food_business
  WHERE source='osm_overpass' AND source_reference IS NOT NULL
  GROUP BY source_reference
  HAVING count(*)>1
  ORDER BY count(*) DESC, source_reference`);
T("duplicate baseline captured = 373 groups", dupBaseline.length === 373, `actual=${dupBaseline.length}`);
mkdirSync("scripts/nex-migration", { recursive: true });
writeFileSync("scripts/nex-migration/slice1g-1h-apply-dup-baseline.json",
  JSON.stringify({ frozen_at: new Date().toISOString(), n_groups: dupBaseline.length, groups: dupBaseline }, null, 2));
console.log(`  saved: scripts/nex-migration/slice1g-1h-apply-dup-baseline.json`);
report.phases.phase1 = { n_groups: dupBaseline.length, top5: dupBaseline.slice(0, 5) };

if (fail > 0) hardStop("Phase 1 baseline capture failed");
console.log("");

// ─── PHASE 2 · Migration file integrity ─────────────────────────────────────
console.log("─── PHASE 2 · Migration file integrity ───");
const slice1gPath = "supabase/migrations/_slice1g_persistence_boundary.sql";
const slice1hPath = "supabase/migrations/_slice1h_food_business_persister.sql";
const slice1g = readFileSync(slice1gPath, "utf8");
const slice1h = readFileSync(slice1hPath, "utf8");
// Match `wc -l` semantics: count newline characters (files end with a trailing newline)
const countNewlines = (s) => (s.match(/\n/g) || []).length;
const slice1gLines = countNewlines(slice1g);
const slice1hLines = countNewlines(slice1h);
const slice1gSha = createHash("sha256").update(slice1g).digest("hex");
const slice1hSha = createHash("sha256").update(slice1h).digest("hex");
console.log(`  1g · ${slice1gLines} lines · sha256=${slice1gSha}`);
console.log(`  1h · ${slice1hLines} lines · sha256=${slice1hSha}`);
T("Slice 1g line count = 502 (wc -l)", slice1gLines === 502, `actual=${slice1gLines}`);
T("Slice 1h line count = 647 (wc -l)", slice1hLines === 647, `actual=${slice1hLines}`);
// SHA-256 is the authoritative content fingerprint · captured in report
T("Slice 1g SHA-256 recorded", slice1gSha.length === 64);
T("Slice 1h SHA-256 recorded", slice1hSha.length === 64);
report.phases.phase2 = { slice1g: { path: slice1gPath, lines: slice1gLines, sha256: slice1gSha },
                          slice1h: { path: slice1hPath, lines: slice1hLines, sha256: slice1hSha } };

if (fail > 0) hardStop("Phase 2 file integrity mismatch");
console.log("");

// ─── PHASE 3-4 · Apply Slice 1g with lock_timeout ───────────────────────────
console.log("─── PHASE 3-4 · Apply Slice 1g (lock_timeout=5s statement_timeout=60s) ───");
const slice1gWrapped =
  "SET lock_timeout = '5s';\n" +
  "SET statement_timeout = '60s';\n" +
  slice1g;
try {
  const t0 = Date.now();
  await mgmt(slice1gWrapped);
  const dt = Date.now() - t0;
  T(`Slice 1g apply succeeded (${dt} ms)`, true);
  report.phases.phase4 = { ok: true, duration_ms: dt };
} catch (e) {
  T("Slice 1g apply", false, e.message.split("\n")[0]);
  report.phases.phase4 = { ok: false, error: e.message };
  hardStop("Slice 1g apply failed · transaction rolled back automatically · NOT continuing to 1h");
}
console.log("");

// ─── PHASE 5 · Apply Slice 1h R2 ────────────────────────────────────────────
console.log("─── PHASE 5 · Apply Slice 1h R2 (lock_timeout=5s statement_timeout=60s) ───");
const slice1hWrapped =
  "SET lock_timeout = '5s';\n" +
  "SET statement_timeout = '60s';\n" +
  slice1h;
try {
  const t0 = Date.now();
  await mgmt(slice1hWrapped);
  const dt = Date.now() - t0;
  T(`Slice 1h R2 apply succeeded (${dt} ms)`, true);
  report.phases.phase5 = { ok: true, duration_ms: dt };
} catch (e) {
  T("Slice 1h R2 apply", false, e.message.split("\n")[0]);
  report.phases.phase5 = { ok: false, error: e.message };
  hardStop("Slice 1h R2 apply failed · Slice 1g objects remain applied · manual rollback per doctrine §13 may be required");
}
console.log("");

// ─── PHASE 6 · Persister behavior sanity ────────────────────────────────────
console.log("─── PHASE 6 · Duplicate-safety sanity ───");
const persisterCheck = (await mgmt(`
  SELECT prosecdef, r.rolname AS owner, p.proconfig
  FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
  WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='persist_to_food_business'`))[0];
T("persist_to_food_business SECURITY DEFINER", persisterCheck?.prosecdef === true);
T("persist_to_food_business owner = nex_workforce_persister_food_business",
  persisterCheck?.owner === "nex_workforce_persister_food_business", `actual=${persisterCheck?.owner}`);
const hasSp = (persisterCheck?.proconfig || []).some((s) => s.startsWith("search_path=") && s.includes("pg_catalog") && s.includes("pg_temp"));
T("persist_to_food_business hardened search_path (pg_catalog, pg_temp)", hasSp);

const uniqueIdx = await mgmt(`
  SELECT indexname FROM pg_indexes
  WHERE schemaname='nex' AND tablename='food_business'
    AND indexname='food_business_workforce_identity'`);
T("NO food_business_workforce_identity UNIQUE INDEX created (R2 uses match-count branching)",
  uniqueIdx.length === 0, uniqueIdx.length ? "UNIQUE index found · UNEXPECTED" : "no unique index · correct");

const dupPost = (await mgmt(`
  SELECT count(*)::int AS n FROM (SELECT source_reference FROM nex.food_business
    WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x`))[0].n;
T("duplicate groups still 373 (legacy untouched)", dupPost === 373, `actual=${dupPost}`);
console.log("");

// ─── PHASE 7 · Post-flight verification (35 checks) ─────────────────────────
console.log("─── PHASE 7 · Post-flight READ-ONLY verification (35 checks) ───");
const post = (await mgmt(`
  SELECT
    current_database() AS db,
    current_setting('server_version') AS ver,
    -- Slice 1g objects
    (SELECT count(*)::int FROM pg_tables WHERE schemaname='nex_workforce' AND tablename IN ('evidence_record','candidate_staging','persist_audit')) AS slice1g_tables,
    (SELECT count(*)::int FROM pg_indexes WHERE schemaname='nex_workforce' AND indexname IN ('evidence_record_by_work_item','evidence_record_by_response','evidence_record_by_source','staging_pending','staging_by_evidence','staging_by_natural_key','persist_audit_by_work_item','persist_audit_by_evidence')) AS slice1g_indexes,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname IN ('stage_candidates','persist_batch')) AS slice1g_functions,
    (SELECT count(*)::int FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid WHERE cl.relname='evidence_record' AND c.conname='evidence_id_consistency') AS evidence_check,
    (SELECT count(*)::int FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid WHERE cl.relname='candidate_staging' AND c.conname='staging_dedupe') AS staging_dedupe,
    -- Slice 1h R2 objects
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business' AND column_name IN ('source_evidence_id','source_retrieved_at')) AS slice1h_cols,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business') AS total_food_cols,
    (SELECT count(*)::int FROM pg_indexes WHERE schemaname='nex' AND indexname='idx_food_business_source_evidence') AS provenance_idx,
    (SELECT relrowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS rls,
    (SELECT relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS force_rls,
    (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
    (SELECT count(*)::int FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_role,
    (SELECT rolcanlogin FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_login,
    (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_bypassrls,
    (SELECT count(*)::int FROM nex.food_business) AS food_rows,
    (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS dup_groups,
    (SELECT count(*)::int FROM nex.food_business WHERE source_evidence_id IS NOT NULL) AS provenance_populated,
    (SELECT count(*)::int FROM nex_workforce.evidence_record) AS evidence_rows,
    (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS staging_rows,
    (SELECT count(*)::int FROM nex_workforce.persist_audit) AS audit_rows,
    (SELECT count(*)::int FROM pg_roles WHERE rolname IN ('nex_workforce_admin','nex_workforce_app')) AS slice3_roles,
    (SELECT count(*)::int FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid WHERE cl.relname='food_business' AND c.conname='food_business_cycle_run_id_fkey') AS cycle_fk,
    (SELECT count(*)::int FROM pg_indexes WHERE schemaname='nex' AND tablename='food_business') AS food_indexes,
    (SELECT count(*)::int FROM nex.food_business WHERE source='openstreetmap_overpass_v1') AS v1_rows
`))[0];

// Post-flight assertions
T("1  · db still 'postgres'",       post.db === "postgres");
T("2  · PG version 17.x",            /^17\./.test(post.ver));
T("3  · Slice 1g tables present = 3", post.slice1g_tables === 3, `actual=${post.slice1g_tables}`);
T("4  · Slice 1g indexes present = 8", post.slice1g_indexes === 8, `actual=${post.slice1g_indexes}`);
T("5  · Slice 1g functions present = 2", post.slice1g_functions === 2);
T("6  · evidence_id_consistency CHECK present", post.evidence_check === 1);
T("7  · staging_dedupe CHECK present", post.staging_dedupe === 1);
T("8  · source_evidence_id + source_retrieved_at columns present", post.slice1h_cols === 2);
T("9  · total food_business columns = 52 (50 + 2)", post.total_food_cols === 52, `actual=${post.total_food_cols}`);
T("10 · idx_food_business_source_evidence created", post.provenance_idx === 1);
T("11 · food_business RLS = TRUE (ENABLE)", post.rls === true);
T("12 · food_business FORCE RLS = FALSE (production convention · NOT forced)", post.force_rls === false);
T("13 · food_business policies = 5", post.food_policies === 5, `actual=${post.food_policies}`);
T("14 · nex_workforce_persister_food_business role exists", post.persister_role === 1);
T("15 · persister role NOLOGIN", post.persister_login === false);
T("16 · persister role NOBYPASSRLS", post.persister_bypassrls === false);
T("17 · food_business row count preserved (22750)", post.food_rows === 22750, `actual=${post.food_rows}`);
T("18 · duplicate group count preserved (373 · legacy untouched)", post.dup_groups === 373, `actual=${post.dup_groups}`);
T("19 · provenance populated rows = 0 (workforce not activated)", post.provenance_populated === 0);
T("20 · evidence_record rows = 0", post.evidence_rows === 0);
T("21 · candidate_staging rows = 0", post.staging_rows === 0);
T("22 · persist_audit rows = 0", post.audit_rows === 0);
T("23 · Slice 3 roles NOT created (nex_workforce_admin/nex_workforce_app absent)", post.slice3_roles === 0);
T("24 · cycle_run_id FK preserved", post.cycle_fk === 1);
T("25 · food_business indexes = 17 (16 pre-existing + 1 provenance)", post.food_indexes === 17, `actual=${post.food_indexes}`);
T("26 · openstreetmap_overpass_v1 rows preserved (796)", post.v1_rows === 796, `actual=${post.v1_rows}`);

// 27-30 · Policy details
const policies = await mgmt(`
  SELECT polname, polcmd, r.rolname AS role
  FROM pg_policy p JOIN LATERAL unnest(p.polroles) rid ON true LEFT JOIN pg_roles r ON r.oid=rid
  WHERE p.polrelid='nex.food_business'::regclass ORDER BY polname`);
const policyRoles = new Set(policies.map((p) => p.role));
T("27 · food_business_brain_app_all policy present",     policies.some((p) => p.polname === "food_business_brain_app_all"));
T("28 · food_business_social_app_all policy present",    policies.some((p) => p.polname === "food_business_social_app_all"));
T("29 · food_business_persister_insert/update/select present",
  policies.some((p) => p.polname === "food_business_persister_insert") &&
  policies.some((p) => p.polname === "food_business_persister_update") &&
  policies.some((p) => p.polname === "food_business_persister_select"));
T("30 · no PUBLIC / anon / authenticated policy",
  ![...policyRoles].some((r) => r === null || r === "anon" || r === "authenticated"),
  `policy roles: ${[...policyRoles].join(",")}`);

// 31 · PUBLIC EXECUTE revoked on persister function
const publicExec = (await mgmt(`
  SELECT has_function_privilege('PUBLIC', 'nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)', 'EXECUTE') AS pub_exec`))[0];
T("31 · PUBLIC EXECUTE on persist_to_food_business = false", publicExec.pub_exec === false);

// 32-33 · Existing grants unchanged
const postGrants = await mgmt(`
  SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
  WHERE table_schema='nex' AND table_name='food_business'
  GROUP BY grantee ORDER BY grantee`);
const postBrain  = postGrants.find((g) => g.grantee === "nex_brain_app");
const postSocial = postGrants.find((g) => g.grantee === "nex_social_app");
T("32 · nex_brain_app grants unchanged (DELETE,INSERT,SELECT,UPDATE)",  postBrain?.privs  === "DELETE,INSERT,SELECT,UPDATE",  `actual=${postBrain?.privs}`);
T("33 · nex_social_app grants unchanged (DELETE,INSERT,SELECT,UPDATE)", postSocial?.privs === "DELETE,INSERT,SELECT,UPDATE", `actual=${postSocial?.privs}`);

// 34 · nex_app_runtime membership unchanged (no nex_workforce_app)
const postRunMbr = await mgmt(`
  SELECT r.rolname FROM pg_auth_members am
  JOIN pg_roles r ON r.oid=am.roleid
  JOIN pg_roles m ON m.oid=am.member
  WHERE m.rolname='nex_app_runtime' ORDER BY r.rolname`);
const postRuntimeRoles = postRunMbr.map((r) => r.rolname);
T("34 · nex_app_runtime memberships unchanged (brain + social · NOT workforce_app)",
  postRuntimeRoles.includes("nex_brain_app") && postRuntimeRoles.includes("nex_social_app") &&
  !postRuntimeRoles.includes("nex_workforce_app") && !postRuntimeRoles.includes("nex_workforce_admin"),
  postRuntimeRoles.join(","));

// 35 · No workforce processes in pg_stat_activity
const wfProcs = (await mgmt(`
  SELECT count(*)::int AS n FROM pg_stat_activity
  WHERE query ILIKE '%nex_workforce.claim%' OR query ILIKE '%persist_to_food_business%'
     OR query ILIKE '%stage_candidates%' OR query ILIKE '%persist_batch%'
     OR application_name ILIKE '%workforce%'`))[0].n;
T("35 · no workforce processes in pg_stat_activity", wfProcs === 0, `count=${wfProcs}`);

report.phases.phase7 = { post, policies, postGrants, postRuntimeRoles, wfProcs };
console.log("");

// ─── PHASE 8 · Application access smoke (ROLLBACK-only) ─────────────────────
console.log("─── PHASE 8 · Application access smoke (brain/social · ROLLBACK-only) ───");
const runtimePool = new pg.Pool({ connectionString: RUNTIME_URL, ssl: { rejectUnauthorized: false }, max: 2 });
try {
  // A. brain_app SELECT
  const c = await runtimePool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE nex_brain_app");
    const cu = await c.query("SELECT current_user");
    T("8.A · SET LOCAL ROLE nex_brain_app · current_user switches", cu.rows[0].current_user === "nex_brain_app");
    const r = await c.query("SELECT count(*)::text AS n FROM nex.food_business");
    T("8.A · brain_app SELECT nex.food_business succeeds after RLS enable", r.rows[0].n === "22750", `n=${r.rows[0].n}`);
    await c.query("ROLLBACK");
  } finally { c.release(); }

  // B. social_app SELECT
  const c2 = await runtimePool.connect();
  try {
    await c2.query("BEGIN");
    await c2.query("SET LOCAL ROLE nex_social_app");
    const cu = await c2.query("SELECT current_user");
    T("8.B · SET LOCAL ROLE nex_social_app · current_user switches", cu.rows[0].current_user === "nex_social_app");
    const r = await c2.query("SELECT count(*)::text AS n FROM nex.food_business");
    T("8.B · social_app SELECT nex.food_business succeeds after RLS enable", r.rows[0].n === "22750", `n=${r.rows[0].n}`);
    await c2.query("ROLLBACK");
  } finally { c2.release(); }

  // C. brain_app UPDATE probe · MUST ROLLBACK · no persistent state change
  const c3 = await runtimePool.connect();
  try {
    await c3.query("BEGIN");
    await c3.query("SET LOCAL ROLE nex_brain_app");
    const r = await c3.query(`
      UPDATE nex.food_business
      SET business_name = business_name || ' [phase8-probe]'
      WHERE public_listing_ref = (SELECT public_listing_ref FROM nex.food_business ORDER BY internal_id LIMIT 1)
      RETURNING internal_id`);
    T("8.C · brain_app UPDATE probe succeeds inside RLS + ROLLBACK", r.rowCount === 1, `rowCount=${r.rowCount}`);
    await c3.query("ROLLBACK"); // ← ROLLBACK · no persistent change
  } finally { c3.release(); }

  // D. runtime raw (no SET LOCAL ROLE) attempting direct write · should be denied via missing grants
  const c4 = await runtimePool.connect();
  try {
    await c4.query("BEGIN");
    const cu = await c4.query("SELECT current_user");
    T("8.D · raw runtime current_user = nex_app_runtime (no SET LOCAL ROLE)",
      cu.rows[0].current_user === "nex_app_runtime", `actual=${cu.rows[0].current_user}`);
    // nex_app_runtime inherits brain_app + social_app, so it DOES have grants — this is expected working behavior post-Phase12
    // The negative security test we need is: raw runtime cannot EXECUTE persist_to_food_business
    let execDenied = false;
    try {
      await c4.query(`SELECT nex_workforce.persist_to_food_business(NULL, gen_random_uuid(), 1, 'x', now(), 'overpass', 'node/1', '{}'::jsonb)`);
      execDenied = false;
    } catch (e) {
      execDenied = /permission denied/i.test(e.message);
    }
    T("8.D · raw runtime CANNOT EXECUTE persist_to_food_business (Slice 3 gate holds)",
      execDenied, execDenied ? "correctly denied · Slice 3 not applied" : "UNEXPECTED · EXECUTE succeeded pre-Slice-3");
    await c4.query("ROLLBACK");
  } finally { c4.release(); }
} finally {
  await runtimePool.end();
}
console.log("");

// ─── PHASE 9 · Preflight-vs-post-flight integrity delta ─────────────────────
console.log("─── PHASE 9 · Preflight-vs-post-flight integrity delta ───");
T("food_business row count unchanged", post.food_rows === preSnap.food_rows,
  `pre=${preSnap.food_rows} post=${post.food_rows}`);
T("duplicate groups unchanged", post.dup_groups === preSnap.dup_groups,
  `pre=${preSnap.dup_groups} post=${post.dup_groups}`);
T("cycle_run_id FK unchanged", post.cycle_fk === 1);
T("food_business indexes: baseline+1 (added provenance idx only)",
  post.food_indexes === preSnap.food_indexes + 1,
  `pre=${preSnap.food_indexes} post=${post.food_indexes}`);
T("nex_brain_app grants byte-identical", postBrain?.privs === brainGrant?.privs);
T("nex_social_app grants byte-identical", postSocial?.privs === socialGrant?.privs);
console.log("");

// ─── PHASE 10 · Workforce boundary (Scheduled Task + processes) ─────────────
console.log("─── PHASE 10 · Workforce boundary ───");
const psTask = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"],
  { encoding: "utf8" });
const taskState = (psTask.stdout || "").trim();
T("Scheduled Task NEX-Acquisition-Workforce state = Disabled OR absent",
  taskState === "Disabled" || taskState === "", `actual='${taskState}'`);
const psProcs = spawnSync("powershell", ["-NoProfile", "-Command",
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'nex-workforce|nex-acquisition|run-supervisor|_category-walker|run-production' } | ForEach-Object { $_.ProcessId }"],
  { encoding: "utf8" });
const runningPids = (psProcs.stdout || "").trim().split(/\s+/).filter(Boolean);
T(`no workforce/acquisition processes running (found ${runningPids.length})`,
  runningPids.length === 0, runningPids.length ? `PIDs=${runningPids.join(",")}` : "clean");
console.log("");

// ─── PHASE 11 · Final report ────────────────────────────────────────────────
report.summary = { pass, fail, failLines };
writeFileSync("scripts/nex-migration/slice1g-1h-apply-report.json", JSON.stringify(report, null, 2));
console.log(`─── FINAL REPORT · ${pass} pass · ${fail} fail ───`);
if (fail) {
  console.log("\nFailures:");
  for (const l of failLines) console.log("  " + l);
  console.log("\n🔴 APPLY FAILED / PARTIAL — INVESTIGATION REQUIRED");
  console.log("Report written to scripts/nex-migration/slice1g-1h-apply-report.json");
  process.exit(1);
}
console.log("");
console.log("🟢 APPLY SUCCESSFUL — SLICE 1G + 1H R2 ONLY");
console.log("Report written to scripts/nex-migration/slice1g-1h-apply-report.json");
console.log("");
console.log("🛑 HARD STOP · Slice 3 NOT applied · Workforce NOT activated · Scheduled Task remains disabled");
process.exit(0);
