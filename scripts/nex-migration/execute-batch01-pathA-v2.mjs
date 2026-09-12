#!/usr/bin/env node
// Path A v2 · least-privilege grants to service_role + re-run Batch 1 with --role=service_role.
// STRICT pre-flight · positive confirmation that service_role lacks USAGE before granting.

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
const TEMP_ROLE = DB_URL.match(/postgresql:\/\/([^.]+)\./)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const BACKUP = "D:/nex-backups/nex_dev-2026-09-03-0230-post-enum-fix.dump";
const LIST_FILE = resolve(__dirname, "batch-01-tiny.list");
const LOG_FILE = resolve(__dirname, "batch-01-pathA-v2.log");
const PG_RESTORE = "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe";

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

log(`=== BATCH 1 · PATH A v2 · least-privilege grants to service_role ===`);

// =========================== PRE-FLIGHT ============================
log("\n─── PRE-FLIGHT (read-only) ───");

// 1 · target identity
const proj = await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  target: ${proj.id} · ${proj.name} · ${proj.region} · ${proj.status}`);
if (proj.id !== "ijvqdvsvwtwxzcqmoqit") bail("wrong target project");

// 2 · nex schema exists
const nexSchema = await q(`SELECT count(*) AS n FROM pg_namespace WHERE nspname='nex'`);
if (nexSchema.body[0].n !== 1) bail("nex schema does not exist");
log(`  ✓ nex schema exists`);

// 3 · service_role currently LACKS USAGE on nex (positive confirmation of the gap)
const usageCheck = await q(`SELECT has_schema_privilege('service_role', 'nex', 'USAGE') AS has_usage`);
log(`  service_role has_schema_privilege('nex','USAGE'): ${usageCheck.body[0].has_usage}`);
if (usageCheck.body[0].has_usage !== false) bail(`service_role already has USAGE on nex · unexpected · investigate before granting`);
log(`  ✓ confirmed: service_role does NOT have USAGE on nex (the gap we're fixing)`);

// 4 · service_role still has BYPASSRLS
const srBypass = await q(`SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role'`);
if (srBypass.body[0].rolbypassrls !== true) bail("service_role.rolbypassrls != true");
log(`  ✓ service_role.rolbypassrls = true`);

// 5 · invariants unchanged
const inv = (await q(`
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
`)).body[0];
log(`  invariants: ${JSON.stringify(inv)}`);
if (inv.nex_tables !== 191) bail(`nex_tables = ${inv.nex_tables} (expected 191)`);
if (inv.rls_enabled !== 92) bail(`RLS-enabled = ${inv.rls_enabled} (expected 92)`);
if (inv.rls_policies !== 140) bail(`RLS policies = ${inv.rls_policies} (expected 140)`);
if (Number(inv.nex_fks) !== 0) bail(`nex_fks = ${inv.nex_fks} (expected 0)`);
if (inv.public_tables !== 17) bail(`public tables changed`);
if (inv.kr !== 3627 || inv.wj !== 19167 || inv.wr !== 19140) bail(`public row counts changed`);

// 6 · all 191 nex tables empty (spot-check)
const sample = await q(`SELECT (SELECT count(*) FROM nex.alert_dispatches) AS a, (SELECT count(*) FROM nex.identity_merge_log) AS b, (SELECT count(*) FROM nex.food_business) AS c, (SELECT count(*) FROM nex.chat_message) AS d`);
log(`  sample nex counts (must all be 0): ${JSON.stringify(sample.body[0])}`);
if (Object.values(sample.body[0]).some(v => Number(v) !== 0)) bail("nex tables not empty");

// 7 · readonly OFF
const ro = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
if (ro.enabled) bail("readonly is enabled");
log(`  ✓ readonly enabled=false`);

const preState = { db_bytes: inv.db_bytes, db_pretty: inv.db_pretty, wal_lsn: inv.wal_lsn };

log(`\n─── PRE-FLIGHT PASSED · applying least-privilege grants to service_role ───`);

// =========================== GRANT MINIMUM PRIVILEGES ============================
const grantSql = `
GRANT USAGE ON SCHEMA nex TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA nex TO service_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA nex TO service_role;
`;
const grantRes = await q(grantSql);
if (grantRes.status >= 300) bail(`GRANT failed: ${JSON.stringify(grantRes.body).slice(0, 300)}`);
log(`  ✓ grants applied HTTP ${grantRes.status}`);

// Verify grants
const grantVerify = await q(`
  SELECT
    has_schema_privilege('service_role', 'nex', 'USAGE')                       AS schema_usage,
    has_table_privilege('service_role', 'nex.alert_dispatches', 'SELECT')      AS tbl_select,
    has_table_privilege('service_role', 'nex.alert_dispatches', 'INSERT')      AS tbl_insert,
    has_table_privilege('service_role', 'nex.alert_dispatches', 'UPDATE')      AS tbl_update,
    has_table_privilege('service_role', 'nex.alert_dispatches', 'DELETE')      AS tbl_delete,
    has_table_privilege('service_role', 'nex.alert_dispatches', 'TRUNCATE')    AS tbl_truncate_should_be_false,
    has_table_privilege('service_role', 'nex.alert_dispatches', 'REFERENCES')  AS tbl_ref_should_be_false,
    has_table_privilege('service_role', 'nex.alert_dispatches', 'TRIGGER')     AS tbl_trg_should_be_false,
    (SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role')           AS bypassrls_still_true
`);
log(`  grant verification: ${JSON.stringify(grantVerify.body[0])}`);
const gv = grantVerify.body[0];
if (!gv.schema_usage) bail("USAGE grant not effective");
if (!gv.tbl_select || !gv.tbl_insert || !gv.tbl_update || !gv.tbl_delete) bail("SELECT/INSERT/UPDATE/DELETE grants incomplete");
if (gv.tbl_truncate_should_be_false !== false) bail(`TRUNCATE should be false but is ${gv.tbl_truncate_should_be_false}`);
if (gv.tbl_ref_should_be_false !== false) bail(`REFERENCES should be false but is ${gv.tbl_ref_should_be_false}`);
if (gv.tbl_trg_should_be_false !== false) bail(`TRIGGER should be false but is ${gv.tbl_trg_should_be_false}`);
if (gv.bypassrls_still_true !== true) bail("BYPASSRLS attribute lost");
log(`  ✓ USAGE + SELECT/INSERT/UPDATE/DELETE granted · TRUNCATE/REFERENCES/TRIGGER intentionally NOT granted · BYPASSRLS preserved`);

// Reconfirm no data written by grants, invariants still intact
const invAfterGrant = (await q(`
  SELECT
    pg_database_size(current_database()) AS db_bytes,
    (SELECT count(*) FROM public.knowledge_records) AS kr,
    (SELECT count(*) FROM public.worker_jobs) AS wj,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
    (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks
`)).body[0];
log(`  post-grant invariants: ${JSON.stringify(invAfterGrant)}`);
if (Number(invAfterGrant.db_bytes) !== Number(preState.db_bytes)) bail(`db_bytes changed unexpectedly: ${invAfterGrant.db_bytes} vs ${preState.db_bytes}`);
if (invAfterGrant.kr !== 3627 || invAfterGrant.wj !== 19167) bail("public.* changed after grant");
if (invAfterGrant.rls !== 92) bail("RLS state changed after grant");
if (Number(invAfterGrant.fks) !== 0) bail("FK count changed after grant");
log(`  ✓ no data written · public/RLS/FK invariants unchanged`);

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
const post = (await q(`SELECT pg_database_size(current_database()) AS db_bytes, pg_size_pretty(pg_database_size(current_database())) AS db_pretty, pg_current_wal_lsn()::text AS wal_lsn`)).body[0];
const dbDelta = Number(post.db_bytes) - Number(preState.db_bytes);
log(`  db_size PRE→POST:  ${preState.db_pretty} → ${post.db_pretty}  (delta: ${dbDelta >= 0 ? "+" : ""}${dbDelta} bytes = ${(dbDelta/1024).toFixed(1)} KB)`);
log(`  wal_lsn PRE→POST:  ${preState.wal_lsn} → ${post.wal_lsn}`);

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
if (failed.length === 0) log(`  ✓ ALL ${matched}/${BATCH1_TABLES.length} tables match · total = ${totalActual} (expected ${EXPECTED_TOTAL})`);
else {
  log(`  ❌ ${failed.length} mismatches:`);
  for (const r of failed) log(`     ${r.table.padEnd(45)} expected=${r.expected}  actual=${r.actual}`);
  log(`  matched: ${matched}, mismatched: ${mismatched}, total: ${totalActual}/${EXPECTED_TOTAL}`);
}

const pp = (await q(`SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables, (SELECT count(*) FROM public.knowledge_records) AS kr, (SELECT count(*) FROM public.worker_jobs) AS wj, (SELECT count(*) FROM public.worker_results) AS wr`)).body[0];
const pubOk = pp.public_tables === 17 && pp.kr === 3627 && pp.wj === 19167 && pp.wr === 19140;
log(`  public POST: ${JSON.stringify(pp)} · unchanged=${pubOk ? "✓" : "❌"}`);

const rlsPost = (await q(`SELECT count(*) FILTER (WHERE c.relrowsecurity=true) AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r'`)).body[0];
log(`  RLS POST: ${JSON.stringify(rlsPost)} (should be 92)`);

const fkPost = (await q(`SELECT count(*) AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f'`)).body[0];
log(`  FK count POST: ${fkPost.n} (should be 0)`);

const roPost = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  readonly POST: enabled=${roPost.enabled}`);

const report = {
  batch: 1, path: "A v2 · least-privilege",
  grants_applied: { schema_usage: "USAGE on nex", table_perms: "SELECT/INSERT/UPDATE/DELETE (no TRUNCATE/REFERENCES/TRIGGER)", sequence_perms: "USAGE, SELECT, UPDATE" },
  pg_restore_exit: exit, elapsed_seconds: Number(elapsed),
  pre: preState, post,
  db_delta_bytes: dbDelta, wal_delta: `${preState.wal_lsn} → ${post.wal_lsn}`,
  row_reconciliation: { matched, mismatched, expected_total: EXPECTED_TOTAL, actual_total: totalActual, failures: failed },
  public_baseline_post: pp, public_unchanged: pubOk,
  rls_state_post: rlsPost, rls_unchanged: rlsPost.rls_enabled === 92,
  fks_post: Number(fkPost.n), readonly_post: roPost,
};
writeFileSync(resolve(__dirname, "batch-01-pathA-v2-report.json"), JSON.stringify(report, null, 2));
log(`\n─── HARD STOP · Batch 1 (Path A v2) complete ───`);
process.exit(exit);
