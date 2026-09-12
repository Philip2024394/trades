#!/usr/bin/env node
// Path A · GRANT service_role → temp role · re-run Batch 1 with --role=service_role.
// Strict pre-flight: if service_role does NOT have BYPASSRLS, HARD STOP without granting.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const DB_URL = envText.match(/^NEX_SUPABASE_DB_URL=(.+)$/m)[1];
const TEMP_ROLE = DB_URL.match(/postgresql:\/\/([^.]+)\./)[1]; // extract role from URI (nex_migrate_xxx)
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const BACKUP = "D:/nex-backups/nex_dev-2026-09-03-0230-post-enum-fix.dump";
const LIST_FILE = resolve(__dirname, "batch-01-tiny.list");
const LOG_FILE = resolve(__dirname, "batch-01-pathA.log");
const PG_RESTORE = "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe";
const PSQL = "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";

const BATCH1_TABLES = ["alert_dispatches","alert_rules","alerts","audit_log","benchmark_runs","bike_rental_listing","brain_user_saved_facts","call_record","campaign_segments","chat_message","chat_message_archive","chat_message_deletion","compliance_events","contact_segments","conv_intents","conversion_events","cost_budget","delivery_workers_archive_2026_08_22","email_templates","events","experiment_variants","experiments","food_business_promotion_decision","food_claim_code","food_commercial_event","food_hq_rule","food_outreach_attempt","food_outreach_suppression","food_outreach_template","geo_landmark","journey_inbound_events","journey_triggers","journeys","knowledge_inbox_stats","meaningful_area","mp_commerce_policy","mp_product","mp_product_image","mp_product_option","mp_product_option_value","mp_product_variant","object_blob_current","prediction_models","predictive_controls","provider_rate_config","provider_registry","provider_wallet","recovery_runs","rollup_campaigns","rollup_country","rollup_daily","rollup_monthly","rollup_provider","rollup_segment","safety_audit_config","social_admin_access_log","social_category_automation","social_controls","sparks_product","sparks_product_price","user_wallet","worker_heartbeats_archive_2026_08_22"];
const EXPECTED = {alert_dispatches:12,alert_rules:14,alerts:4,audit_log:9,benchmark_runs:1,bike_rental_listing:9,brain_user_saved_facts:1,call_record:1,campaign_segments:4,chat_message:70,chat_message_archive:20,chat_message_deletion:20,compliance_events:14,contact_segments:12,conv_intents:22,conversion_events:2,cost_budget:4,delivery_workers_archive_2026_08_22:1,email_templates:8,events:2,experiment_variants:2,experiments:1,food_business_promotion_decision:1,food_claim_code:1,food_commercial_event:6,food_hq_rule:10,food_outreach_attempt:5,food_outreach_suppression:1,food_outreach_template:4,geo_landmark:34,journey_inbound_events:3,journey_triggers:1,journeys:3,knowledge_inbox_stats:2,meaningful_area:6,mp_commerce_policy:1,mp_product:5,mp_product_image:5,mp_product_option:11,mp_product_option_value:24,mp_product_variant:15,object_blob_current:22,prediction_models:2,predictive_controls:1,provider_rate_config:7,provider_registry:5,provider_wallet:7,recovery_runs:4,rollup_campaigns:5,rollup_country:10,rollup_daily:2,rollup_monthly:1,rollup_provider:5,rollup_segment:1,safety_audit_config:1,social_admin_access_log:87,social_category_automation:66,social_controls:1,sparks_product:3,sparks_product_price:6,user_wallet:65,worker_heartbeats_archive_2026_08_22:50};
const EXPECTED_TOTAL = Object.values(EXPECTED).reduce((a,b)=>a+b,0);

writeFileSync(LOG_FILE, "");
function scrub(s) { const pw = DB_URL.split("@")[0].split(":").pop(); return String(s).split(pw).join("<PASSWORD>"); }
function log(m) { const s = `[${new Date().toISOString()}] ${m}\n`; appendFileSync(LOG_FILE, scrub(s)); process.stderr.write(scrub(m + "\n")); }

async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}
function bail(msg) { log(`❌ HARD STOP · ${msg}`); process.exit(2); }

log(`=== BATCH 1 · PATH A · GRANT service_role → temp + re-run with --role=service_role ===`);
log(`temp role: ${TEMP_ROLE}`);

// =========================== PRE-FLIGHT ============================
log("\n─── PRE-FLIGHT ───");

