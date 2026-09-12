#!/usr/bin/env node
// Execute Batch 1 · warm-up · RLS UNCHANGED per Philip's approval.
// Pre-check → pg_restore --data-only --use-list=batch-01-tiny.list → post-check.
// HARD STOP after · no cleanup · no further batches.

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
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const BACKUP = "D:/nex-backups/nex_dev-2026-09-03-0230-post-enum-fix.dump";
const LIST_FILE = resolve(__dirname, "batch-01-tiny.list");
const LOG_FILE = resolve(__dirname, "batch-01-execution.log");
const PG_RESTORE = "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe";

// Batch 1 table list (must match batch-01-tiny.list · 62 tables)
const BATCH1_TABLES = [
  "alert_dispatches","alert_rules","alerts","audit_log","benchmark_runs","bike_rental_listing",
  "brain_user_saved_facts","call_record","campaign_segments","chat_message","chat_message_archive",
  "chat_message_deletion","compliance_events","contact_segments","conv_intents","conversion_events",
  "cost_budget","delivery_workers_archive_2026_08_22","email_templates","events","experiment_variants",
  "experiments","food_business_promotion_decision","food_claim_code","food_commercial_event",
  "food_hq_rule","food_outreach_attempt","food_outreach_suppression","food_outreach_template",
  "geo_landmark","journey_inbound_events","journey_triggers","journeys","knowledge_inbox_stats",
  "meaningful_area","mp_commerce_policy","mp_product","mp_product_image","mp_product_option",
  "mp_product_option_value","mp_product_variant","object_blob_current","prediction_models",
  "predictive_controls","provider_rate_config","provider_registry","provider_wallet","recovery_runs",
  "rollup_campaigns","rollup_country","rollup_daily","rollup_monthly","rollup_provider",
  "rollup_segment","safety_audit_config","social_admin_access_log","social_category_automation",
  "social_controls","sparks_product","sparks_product_price","user_wallet",
  "worker_heartbeats_archive_2026_08_22"
];

// Expected row counts from local nex_dev (for exact post-restore reconciliation)
const EXPECTED = {
  alert_dispatches: 12, alert_rules: 14, alerts: 4, audit_log: 9, benchmark_runs: 1,
  bike_rental_listing: 9, brain_user_saved_facts: 1, call_record: 1, campaign_segments: 4,
  chat_message: 70, chat_message_archive: 20, chat_message_deletion: 20, compliance_events: 14,
  contact_segments: 12, conv_intents: 22, conversion_events: 2, cost_budget: 4,
  delivery_workers_archive_2026_08_22: 1, email_templates: 8, events: 2, experiment_variants: 2,
  experiments: 1, food_business_promotion_decision: 1, food_claim_code: 1, food_commercial_event: 6,
  food_hq_rule: 10, food_outreach_attempt: 5, food_outreach_suppression: 1, food_outreach_template: 4,
  geo_landmark: 34, journey_inbound_events: 3, journey_triggers: 1, journeys: 3,
  knowledge_inbox_stats: 2, meaningful_area: 6, mp_commerce_policy: 1, mp_product: 5,
  mp_product_image: 5, mp_product_option: 11, mp_product_option_value: 24, mp_product_variant: 15,
  object_blob_current: 22, prediction_models: 2, predictive_controls: 1, provider_rate_config: 7,
  provider_registry: 5, provider_wallet: 7, recovery_runs: 4, rollup_campaigns: 5,
  rollup_country: 10, rollup_daily: 2, rollup_monthly: 1, rollup_provider: 5, rollup_segment: 1,
  safety_audit_config: 1, social_admin_access_log: 87, social_category_automation: 66,
  social_controls: 1, sparks_product: 3, sparks_product_price: 6, user_wallet: 65,
  worker_heartbeats_archive_2026_08_22: 50,
};
const EXPECTED_TOTAL = Object.values(EXPECTED).reduce((a,b) => a+b, 0);

writeFileSync(LOG_FILE, "");
function scrub(s) { return String(s).split(DB_URL.split("@")[0].split(":").pop()).join("<PASSWORD>"); }
function log(m) { const s = `[${new Date().toISOString()}] ${m}\n`; appendFileSync(LOG_FILE, scrub(s)); process.stderr.write(scrub(m + "\n")); }

async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

