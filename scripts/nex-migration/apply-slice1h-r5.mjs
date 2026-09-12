// Apply Slice 1h R5 (multi-city persister hardening) to Project B.
// ============================================================================
// AUTHORIZED SCOPE (once run):
//   Rename + apply supabase/migrations/_slice1h_r5_multi_city_persister.sql
//     · SHA-256 b6d1a8d4f995bfa25377084c20a18d71c9f9950a13de3d22056fe55e73a17b2d
//     · portable-validated 26/26 (5 rehearsal · 21 contract · production-shape probe)
//     · Removes 'Yogyakarta' hardcode from persist_to_food_business
//     · Adds SELECT + policy for persister on city_catalogue
//     · Zero role/RLS-on-food_business/signature/owner/SECDEF/search_path changes
//     · Zero data mutation
//
// NOT AUTHORIZED (structurally excluded):
//   any city_catalogue seeding, job_registry changes, workforce activation,
//   Scheduled Task activation, agent/orchestrator/reaper startup, Gate 5A,
//   application-code changes, environment changes, legacy-workforce touching,
//   orphan-provenance cleanup, unrelated test fixes.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];

const EXPECTED_SHA   = "b6d1a8d4f995bfa25377084c20a18d71c9f9950a13de3d22056fe55e73a17b2d";
const EXPECTED_BYTES = 27686;
const SRC_PATH       = "supabase/migrations/_slice1h_r5_multi_city_persister.sql";
const NEW_PATH       = "supabase/migrations/20260904150000_nex_workforce_slice1h_r5_multi_city_persister.sql";

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
  const path = `scripts/nex-migration/reports/slice1h-r5-apply-${Date.now()}.json`;
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
if (process.env.NEX_R5_AUTHORIZED !== "APPLY SLICE 1H R5 TO PROJECT B") {
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log(" NEX Slice 1h R5 · Project B APPLY (multi-city persister · UNAUTHORIZED)");
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log("🔴 REFUSING TO RUN · env NEX_R5_AUTHORIZED does not match.");
  console.log("");
  console.log("This script requires the exact env var:");
  console.log('  NEX_R5_AUTHORIZED="APPLY SLICE 1H R5 TO PROJECT B"');
  process.exit(3);
}

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(" NEX Slice 1h R5 · Project B APPLY (multi-city persister hardening)");
console.log("═══════════════════════════════════════════════════════════════════════");

// ═══ SHA verification ═══
console.log("\n─── § 1 · SHA verification ───");
const src = readFileSync(SRC_PATH);
const actualSha = createHash("sha256").update(src).digest("hex");
T("§ 1 · file SHA-256 matches reviewed R5", actualSha === EXPECTED_SHA, actualSha);
T("§ 1 · file byte length matches", src.length === EXPECTED_BYTES, `${src.length} bytes`);
if (fail > 0) hardStop("SHA/bytes mismatch · refusing to apply", 4);
report.phases.sha = { expected: EXPECTED_SHA, actual: actualSha, bytes: src.length };