// 1. Target identity
const proj = await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  target: ${proj.id} · ${proj.name} · ${proj.region} · ${proj.status}`);
if (proj.id !== "ijvqdvsvwtwxzcqmoqit") bail("wrong target project");
if (proj.region !== "eu-west-1") bail("wrong region");

// 2. service_role BYPASSRLS check (THE CRITICAL GATE)
const srCheck = await q(`SELECT rolname, rolbypassrls, rolcanlogin, rolsuper FROM pg_roles WHERE rolname='service_role'`);
log(`  service_role: ${JSON.stringify(srCheck.body)}`);
if (!Array.isArray(srCheck.body) || srCheck.body.length === 0) bail("service_role role does not exist");
const sr = srCheck.body[0];
if (sr.rolbypassrls !== true) bail(`service_role.rolbypassrls = ${sr.rolbypassrls} · MUST be true to proceed`);
log(`  ✓ service_role has BYPASSRLS = true`);

// 3. Temp role exists
const tempCheck = await q(`SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname='${TEMP_ROLE}'`);
if (!Array.isArray(tempCheck.body) || tempCheck.body.length === 0) bail(`temp role ${TEMP_ROLE} does not exist`);
log(`  ✓ temp role ${TEMP_ROLE} exists: ${JSON.stringify(tempCheck.body[0])}`);

// 4. Nothing changed since failed attempt
const invariants = await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r') AS nex_tables,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls_enabled,
    (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex') AS rls_policies,
    (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS nex_fks,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables,
    (SELECT count(*) FROM public.knowledge_records) AS kr,
    (SELECT count(*) FROM public.worker_jobs) AS wj,
    (SELECT count(*) FROM public.worker_results) AS wr,
    pg_database_size(current_database()) AS db_bytes,
    pg_size_pretty(pg_database_size(current_database())) AS db_pretty,
    pg_current_wal_lsn()::text AS wal_lsn
`);
const inv = invariants.body[0];
log(`  invariants: ${JSON.stringify(inv)}`);
if (inv.nex_tables !== 191) bail(`nex_tables = ${inv.nex_tables} (expected 191)`);
if (inv.rls_enabled !== 92) bail(`RLS-enabled changed: ${inv.rls_enabled} (expected 92)`);
if (inv.rls_policies !== 140) bail(`RLS policies changed: ${inv.rls_policies} (expected 140)`);
if (Number(inv.nex_fks) !== 0) bail(`FK count changed: ${inv.nex_fks} (expected 0)`);
if (inv.public_tables !== 17) bail(`public tables changed: ${inv.public_tables}`);
if (inv.kr !== 3627 || inv.wj !== 19167 || inv.wr !== 19140) bail(`public row counts changed`);

// 5. All 191 nex tables empty (spot-check via sum)
const nexEmpty = await q(`SELECT sum(n_live_tup) AS n FROM pg_stat_user_tables WHERE schemaname='nex'`);
// n_live_tup may lag; use SELECT COUNT for a canonical sample
const sample = await q(`SELECT (SELECT count(*) FROM nex.alert_dispatches) AS a, (SELECT count(*) FROM nex.identity_merge_log) AS b, (SELECT count(*) FROM nex.food_business) AS c`);
log(`  sample nex counts (must all be 0): ${JSON.stringify(sample.body[0])}`);
if (Object.values(sample.body[0]).some(v => Number(v) !== 0)) bail("nex tables not empty");

