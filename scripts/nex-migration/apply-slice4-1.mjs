// Apply Slice 4.1 (pgcrypto extensions.digest schema-resolution fix) to Project B.
// ============================================================================
// AUTHORIZED SCOPE (once run):
//   Rename + apply supabase/migrations/_slice4_1_pgcrypto_schema_fix.sql
//     · SHA-256 a533b5e01ea1a52658ab9f28e72ff00ff53618664bb0d525db746b1dbf0fc910
//     · exactly the design that was portable-validated 336/336 with production-
//       shape NOSUPERUSER rehearsal 21/21 pass on 2026-09-04
//     · surgical fix: 3 call sites rewritten to `extensions.digest(...)` +
//       2 idempotent USAGE grants to persister + admin roles
//     · zero role/policy/RLS/table/column/signature/owner/search_path changes
//     · zero data mutation
//
// NOT AUTHORIZED (structurally excluded):
//   any ALTER ROLE, any other function/table/policy/RLS/grant change,
//   application code, .env.local, System A, Scheduled Task activation,
//   workforce activation, Gate 5A, retry of the failed work item.
//
// Flow: preflight → rename → atomic apply (migration self-asserts) → postflight
// READ-ONLY verification → HARD STOP.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];

const EXPECTED_SHA   = "35f7990083d2b732ad4a54d5d17bc1bd598d6c3de950e2b4dc03a0f3cf05f4dc";
const EXPECTED_BYTES = 29566;
const SRC_PATH       = "supabase/migrations/_slice4_1_pgcrypto_schema_fix.sql";
// Date-prefixed target · unique + does not collide with existing migrations
// (latest date-prefixed 20260831 · this is 20260904 = later + suffix)
const NEW_PATH       = "supabase/migrations/20260904130400_nex_workforce_slice4_1_pgcrypto_schema_fix.sql";

async function mgmt(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (r.status >= 400) throw new Error(`mgmt ${r.status}: ${t}`);
  return t ? JSON.parse(t) : [];
}

let pass = 0, fail = 0;
const failLines = [];
function T(label, ok, detail) {
  const g = ok ? "✓" : "❌";
  const line = `${g} ${label}${detail ? ` · ${detail}` : ""}`;
  console.log(line);
  if (ok) pass++; else { fail++; failLines.push(line); }
}

const report = { started_at: new Date().toISOString(), phases: {} };
function writeReport(finalOK) {
  try { mkdirSync("scripts/nex-migration/reports", { recursive: true }); } catch {}
  report.finished_at = new Date().toISOString();
  report.final_ok = finalOK; report.pass = pass; report.fail = fail;
  const path = `scripts/nex-migration/reports/slice4-1-apply-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path}`);
}

function hardStop(reason, code = 2) {
  console.log(`\n🔴 HARD STOP · ${reason}`);
  console.log(`Failures: ${fail}. Aborting.`);
  writeReport(false);
  process.exit(code);
}

// ═══ Authorization guard ═══
if (process.env.NEX_SLICE4_1_AUTHORIZED !== "APPLY SLICE 4.1 TO PROJECT B") {
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log(" NEX Slice 4.1 · Project B APPLY (pgcrypto schema fix · UNAUTHORIZED)");
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log("🔴 REFUSING TO RUN · env NEX_SLICE4_1_AUTHORIZED does not match.");
  console.log("");
  console.log("This script requires the exact env var:");
  console.log('  NEX_SLICE4_1_AUTHORIZED="APPLY SLICE 4.1 TO PROJECT B"');
  process.exit(3);
}

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(" NEX Slice 4.1 · Project B APPLY (pgcrypto extensions.digest fix)");
console.log("═══════════════════════════════════════════════════════════════════════");

