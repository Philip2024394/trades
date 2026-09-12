// Apply Slice 4 (Overpass bbox wiring + safe acquisition boundary) to Project B.
// ============================================================================
// STAGED · NOT YET AUTHORIZED FOR PROJECT B APPLY.
// A separate explicit authorization message with the literal phrase
// "APPLY SLICE 4 TO PROJECT B" is required before this script may be run.
//
// AUTHORIZED SCOPE (once run):
//   Apply supabase/migrations/_slice4_workforce_bbox_wiring.sql
//     · SHA-256 7a6d2167bc135c46636436af0edd32838142d6183fcbeb0189b35933304ba408
//     · exactly 3 coordinated changes:
//         1. ALTER TABLE nex_workforce.work_item ADD COLUMN bbox_json jsonb
//         2. CREATE OR REPLACE VIEW nex_workforce.rotation_eligible (add bbox_json)
//         3. CREATE OR REPLACE FUNCTION nex_workforce.enqueue_from_view
//            (populate bbox_json into new work_items)
//     · zero role/policy/RLS/grant/trigger/index change
//     · zero data mutation
//
// NOT AUTHORIZED (structurally excluded):
//   any ALTER ROLE / GRANT / REVOKE · any RLS policy change · any other
//   function/table/trigger/index change · application code · .env.local ·
//   Scheduled Task · workforce activation · real Overpass acquisition run.
//
// Flow: preflight → atomic apply → postflight → HARD STOP.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];

const EXPECTED_SHA   = "7a6d2167bc135c46636436af0edd32838142d6183fcbeb0189b35933304ba408";
const EXPECTED_BYTES = 16076;
const MIG_PATH       = "supabase/migrations/_slice4_workforce_bbox_wiring.sql";

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
function hardStop(reason, code = 2) {
  console.log(`\n🔴 HARD STOP · ${reason}`);
  console.log(`Failures: ${fail}. Aborting.`);
  writeReport(false);
  process.exit(code);
}
const report = { started_at: new Date().toISOString(), phases: {} };
function writeReport(finalOK) {
  try { mkdirSync("scripts/nex-migration/reports", { recursive: true }); } catch {}
  report.finished_at = new Date().toISOString();
  report.final_ok = finalOK; report.pass = pass; report.fail = fail;
  const path = `scripts/nex-migration/reports/slice4-apply-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path}`);
}

// Authorization guard · refuse to run without the exact literal env
if (process.env.NEX_SLICE4_AUTHORIZED !== "APPLY SLICE 4 TO PROJECT B") {
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log(" NEX Slice 4 · Project B APPLY (bbox wiring · staged · UNAUTHORIZED)");
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log("🔴 REFUSING TO RUN · env NEX_SLICE4_AUTHORIZED does not match.");
  console.log("");
  console.log("This script requires the exact env var:");
  console.log("  NEX_SLICE4_AUTHORIZED='APPLY SLICE 4 TO PROJECT B'");
  console.log("");
  console.log("Set only after Philip's explicit authorization message with that");
  console.log("literal phrase. Never source this env var from .env.local or any");
  console.log("automation · it must be inline at the shell where you invoke node.");
  console.log("");
  console.log("Example (bash · after receiving explicit authorization):");
  console.log("  NEX_SLICE4_AUTHORIZED='APPLY SLICE 4 TO PROJECT B' \\");
  console.log("    node scripts/nex-migration/apply-slice4-bbox.mjs");
  console.log("");
  process.exit(0);
}

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(" NEX Slice 4 · Project B APPLY (bbox wiring · one atomic TX · +1 column)");
console.log("═══════════════════════════════════════════════════════════════════════\n");

// ─── FILE INTEGRITY ───────────────────────────────────────────────────────
console.log("─── FILE INTEGRITY (independent recompute) ───");
const migSrc = readFileSync(MIG_PATH, "utf8");
const migSha = createHash("sha256").update(migSrc).digest("hex");
const migBytes = Buffer.byteLength(migSrc, "utf8");
console.log(`  file:   ${MIG_PATH}`);
console.log(`  bytes:  ${migBytes}`);
console.log(`  sha256: ${migSha}`);
T("SHA-256 matches approved package · 7a6d2167…04ba408", migSha === EXPECTED_SHA,
  migSha === EXPECTED_SHA ? "byte-identical to Slice 4 doctrine" : `expected=${EXPECTED_SHA} actual=${migSha}`);