// 6. Readonly OFF
const readonly = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  readonly: enabled=${readonly.enabled}`);
if (readonly.enabled) bail("readonly mode is enabled");

const preState = { db_bytes: inv.db_bytes, db_pretty: inv.db_pretty, wal_lsn: inv.wal_lsn };
log(`\n─── PRE-FLIGHT PASSED · granting service_role membership ───`);

// =========================== SINGLE GRANT ============================
const grantRes = await q(`GRANT service_role TO ${TEMP_ROLE};`);
if (grantRes.status < 300) log(`  ✓ GRANT service_role TO ${TEMP_ROLE} · HTTP ${grantRes.status}`);
else bail(`GRANT failed: ${JSON.stringify(grantRes.body).slice(0, 300)}`);

// Verify grant exists
const memberCheck = await q(`SELECT pg_has_role('${TEMP_ROLE}', 'service_role', 'member') AS is_member`);
log(`  is_member of service_role: ${memberCheck.body[0]?.is_member}`);
if (memberCheck.body[0]?.is_member !== true) bail("membership not effective");

// Verify SET ROLE will work (confirm effective role)
const roleTest = spawnSync(PSQL, ["-Atc", "SET ROLE service_role; SELECT current_user, current_setting('is_superuser'), (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS current_bypass", DB_URL], { env: process.env, encoding: "utf8", timeout: 30000 });
if (roleTest.status !== 0) bail(`SET ROLE test failed: ${roleTest.stderr}`);
log(`  ✓ SET ROLE service_role works · session state: ${roleTest.stdout.trim()}`);

// =========================== EXECUTE ============================
log("\n─── EXECUTING pg_restore --role=service_role ---");
const t0 = Date.now();
const args = [
  "--dbname", DB_URL,
  "--role=service_role",
  "--data-only",
  "--schema=nex",
  `--use-list=${LIST_FILE}`,
  "--jobs=1",
  "--exit-on-error",
  "--verbose",
  "--no-owner",
  "--no-acl",
  BACKUP,
];
const restoreEnv = { ...process.env, PGOPTIONS: "-c statement_timeout=0 -c lock_timeout=0 -c idle_in_transaction_session_timeout=0" };
const proc = spawn(PG_RESTORE, args, { env: restoreEnv, stdio: ["ignore", "pipe", "pipe"] });
proc.stdout.on("data", d => { const s = scrub(d.toString()); process.stdout.write(s); appendFileSync(LOG_FILE, s); });
proc.stderr.on("data", d => { const s = scrub(d.toString()); process.stderr.write(s); appendFileSync(LOG_FILE, s); });
const exit = await new Promise(res => proc.on("close", res));
const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
log(`\npg_restore exit: ${exit} · elapsed: ${elapsed}s`);

// =========================== POST-CHECK ============================
log("\n─── POST-CHECK ───");

const post = await q(`SELECT pg_database_size(current_database()) AS db_bytes, pg_size_pretty(pg_database_size(current_database())) AS db_pretty, pg_current_wal_lsn()::text AS wal_lsn`);
const postState = post.body[0];
const dbDelta = Number(postState.db_bytes) - Number(preState.db_bytes);
log(`  db_size PRE→POST:  ${preState.db_pretty} → ${postState.db_pretty}  (delta: ${dbDelta >= 0 ? "+" : ""}${dbDelta} bytes = ${(dbDelta/1024).toFixed(1)} KB)`);
log(`  wal_lsn PRE→POST:  ${preState.wal_lsn} → ${postState.wal_lsn}`);

// Per-table reconciliation
const cols = BATCH1_TABLES.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const rowResult = await q(`SELECT ${cols}`);
const actualCounts = rowResult.body?.[0] || {};
let matched = 0, mismatched = 0, totalActual = 0;
const failed = [];
for (const t of BATCH1_TABLES) {
  const actual = Number(actualCounts[t] ?? -1);
  const expected = EXPECTED[t];
  totalActual += actual > 0 ? actual : 0;
  if (actual === expected) matched++;
  else { mismatched++; failed.push({ table: t, expected, actual }); }
}
if (failed.length === 0) log(`  ✓ ALL ${matched}/${BATCH1_TABLES.length} tables matched expected · total = ${totalActual} (expected ${EXPECTED_TOTAL})`);
else {
  log(`  ❌ ${failed.length} mismatches:`);
  for (const r of failed) log(`     ${r.table.padEnd(45)} expected=${r.expected}  actual=${r.actual}`);
  log(`  matched: ${matched}, mismatched: ${mismatched}, total: ${totalActual}/${EXPECTED_TOTAL}`);
}

// Public unchanged
const pp = (await q(`SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables, (SELECT count(*) FROM public.knowledge_records) AS kr, (SELECT count(*) FROM public.worker_jobs) AS wj, (SELECT count(*) FROM public.worker_results) AS wr`)).body[0];
log(`  public POST: ${JSON.stringify(pp)}`);
const pubOk = pp.public_tables === 17 && pp.kr === 3627 && pp.wj === 19167 && pp.wr === 19140;
log(`  public unchanged: ${pubOk ? "✓" : "❌"}`);

// RLS unchanged
const rlsPost = (await q(`SELECT count(*) FILTER (WHERE c.relrowsecurity=true) AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r'`)).body[0];
log(`  RLS POST: ${JSON.stringify(rlsPost)} (should be 92)`);
const rlsOk = rlsPost.rls_enabled === 92;

// FK still 0
const fkPost = (await q(`SELECT count(*) AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f'`)).body[0];
log(`  FK count POST: ${fkPost.n} (should be 0)`);

// Readonly still OFF
const roPost = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  readonly POST: enabled=${roPost.enabled}`);

const report = {
  batch: 1,
  path: "A · GRANT service_role + --role=service_role",
  pg_restore_exit: exit,
  elapsed_seconds: Number(elapsed),
  pre: preState,
  post: postState,
  db_delta_bytes: dbDelta,
  wal_delta: `${preState.wal_lsn} → ${postState.wal_lsn}`,
  row_reconciliation: { matched, mismatched, expected_total: EXPECTED_TOTAL, actual_total: totalActual, failures: failed },
  public_baseline_post: pp,
  public_unchanged: pubOk,
  rls_state_post: rlsPost,
  rls_unchanged: rlsOk,
  fks_post: Number(fkPost.n),
  readonly_post: roPost,
  service_role_granted_to_temp: true,
  note: "service_role membership must be REVOKED after full migration complete",
};
writeFileSync(resolve(__dirname, "batch-01-pathA-report.json"), JSON.stringify(report, null, 2));

log(`\n─── HARD STOP · Batch 1 (Path A) complete · report at scripts/nex-migration/batch-01-pathA-report.json ───`);
log(`─── awaiting Philip approval before Batch 2 ───`);
process.exit(exit);