log(`=== BATCH 1 EXECUTION · warm-up · RLS UNCHANGED ===`);
log(`target: ${REF} · eu-west-1`);
log(`expected: ${BATCH1_TABLES.length} tables · ${EXPECTED_TOTAL} rows`);

// ================================ PRE-CHECK ================================
log("\n─── PRE-CHECK ───");

// 1 · target identity
const proj = await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  target: ${proj.id} · ${proj.name} · ${proj.region} · ${proj.status}`);
if (proj.id !== "ijvqdvsvwtwxzcqmoqit") { log(`❌ wrong project`); process.exit(2); }

// 2 · readonly OFF
const readonly = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  readonly: enabled=${readonly.enabled}`);
if (readonly.enabled) { log(`❌ readonly mode ACTIVE`); process.exit(2); }

// 3 · db size + wal lsn
const pre = await q(`SELECT pg_database_size(current_database()) AS db_bytes, pg_size_pretty(pg_database_size(current_database())) AS db_pretty, pg_current_wal_lsn() AS wal_lsn, pg_walfile_name(pg_current_wal_lsn()) AS wal_file`);
const preState = pre.body[0];
log(`  db_size PRE:  ${preState.db_pretty} (${Number(preState.db_bytes).toLocaleString()} bytes)`);
log(`  wal_lsn PRE:  ${preState.wal_lsn} · file ${preState.wal_file}`);

// 4 · confirm all 191 nex tables empty
const nexEmptyCheck = await q(`
  WITH t AS (SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r')
  SELECT count(*) AS total_tables FROM t
`);
log(`  nex table count: ${nexEmptyCheck.body[0].total_tables}`);
// Sample row-count check across a subset (avoid 191 subqueries here)
const sampleCheck = await q(`SELECT (SELECT count(*) FROM nex.identity_merge_log) AS imel, (SELECT count(*) FROM nex.food_business) AS fb, (SELECT count(*) FROM nex.audit_log) AS al, (SELECT count(*) FROM nex.chat_message) AS cm`);
log(`  sample nex counts (must all be 0): ${JSON.stringify(sampleCheck.body[0])}`);
const notEmpty = Object.entries(sampleCheck.body[0]).filter(([_,v]) => Number(v) !== 0);
if (notEmpty.length > 0) { log(`❌ nex tables not all empty: ${JSON.stringify(notEmpty)}`); process.exit(2); }

// 5 · public baseline
const pubBaseline = await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables,
    (SELECT count(*) FROM public.knowledge_records) AS kr,
    (SELECT count(*) FROM public.worker_jobs) AS wj,
    (SELECT count(*) FROM public.worker_results) AS wr
`);
log(`  public baseline: ${JSON.stringify(pubBaseline.body[0])}`);
const p = pubBaseline.body[0];
if (p.public_tables !== 17 || p.kr !== 3627 || p.wj !== 19167 || p.wr !== 19140) { log(`❌ public.* baseline mismatch`); process.exit(2); }

// 6 · RLS state snapshot (informational · we won't modify)
const rlsSnap = await q(`
  SELECT count(*) FILTER (WHERE c.relrowsecurity=true) AS rls_enabled_tables,
         count(*) AS total_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='nex' AND c.relkind='r'
`);
log(`  RLS state PRE:  ${JSON.stringify(rlsSnap.body[0])}`);

// 7 · FK state (informational · should be 0)
const fkSnap = await q(`SELECT count(*) AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f'`);
log(`  FK count PRE:   ${fkSnap.body[0].n} (should be 0)`);

log(`\n─── PRE-CHECK PASSED · proceeding to pg_restore ───`);