// ═══ SHA verification (Item 4) ═══
console.log("\n─── § 1 · SHA verification ───");
const src = readFileSync(SRC_PATH);
const actualSha = createHash("sha256").update(src).digest("hex");
T("§ 1 · file SHA-256 matches reviewed Slice 4.1", actualSha === EXPECTED_SHA, `${actualSha}`);
T("§ 1 · file byte length matches reviewed Slice 4.1", src.length === EXPECTED_BYTES, `${src.length} bytes`);
if (fail > 0) hardStop("SHA/bytes mismatch · refusing to apply", 4);
report.phases.sha = { expected: EXPECTED_SHA, actual: actualSha, bytes: src.length };

// ═══ Target verification (Items 1, 2, 3) ═══
console.log("\n─── § 2 · Target + PostgreSQL version confirmation ───");
const tgt = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS pg, current_user AS caller`))[0];
console.log(`  target · db=${tgt.db} · pg=${tgt.pg} · caller=${tgt.caller}`);
T("§ 2 · target = Project B postgres (via project ref)", tgt.db === "postgres" && tgt.caller === "postgres", `ref=${REF}`);
T("§ 2 · PostgreSQL 17.6 confirmed", tgt.pg === "17.6", tgt.pg);
report.phases.target = tgt;
report.phases.target.ref = REF;

// ═══ Preflight production-state confirmation (Item 3, Item 5) ═══
console.log("\n─── § 3 · Preflight · current production state matches design ───");
const before = (await mgmt(`
  SELECT
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS wi_active,
    (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%nex_workforce%') AS wf_sessions,
    (SELECT count(*)::int FROM nex.food_business) AS food_rows,
    (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup_groups,
    (SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto') AS pgcrypto_schema,
    (SELECT pg_get_functiondef(p.oid) ~ 'public\\.digest\\s*\\(' FROM pg_proc p WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='persist_to_food_business') AS persister_has_public,
    (SELECT pg_get_functiondef(p.oid) ~ 'extensions\\.digest\\s*\\(' FROM pg_proc p WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='persist_to_food_business') AS persister_has_ext,
    (SELECT pg_get_functiondef(p.oid) ~ 'public\\.digest\\s*\\(' FROM pg_proc p WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='_crockford5') AS crockford_has_public,
    (SELECT pg_get_functiondef(p.oid) ~ 'extensions\\.digest\\s*\\(' FROM pg_proc p WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='_crockford5') AS crockford_has_ext,
    (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='evidence_id_consistency' AND conrelid='nex_workforce.evidence_record'::regclass) AS check_def,
    (SELECT prosecdef FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS persister_secdef,
    (SELECT r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='persist_to_food_business') AS persister_owner,
    (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies_count,
    (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS wf_policies_count
`))[0];
console.log(`  state · ${JSON.stringify(before, null, 2).replace(/\n/g, '\n  ')}`);
T("§ 3 · workforce OFF · wi_active=0", before.wi_active === 0, `${before.wi_active}`);
T("§ 3 · zero workforce sessions", before.wf_sessions === 0, `${before.wf_sessions}`);
T("§ 3 · food_business baseline = 22,750", before.food_rows === 22750, `${before.food_rows}`);
T("§ 3 · duplicate groups baseline = 373", before.food_dup_groups === 373, `${before.food_dup_groups}`);
T("§ 3 · pgcrypto in `extensions` (Supabase convention)", before.pgcrypto_schema === "extensions", before.pgcrypto_schema);
T("§ 3 · pre-apply · persist_to_food_business still contains public.digest", before.persister_has_public === true, "as expected");
T("§ 3 · pre-apply · persist_to_food_business does not yet contain extensions.digest", before.persister_has_ext === false, "as expected");
T("§ 3 · pre-apply · _crockford5 still contains public.digest", before.crockford_has_public === true, "as expected");
T("§ 3 · pre-apply · _crockford5 does not yet contain extensions.digest", before.crockford_has_ext === false, "as expected");
T("§ 3 · pre-apply · evidence_id_consistency still uses bare digest", /encode\(digest\(/.test(before.check_def) && !/extensions\.digest/.test(before.check_def), "matches design");
T("§ 3 · persist_to_food_business SECDEF=true", before.persister_secdef === true, `${before.persister_secdef}`);
T("§ 3 · persist_to_food_business owner = nex_workforce_persister_food_business", before.persister_owner === "nex_workforce_persister_food_business", before.persister_owner);
T("§ 3 · food_business policies count = 5 (Slice 1h R4 posture)", before.food_policies_count === 5, `${before.food_policies_count}`);
T("§ 3 · nex_workforce policies count = 11 (Slice 3 R2.2 v2 posture)", before.wf_policies_count === 11, `${before.wf_policies_count}`);
if (fail > 0) hardStop("Preflight state does not match design · refusing to apply", 5);
report.phases.preflight = before;

// ═══ Rename to date-prefixed name (Item 3 in EXECUTION) ═══
console.log("\n─── § 4 · Rename to date-prefixed Supabase migration filename ───");
if (existsSync(NEW_PATH)) {
  T("§ 4 · date-prefixed target does not already exist", false, `${NEW_PATH} exists · abort`);
  hardStop("date-prefixed target already exists", 6);
}
renameSync(SRC_PATH, NEW_PATH);
T("§ 4 · renamed", true, `${SRC_PATH} → ${NEW_PATH}`);
// Verify SHA identical after rename
const renamed = readFileSync(NEW_PATH);
const renamedSha = createHash("sha256").update(renamed).digest("hex");
T("§ 4 · post-rename SHA unchanged", renamedSha === EXPECTED_SHA, renamedSha);
if (fail > 0) hardStop("rename broke content · abort", 7);
report.phases.rename = { from: SRC_PATH, to: NEW_PATH, sha: renamedSha };

// ═══ ATOMIC APPLY (Item 6, 7) ═══
console.log("\n─── § 5 · Atomic apply via Supabase Management API ───");
console.log("  Migration has its own BEGIN/COMMIT · self-asserting preflight + postflight");
const t0 = Date.now();
let commitOk = false;
try {
  const sql = renamed.toString("utf8");
  await mgmt(sql);
  commitOk = true;
} catch (e) {
  T("§ 5 · atomic apply", false, `mgmt error: ${e.message}`);
  report.phases.apply = { ok: false, error: e.message, ms: Date.now() - t0 };
  // Migration was atomic · postflight assertion inside BEGIN/COMMIT would have
  // rolled back. Nothing to unwind on Project B.
  hardStop("Migration failed · transaction rolled back inside PG · no state mutation on Project B", 8);
}
const applyMs = Date.now() - t0;
T("§ 5 · atomic apply", commitOk, `commit in ${applyMs}ms`);
report.phases.apply = { ok: commitOk, ms: applyMs, committed_at: new Date().toISOString() };

// ═══ POST-APPLY READ-ONLY VERIFICATION (Items 8-19) ═══
console.log("\n─── § 6 · Post-apply READ-ONLY verification ───");

// PGCRYPTO group
console.log("\n  ── PGCRYPTO ──");
const pg1 = (await mgmt(`SELECT n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto'`))[0];
T("§ 6.1 · pgcrypto exists in schema `extensions`", pg1?.schema === "extensions", pg1?.schema);
const pg2 = (await mgmt(`SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='extensions' AND p.proname='digest'`))[0];
T("§ 6.2 · extensions.digest resolves (both overloads)", pg2.n === 2, `${pg2.n} functions`);
const pg3 = (await mgmt(`SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='digest'`))[0];
T("§ 6.3 · public.digest does not resolve", pg3.n === 0, `${pg3.n} functions`);

// PERSISTER group
console.log("\n  ── PERSISTER CHAIN ──");
const p1 = (await mgmt(`SELECT
  pg_get_functiondef(oid) ~ 'extensions\\.digest\\s*\\(' AS has_ext,
  pg_get_functiondef(oid) ~ 'public\\.digest\\s*\\(' AS has_pub
  FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='_crockford5'`))[0];
T("§ 6.4 · _crockford5 body calls extensions.digest", p1.has_ext === true, "");
T("§ 6.5 · _crockford5 body does NOT call public.digest", p1.has_pub === false, "");
const p2 = (await mgmt(`SELECT
  pg_get_functiondef(oid) ~ 'extensions\\.digest\\s*\\(' AS has_ext,
  pg_get_functiondef(oid) ~ 'public\\.digest\\s*\\(' AS has_pub
  FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business'`))[0];
T("§ 6.6 · persist_to_food_business body calls extensions.digest", p2.has_ext === true, "");
T("§ 6.7 · persist_to_food_business body does NOT call public.digest", p2.has_pub === false, "");
const p3 = (await mgmt(`SELECT pg_get_constraintdef(oid) AS defn FROM pg_constraint WHERE conname='evidence_id_consistency' AND conrelid='nex_workforce.evidence_record'::regclass`))[0];
T("§ 6.8 · evidence_id_consistency CHECK uses extensions.digest", /extensions\.digest/.test(p3.defn), "");
T("§ 6.9 · evidence_id_consistency CHECK does NOT use public.digest", !/public\.digest/.test(p3.defn), "");

// SECURITY group
console.log("\n  ── SECURITY ──");
const s1 = (await mgmt(`SELECT
    p.prosecdef,
    p.proconfig::text AS proconfig,
    r.rolname AS owner
  FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
  WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='persist_to_food_business'`))[0];
T("§ 6.10 · persist_to_food_business remains SECURITY DEFINER", s1.prosecdef === true, `${s1.prosecdef}`);
T("§ 6.11 · persist_to_food_business owner unchanged", s1.owner === "nex_workforce_persister_food_business", s1.owner);
T("§ 6.12 · search_path preserved (pg_catalog + pg_temp) · no public widening",
   /search_path=pg_catalog, pg_temp/.test(s1.proconfig) && !/\bpublic\b/.test(s1.proconfig), s1.proconfig);

const s2 = (await mgmt(`SELECT
    NOT EXISTS (
      SELECT 1 FROM (
        SELECT (aclexplode(proacl)).* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business'
      ) acl WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
    ) AS public_exec_revoked
  `))[0];
T("§ 6.13 · PUBLIC EXECUTE remains revoked on persist_to_food_business", s2.public_exec_revoked === true, "");

const s3 = (await mgmt(`SELECT rolname, rolcanlogin, rolbypassrls, rolsuper
  FROM pg_roles
  WHERE rolname IN ('nex_workforce_persister_food_business','nex_workforce_admin','nex_workforce_app')
  ORDER BY rolname`));
for (const row of s3) {
  T(`§ 6.14 · ${row.rolname} remains NOLOGIN`, row.rolcanlogin === false, `login=${row.rolcanlogin}`);
  T(`§ 6.15 · ${row.rolname} remains NOBYPASSRLS`, row.rolbypassrls === false, `bypass=${row.rolbypassrls}`);
  T(`§ 6.16 · ${row.rolname} remains rolsuper=false`, row.rolsuper === false, `super=${row.rolsuper}`);
}

const s4 = (await mgmt(`SELECT rolname, has_schema_privilege(rolname, 'extensions', 'USAGE') AS ext_usage
  FROM pg_roles
  WHERE rolname IN ('nex_workforce_persister_food_business','nex_workforce_admin','nex_workforce_app','nex_app_runtime')
  ORDER BY rolname`));
const persUsage = s4.find(r => r.rolname === 'nex_workforce_persister_food_business')?.ext_usage;
const adminUsage = s4.find(r => r.rolname === 'nex_workforce_admin')?.ext_usage;
const appUsage = s4.find(r => r.rolname === 'nex_workforce_app')?.ext_usage;
const runtimeUsage = s4.find(r => r.rolname === 'nex_app_runtime')?.ext_usage;
T("§ 6.17 · persister has extensions USAGE (new Slice 4.1 grant · required)", persUsage === true, `${persUsage}`);
T("§ 6.18 · admin has extensions USAGE (new Slice 4.1 grant · required)", adminUsage === true, `${adminUsage}`);
T("§ 6.19 · app role does NOT have extensions USAGE (never granted)", appUsage === false, `${appUsage}`);
T("§ 6.20 · runtime role does NOT have extensions USAGE (never granted)", runtimeUsage === false, `${runtimeUsage}`);

// RLS + policies (Item 15)
console.log("\n  ── RLS / POLICIES ──");
const r1 = (await mgmt(`SELECT
    (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
    (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS wf_policies,
    (SELECT relrowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS food_rls
  `))[0];
T("§ 6.21 · food_business policies count unchanged = 5", r1.food_policies === 5, `${r1.food_policies}`);
T("§ 6.22 · nex_workforce policies count unchanged = 11", r1.wf_policies === 11, `${r1.wf_policies}`);
T("§ 6.23 · food_business RLS still enabled", r1.food_rls === true, `${r1.food_rls}`);

// DATA group (Items 16, 17)
console.log("\n  ── DATA ──");
const d1 = (await mgmt(`SELECT
    (SELECT count(*)::int FROM nex.food_business) AS food_rows,
    (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup_groups
  `))[0];
T("§ 6.24 · food_business = 22,750 (unchanged · zero data mutation)", d1.food_rows === 22750, `${d1.food_rows}`);
T("§ 6.25 · duplicate groups = 373 (unchanged)", d1.food_dup_groups === 373, `${d1.food_dup_groups}`);

// ENVIRONMENT group (Item 18)
console.log("\n  ── ENVIRONMENT ──");
const e1 = (await mgmt(`SELECT
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS wi_active,
    (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%nex_workforce%') AS wf_sessions
  `))[0];
T("§ 6.26 · zero active workforce work_items", e1.wi_active === 0, `${e1.wi_active}`);
T("§ 6.27 · zero workforce sessions", e1.wf_sessions === 0, `${e1.wf_sessions}`);

// .env.local + System A + Scheduled Task (Item 19)
console.log("\n  ── ENV / SYSTEM A / SCHEDULED TASK (local) ──");
try {
  const envLocal = readFileSync(".env.local", "utf8");
  const wfPresent = /nex_workforce/i.test(envLocal);
  T("§ 6.28 · .env.local contains no workforce identifiers", !wfPresent, wfPresent ? "workforce found" : "no workforce identifiers");
  const taxonomyLine = envLocal.match(/NEX_TAXONOMY_POSTGRES_URL=([^\r\n]+)/);
  T("§ 6.29 · NEX_TAXONOMY_POSTGRES_URL still present", !!taxonomyLine, taxonomyLine ? "present" : "MISSING");
} catch (e) {
  T("§ 6.28-29 · .env.local read", false, e.message);
}

// Scheduled Task check (Windows)
try {
  const { spawnSync } = await import("node:child_process");
  const st = spawnSync("powershell", ["-NoProfile","-Command","Get-ScheduledTask -TaskName 'NexWorkforceV2' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty State"], { encoding: "utf8" });
  const state = (st.stdout || "").trim();
  const disabled = state === "" || state.toLowerCase().includes("disabled");
  T("§ 6.30 · Scheduled Task Disabled OR absent", disabled, state || "(absent)");
} catch (e) {
  T("§ 6.30 · Scheduled Task check", false, e.message);
}

report.phases.postflight = { food_rows: d1.food_rows, food_dup_groups: d1.food_dup_groups, wi_active: e1.wi_active, wf_sessions: e1.wf_sessions };

// Final verdict
console.log("\n═══════════════════════════════════════════════════════════════════════");
if (fail === 0) {
  console.log("🟢 SLICE 4.1 · APPLIED + VERIFIED");
  console.log("🔴 GATE 5A · STILL HARD STOPPED");
  console.log("🔴 SCHEDULED TASK · STILL UNAUTHORIZED");
  console.log(`  ${pass} checks passed · 0 failures`);
  writeReport(true);
  process.exit(0);
} else {
  console.log("🔴 SLICE 4.1 · APPLIED but VERIFICATION HAD FAILURES");
  console.log(`  ${pass} passed · ${fail} failed`);
  for (const f of failLines) console.log("    " + f);
  writeReport(false);
  process.exit(9);
}