// ═══ Target + Preflight (Section 14) ═══
console.log("\n─── § 2 · Target confirmation ───");
const tgt = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS pg, current_user AS caller`))[0];
console.log(`  target · db=${tgt.db} · pg=${tgt.pg} · caller=${tgt.caller}`);
T("§ 2 · target = Project B postgres", tgt.db === "postgres" && tgt.caller === "postgres", `ref=${REF}`);
T("§ 2 · PostgreSQL 17.6", tgt.pg === "17.6", tgt.pg);
report.phases.target = { ...tgt, ref: REF };

console.log("\n─── § 3 · Preflight (17 invariants per Section 14) ───");
const before = (await mgmt(`SELECT
  (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS cities,
  (SELECT count(*)::int FROM nex_workforce.job_registry) AS jobs,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi_total,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS wi_active,
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup_groups,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS wf_policies,
  (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
  (SELECT prosecdef FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS persister_secdef,
  (SELECT (SELECT rolname FROM pg_roles WHERE oid=proowner) FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS persister_owner,
  (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%nex_workforce%' OR application_name ILIKE '%acquisition%') AS wf_sessions,
  -- R5 pre-state: persister body must currently contain literal 'Yogyakarta'
  (SELECT pg_get_functiondef(oid) ~ E'VALUES[^;]*''Yogyakarta''' FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS pre_has_hardcode,
  -- R5 pre-state: persister must NOT yet have SELECT on city_catalogue
  (SELECT has_table_privilege('nex_workforce_persister_food_business', 'nex_workforce.city_catalogue', 'SELECT')) AS pre_persister_cc_select,
  (SELECT has_schema_privilege('nex_workforce_persister_food_business', 'extensions', 'USAGE')) AS persister_ext_usage
`))[0];
console.log("  state:", JSON.stringify(before, null, 2));
T("§ 3 · city_catalogue = 0", before.cities === 0, `${before.cities}`);
T("§ 3 · job_registry = 1", before.jobs === 1, `${before.jobs}`);
T("§ 3 · work_item total = 2", before.wi_total === 2, `${before.wi_total}`);
T("§ 3 · active work_items = 0", before.wi_active === 0, `${before.wi_active}`);
T("§ 3 · food_business = 23,046", before.food_rows === 23046, `${before.food_rows}`);
T("§ 3 · duplicate groups = 373", before.food_dup_groups === 373, `${before.food_dup_groups}`);
T("§ 3 · evidence_record = 4", before.ev === 4, `${before.ev}`);
T("§ 3 · candidate_staging = 1,284", before.stg === 1284, `${before.stg}`);
T("§ 3 · persist_audit = 5", before.aud === 5, `${before.aud}`);
T("§ 3 · workforce policies = 11", before.wf_policies === 11, `${before.wf_policies}`);
T("§ 3 · food policies = 5", before.food_policies === 5, `${before.food_policies}`);
T("§ 3 · persister SECDEF = true", before.persister_secdef === true, `${before.persister_secdef}`);
T("§ 3 · persister owner unchanged", before.persister_owner === "nex_workforce_persister_food_business", before.persister_owner);
T("§ 3 · zero workforce sessions", before.wf_sessions === 0, `${before.wf_sessions}`);
T("§ 3 · PRE-state: persister has hardcoded 'Yogyakarta'", before.pre_has_hardcode === true, "as expected (R4 state)");
T("§ 3 · PRE-state: persister does NOT yet have SELECT on city_catalogue", before.pre_persister_cc_select === false, "as expected");
T("§ 3 · persister has extensions USAGE (Slice 4.1 v2)", before.persister_ext_usage === true, "as expected");
if (fail > 0) hardStop("Preflight state does not match design", 5);
report.phases.preflight = before;

// ═══ Rename to date-prefixed name ═══
console.log("\n─── § 4 · Rename to date-prefixed Supabase migration filename ───");
if (existsSync(NEW_PATH)) hardStop("date-prefixed target already exists", 6);
renameSync(SRC_PATH, NEW_PATH);
const renamed = readFileSync(NEW_PATH);
const renamedSha = createHash("sha256").update(renamed).digest("hex");
T("§ 4 · renamed", true, `${SRC_PATH} → ${NEW_PATH}`);
T("§ 4 · post-rename SHA unchanged", renamedSha === EXPECTED_SHA, renamedSha);
if (fail > 0) hardStop("rename broke content", 7);
report.phases.rename = { from: SRC_PATH, to: NEW_PATH, sha: renamedSha };

// ═══ APPLY ═══
console.log("\n─── § 5 · Atomic apply via Supabase Management API ───");
console.log("  Migration has its own BEGIN/COMMIT · self-asserting preflight + postflight");
const t0 = Date.now();
try {
  await mgmt(renamed.toString("utf8"));
} catch (e) {
  T("§ 5 · atomic apply", false, `mgmt error: ${e.message}`);
  report.phases.apply = { ok: false, error: e.message };
  hardStop("Migration failed · transaction rolled back inside PG · no state mutation on Project B", 8);
}
const applyMs = Date.now() - t0;
T("§ 5 · atomic apply", true, `commit in ${applyMs}ms`);
report.phases.apply = { ok: true, ms: applyMs, committed_at: new Date().toISOString() };

// ═══ Postflight verification ═══
console.log("\n─── § 6 · Post-apply READ-ONLY verification ───");

const post = (await mgmt(`SELECT
  -- Persister body
  (SELECT pg_get_functiondef(oid) ~ E'VALUES[^;]*''Yogyakarta''' FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS post_has_hardcode,
  (SELECT pg_get_functiondef(oid) ~ 'v_wi_row\\.city_slug' FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS post_has_city_slug,
  (SELECT pg_get_functiondef(oid) ~ 'nex_workforce\\.city_catalogue' FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS post_has_cc,
  (SELECT pg_get_functiondef(oid) ~ 'extensions\\.digest' FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS post_has_ext,
  (SELECT pg_get_functiondef(oid) ~ 'public\\.digest' FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS post_has_pub,
  -- Security posture preserved
  (SELECT prosecdef FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS post_secdef,
  (SELECT (SELECT rolname FROM pg_roles WHERE oid=proowner) FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS post_owner,
  (SELECT proconfig::text FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS post_config,
  (SELECT NOT EXISTS (
    SELECT 1 FROM (SELECT (aclexplode(proacl)).* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business') acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  )) AS post_pub_revoked,
  -- R5 grants + policy
  (SELECT has_table_privilege('nex_workforce_persister_food_business', 'nex_workforce.city_catalogue', 'SELECT')) AS post_persister_cc_select,
  (SELECT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='nex_workforce.city_catalogue'::regclass AND polname='wp_food_business_city_catalogue_select')) AS post_policy_exists,
  (SELECT NOT has_schema_privilege('nex_workforce_persister_food_business', 'nex_workforce', 'CREATE')) AS post_no_create,
  -- Data preservation
  (SELECT count(*)::int FROM nex.food_business) AS post_food,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS post_dup,
  (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS post_cities,
  (SELECT count(*)::int FROM nex_workforce.job_registry) AS post_jobs,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS post_wi_total,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS post_wi_active,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS post_ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS post_stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS post_aud,
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS post_wf_pol,
  (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS post_food_pol,
  (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%nex_workforce%' OR application_name ILIKE '%acquisition%') AS post_sessions
`))[0];

console.log("\n  ── STATIC PERSISTER BODY ──");
T("§ 6.1 · persister body contains v_wi_row.city_slug", post.post_has_city_slug === true, "");
T("§ 6.2 · persister body contains nex_workforce.city_catalogue", post.post_has_cc === true, "");
T("§ 6.3 · persister body contains extensions.digest (Slice 4.1 v2 preserved)", post.post_has_ext === true, "");
T("§ 6.4 · persister body does NOT contain public.digest", post.post_has_pub === false, "");
T("§ 6.5 · persister body has NO hardcoded 'Yogyakarta' in INSERT VALUES", post.post_has_hardcode === false, "R5 goal achieved");

console.log("\n  ── SECURITY POSTURE ──");
T("§ 6.6 · SECURITY DEFINER preserved", post.post_secdef === true, "");
T("§ 6.7 · owner preserved (persister)", post.post_owner === "nex_workforce_persister_food_business", post.post_owner);
T("§ 6.8 · hardened search_path preserved", /search_path=pg_catalog, pg_temp/.test(post.post_config) && !/\bpublic\b/.test(post.post_config), post.post_config);
T("§ 6.9 · PUBLIC EXECUTE remains revoked", post.post_pub_revoked === true, "");
T("§ 6.10 · persister has no CREATE on schema (runtime USAGE-only)", post.post_no_create === true, "");

console.log("\n  ── R5 GRANTS + POLICY ──");
T("§ 6.11 · persister has SELECT on city_catalogue (R5 grant)", post.post_persister_cc_select === true, "");
T("§ 6.12 · wp_food_business_city_catalogue_select policy exists", post.post_policy_exists === true, "");

console.log("\n  ── DATA + STATE PRESERVATION ──");
T("§ 6.13 · food_business = 23,046 (unchanged)", post.post_food === 23046, `${post.post_food}`);
T("§ 6.14 · duplicate groups = 373 (unchanged)", post.post_dup === 373, `${post.post_dup}`);
T("§ 6.15 · city_catalogue = 0 (unchanged · C6 remains gated)", post.post_cities === 0, `${post.post_cities}`);
T("§ 6.16 · job_registry = 1 (C5 preserved)", post.post_jobs === 1, `${post.post_jobs}`);
T("§ 6.17 · work_item total = 2 (unchanged)", post.post_wi_total === 2, `${post.post_wi_total}`);
T("§ 6.18 · active work_items = 0 (unchanged)", post.post_wi_active === 0, `${post.post_wi_active}`);
T("§ 6.19 · evidence_record = 4 (unchanged)", post.post_ev === 4, `${post.post_ev}`);
T("§ 6.20 · candidate_staging = 1,284 (unchanged)", post.post_stg === 1284, `${post.post_stg}`);
T("§ 6.21 · persist_audit = 5 (unchanged)", post.post_aud === 5, `${post.post_aud}`);
T("§ 6.22 · workforce policies = 12 (11 + R5's new city_catalogue policy)", post.post_wf_pol === 12, `${post.post_wf_pol}`);
T("§ 6.23 · food_business policies = 5 (unchanged)", post.post_food_pol === 5, `${post.post_food_pol}`);
T("§ 6.24 · zero workforce sessions (no activation)", post.post_sessions === 0, `${post.post_sessions}`);

report.phases.postflight = post;

// Final verdict
console.log("\n═══════════════════════════════════════════════════════════════════════");
if (fail === 0) {
  console.log("🟢 SLICE 1H R5 · APPLIED + VERIFIED");
  console.log("🔴 C6 STILL BLOCKED (per Philip · separate authorization)");
  console.log("🔴 WORKFORCE STILL OFF · SCHEDULED TASK STILL DISABLED");
  console.log(`  ${pass} checks passed · 0 failures`);
  writeReport(true);
  process.exit(0);
} else {
  console.log(`🔴 SLICE 1H R5 · VERIFICATION HAD FAILURES · ${pass} passed · ${fail} failed`);
  for (const f of failLines) console.log("    " + f);
  writeReport(false);
  process.exit(9);
}