// ================================ EXECUTE ================================
log("\n─── EXECUTING pg_restore --use-list=batch-01-tiny.list ───");
const t0 = Date.now();
const args = [
  "--dbname", DB_URL,
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

// ================================ POST-CHECK ================================
log("\n─── POST-CHECK ───");

// Post-execution measurements ALWAYS run (even on failure) for damage assessment
const post = await q(`SELECT pg_database_size(current_database()) AS db_bytes, pg_size_pretty(pg_database_size(current_database())) AS db_pretty, pg_current_wal_lsn() AS wal_lsn, pg_walfile_name(pg_current_wal_lsn()) AS wal_file`);
const postState = post.body[0];
log(`  db_size POST: ${postState.db_pretty} (${Number(postState.db_bytes).toLocaleString()} bytes)`);
log(`  wal_lsn POST: ${postState.wal_lsn} · file ${postState.wal_file}`);
const dbDelta = Number(postState.db_bytes) - Number(preState.db_bytes);
log(`  db_size DELTA: ${dbDelta >= 0 ? "+" : ""}${dbDelta} bytes (${(dbDelta/1024).toFixed(1)} KB)`);

// Verify per-table counts against expected
log(`\n  Per-table row counts vs source:`);
const cols = BATCH1_TABLES.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const rowResult = await q(`SELECT ${cols}`);
const actualCounts = rowResult.body?.[0] || {};
let matched = 0, mismatched = 0, missing = 0, totalActual = 0;
const rowRecon = [];
for (const t of BATCH1_TABLES) {
  const actual = Number(actualCounts[t] ?? -1);
  const expected = EXPECTED[t];
  totalActual += actual > 0 ? actual : 0;
  const status = actual === expected ? "✓" : "❌";
  if (actual === expected) matched++;
  else if (actual === -1) missing++;
  else mismatched++;
  rowRecon.push({ table: t, expected, actual, status });
}
// Print any mismatches
const failed = rowRecon.filter(r => r.status === "❌");
if (failed.length === 0) {
  log(`  ✓ ALL 62 tables matched expected counts · total = ${totalActual} (expected ${EXPECTED_TOTAL})`);
} else {
  log(`  ❌ ${failed.length} table(s) did not match expected counts:`);
  for (const r of failed) log(`     ${r.table.padEnd(45)} expected=${r.expected}  actual=${r.actual}`);
  log(`  ✓ ${matched} tables matched (total actual: ${totalActual}, expected: ${EXPECTED_TOTAL})`);
}

// Public baseline unchanged
const pubPost = await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables,
    (SELECT count(*) FROM public.knowledge_records) AS kr,
    (SELECT count(*) FROM public.worker_jobs) AS wj,
    (SELECT count(*) FROM public.worker_results) AS wr
`);
log(`\n  public baseline POST: ${JSON.stringify(pubPost.body[0])}`);
const pp = pubPost.body[0];
const pubOk = pp.public_tables === 17 && pp.kr === 3627 && pp.wj === 19167 && pp.wr === 19140;
log(`  public.* unchanged: ${pubOk ? "✓" : "❌"}`);

// RLS unchanged
const rlsPost = await q(`
  SELECT count(*) FILTER (WHERE c.relrowsecurity=true) AS rls_enabled_tables,
         count(*) AS total_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='nex' AND c.relkind='r'
`);
log(`  RLS state POST: ${JSON.stringify(rlsPost.body[0])}`);
const rlsUnchanged = rlsPost.body[0].rls_enabled_tables === rlsSnap.body[0].rls_enabled_tables;
log(`  RLS unchanged: ${rlsUnchanged ? "✓" : "❌"}`);

// FK unchanged (should still be 0)
const fkPost = await q(`SELECT count(*) AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f'`);
log(`  FK count POST: ${fkPost.body[0].n} (should be 0)`);

// Readonly still OFF
const roPost = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  readonly POST: enabled=${roPost.enabled}`);

// Save report
const report = {
  batch: 1,
  pg_restore_exit: exit,
  elapsed_seconds: Number(elapsed),
  pre: preState,
  post: postState,
  db_delta_bytes: dbDelta,
  row_reconciliation: { matched, mismatched, missing, expected_total: EXPECTED_TOTAL, actual_total: totalActual, failures: failed },
  public_baseline_post: pp,
  public_unchanged: pubOk,
  rls_state_pre: rlsSnap.body[0],
  rls_state_post: rlsPost.body[0],
  rls_unchanged: rlsUnchanged,
  fks_pre: Number(fkSnap.body[0].n),
  fks_post: Number(fkPost.body[0].n),
  readonly_post: roPost,
};
writeFileSync(resolve(__dirname, "batch-01-report.json"), JSON.stringify(report, null, 2));

log(`\n─── HARD STOP · batch 1 complete · report at scripts/nex-migration/batch-01-report.json ───`);
log(`─── awaiting Philip approval before Batch 2 ───`);
process.exit(exit);