T(`byte count matches approved package (${EXPECTED_BYTES})`, migBytes === EXPECTED_BYTES, `actual=${migBytes}`);
if (fail > 0) hardStop("File integrity mismatch · not mutating Project B");
report.phases.integrity = { sha: migSha, bytes: migBytes };
console.log("");

// ─── PRE-FLIGHT (READ-ONLY) ───────────────────────────────────────────────
console.log("─── PRE-FLIGHT · READ-ONLY (invariants) ───");
const targetId = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr`))[0];
console.log(`  target · db=${targetId.db} · pg=${targetId.ver} · user=${targetId.usr}`);
T("target = Project B postgres · pg 17.x", targetId.db === "postgres" && /^17\./.test(targetId.ver));

const pre = (await mgmt(`SELECT
  (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex_workforce' AND table_name='work_item' AND column_name='bbox_json') AS wi_bbox_col,
  (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex_workforce' AND table_name='city_catalogue' AND column_name='bbox_json') AS cc_bbox_col,
  CASE WHEN pg_get_viewdef('nex_workforce.rotation_eligible'::regclass) ILIKE '%bbox_json%' THEN 1 ELSE 0 END AS view_bbox,
  CASE WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='enqueue_from_view')) ILIKE '%bbox_json%' THEN 1 ELSE 0 END AS fn_bbox,
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS wf_policies,
  (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
  (SELECT count(*)::int FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='enqueue_from_view' AND r.rolname='nex_workforce_admin') AS enqueue_admin_owned,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_admin') AS admin_bypass,
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi_rows`))[0];
T("Slice 3 R2.2 v2 in place · 11 nex_workforce policies + 5 food_business policies", pre.wf_policies === 11 && pre.food_policies === 5, JSON.stringify(pre));
T("city_catalogue.bbox_json exists (schema prereq)", pre.cc_bbox_col === 1);
T("work_item.bbox_json does NOT yet exist (Slice 4 adds it)", pre.wi_bbox_col === 0);
T("rotation_eligible view does NOT yet reference bbox_json (Slice 4 adds it)", pre.view_bbox === 0);
T("enqueue_from_view does NOT yet populate bbox_json (Slice 4 adds it)", pre.fn_bbox === 0);
T("enqueue_from_view owned by nex_workforce_admin (R2.1 preserved)", pre.enqueue_admin_owned === 1);
T("admin still NOBYPASSRLS", pre.admin_bypass === false);
T("nex.food_business unchanged (22,750 rows)", pre.food_rows === 22750);

const psTaskPre = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], {encoding:"utf8"});
const preTaskState = (psTaskPre.stdout||"").trim();
T("Scheduled Task Disabled OR absent", preTaskState === "Disabled" || preTaskState === "");

if (fail > 0) hardStop("Pre-flight expectation mismatch · not mutating Project B");
report.phases.preflight = { targetId, pre, preTaskState };
console.log("");

// ─── APPLY · single atomic TX · exactly as staged ─────────────────────────
console.log("─── APPLY · Slice 4 · single atomic transaction · exactly as staged ───");
try {
  const t0 = Date.now();
  await mgmt(migSrc);
  const dt = Date.now() - t0;
  T(`Slice 4 committed successfully (${dt} ms)`, true);
  report.phases.apply = { ok: true, duration_ms: dt };
} catch (e) {
  const msg = e.message.split("\n")[0];
  T("Slice 4 apply", false, msg);
  report.phases.apply = { ok: false, error: e.message };
  hardStop(`Slice 4 failed · transaction rolled back · pre-state preserved · error: ${msg}`);
}
console.log("");

// ─── POST-FLIGHT · READ-ONLY ─────────────────────────────────────────────
console.log("─── POST-FLIGHT · READ-ONLY ───");
const post = (await mgmt(`SELECT
  (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex_workforce' AND table_name='work_item' AND column_name='bbox_json') AS wi_bbox_col,
  (SELECT is_nullable FROM information_schema.columns WHERE table_schema='nex_workforce' AND table_name='work_item' AND column_name='bbox_json') AS wi_bbox_nullable,
  CASE WHEN pg_get_viewdef('nex_workforce.rotation_eligible'::regclass) ILIKE '%bbox_json%' THEN 1 ELSE 0 END AS view_bbox,
  CASE WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='enqueue_from_view')) ILIKE '%bbox_json%' THEN 1 ELSE 0 END AS fn_bbox,
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS wf_policies,
  (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
  (SELECT count(*)::int FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='enqueue_from_view' AND r.rolname='nex_workforce_admin') AS enqueue_admin_owned,
  (SELECT prosecdef FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='enqueue_from_view') AS enqueue_secdef,
  has_schema_privilege('nex_workforce_admin','nex_workforce','CREATE') AS admin_create,
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi_rows,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE bbox_json IS NOT NULL) AS wi_with_bbox`))[0];
T("work_item.bbox_json column exists · NULLABLE", post.wi_bbox_col === 1 && post.wi_bbox_nullable === "YES");
T("rotation_eligible view references bbox_json", post.view_bbox === 1);
T("enqueue_from_view populates bbox_json", post.fn_bbox === 1);
T("enqueue_from_view still SECURITY DEFINER + admin-owned", post.enqueue_secdef === true && post.enqueue_admin_owned === 1);
T("admin CREATE on schema still REVOKED (Slice 3 § 6c invariant preserved)", post.admin_create === false);
T("R2.2 v2 policies unchanged (11 nex_workforce + 5 food_business)", post.wf_policies === 11 && post.food_policies === 5);
T("nex.food_business unchanged (22,750 rows)", post.food_rows === 22750);
T("work_item row count unchanged (existing 1 row not affected · new column NULL for it)",
  post.wi_rows === pre.wi_rows && post.wi_with_bbox === 0);

// Local checks
const psTaskPost = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], {encoding:"utf8"});
const postTaskState = (psTaskPost.stdout||"").trim();
T("Scheduled Task still Disabled OR absent", postTaskState === "Disabled" || postTaskState === "");
report.phases.postflight = { post, postTaskState };

// ─── PRODUCTION DIFF ─────────────────────────────────────────────────────
console.log("");
console.log("─── EXPECTED PRODUCTION CATALOG DIFF ───");
console.log("  BEFORE:  work_item(no bbox_json) · view(no bbox_json) · enqueue_from_view(no bbox_json)");
console.log("  AFTER:   work_item(+ bbox_json jsonb NULL) · view(+ bbox_json SELECT) · enqueue_from_view(+ bbox_json INSERT)");
console.log("  DELTA:");
console.log("    +1 column (nex_workforce.work_item.bbox_json)");
console.log("    +1 view def revision (nex_workforce.rotation_eligible · adds bbox_json)");
console.log("    +1 function def revision (nex_workforce.enqueue_from_view · adds bbox_json)");
console.log("    0 role change · 0 policy change · 0 grant change · 0 other schema change");

// ─── FINAL ───────────────────────────────────────────────────────────────
console.log("");
console.log("═══════════════════════════════════════════════════════════════════════");
if (fail === 0) {
  console.log(`🟢 SLICE 4 APPLIED + VERIFIED · ${pass} checks passed`);
  console.log("🔴 HARD STOP · CONTROLLED REAL-OVERPASS PROVING is a SEPARATE gate");
  console.log("   (do NOT enable Scheduled Task · do NOT ramp capacity)");
  console.log("═══════════════════════════════════════════════════════════════════════");
  writeReport(true);
  process.exit(0);
} else {
  console.log(`🔴 HARD STOP · ${fail} failures`);
  for (const l of failLines) console.log("   " + l);
  console.log("═══════════════════════════════════════════════════════════════════════");
  writeReport(false);
  process.exit(3);
}
