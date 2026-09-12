#!/usr/bin/env node
// Batch 2 · SMALL · pre-check + pg_restore --role=service_role --use-list=batch-02-small.list + post-check.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const DB_URL = envText.match(/^NEX_SUPABASE_DB_URL=(.+)$/m)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const BACKUP = "D:/nex-backups/nex_dev-2026-09-03-0230-post-enum-fix.dump";
const LIST_FILE = resolve(__dirname, "batch-02-small.list");
const LOG_FILE = resolve(__dirname, "batch-02.log");
const PG_RESTORE = "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe";

const BATCH1_TABLES = ["alert_dispatches","alert_rules","alerts","audit_log","benchmark_runs","bike_rental_listing","brain_user_saved_facts","call_record","campaign_segments","chat_message","chat_message_archive","chat_message_deletion","compliance_events","contact_segments","conv_intents","conversion_events","cost_budget","delivery_workers_archive_2026_08_22","email_templates","events","experiment_variants","experiments","food_business_promotion_decision","food_claim_code","food_commercial_event","food_hq_rule","food_outreach_attempt","food_outreach_suppression","food_outreach_template","geo_landmark","journey_inbound_events","journey_triggers","journeys","knowledge_inbox_stats","meaningful_area","mp_commerce_policy","mp_product","mp_product_image","mp_product_option","mp_product_option_value","mp_product_variant","object_blob_current","prediction_models","predictive_controls","provider_rate_config","provider_registry","provider_wallet","recovery_runs","rollup_campaigns","rollup_country","rollup_daily","rollup_monthly","rollup_provider","rollup_segment","safety_audit_config","social_admin_access_log","social_category_automation","social_controls","sparks_product","sparks_product_price","user_wallet","worker_heartbeats_archive_2026_08_22"];

const BATCH2_EXPECTED = {
  analytics_events: 526, campaign_recipients: 216, delivery_job_attempts: 587, delivery_jobs: 670,
  experiment_assignments: 558, food_business_promotion: 636, food_business_promotion_audit: 729,
  food_next_action_audit: 814, journey_states: 165, mp_category: 310, social_accounts: 322,
  social_audit_events: 616, social_brand_profiles: 715, social_content_templates: 556,
  social_dek_wraps: 846, social_oauth_states: 356, social_scheduled_posts: 110,
  social_validator_runs: 546, transport_acquisition_record: 107, video_feed_impression: 145,
  wallet_transaction: 159,
};
const BATCH2_TABLES = Object.keys(BATCH2_EXPECTED);
const BATCH2_EXPECTED_TOTAL = Object.values(BATCH2_EXPECTED).reduce((a,b)=>a+b,0);

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

log(`=== BATCH 2 EXECUTION · ${BATCH2_TABLES.length} tables · expected ${BATCH2_EXPECTED_TOTAL} rows ===`);

// ================================ PRE-CHECK ================================
log("\n─── PRE-CHECK ───");

const inv = (await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls_enabled,
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
if (inv.rls_enabled !== 92) bail(`RLS drift: ${inv.rls_enabled}`);
if (Number(inv.nex_fks) !== 0) bail(`FK drift: ${inv.nex_fks}`);
if (inv.public_tables !== 17 || inv.kr !== 3627 || inv.wj !== 19167 || inv.wr !== 19140) bail("public.* drift");

// Batch 1 still at 722 exact
const cols1 = BATCH1_TABLES.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const b1 = (await q(`SELECT ${cols1}`)).body[0];
const b1sum = Object.values(b1).reduce((a,v) => a + Number(v), 0);
if (b1sum !== 722) bail(`Batch 1 drift: ${b1sum} vs 722`);
log(`  ✓ Batch 1 unchanged at 722 rows exact`);

// Batch 2 tables must currently be empty
const cols2 = BATCH2_TABLES.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const b2pre = (await q(`SELECT ${cols2}`)).body[0];
const b2sumPre = Object.values(b2pre).reduce((a,v) => a + Number(v), 0);
if (b2sumPre !== 0) bail(`Batch 2 tables not empty: ${b2sumPre}`);
log(`  ✓ Batch 2 target tables all empty (0/0)`);

// Readonly OFF
const ro = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
if (ro.enabled) bail("readonly enabled");
log(`  ✓ readonly enabled=false`);

const preState = { db_bytes: inv.db_bytes, db_pretty: inv.db_pretty, wal_lsn: inv.wal_lsn };
log(`  DB size PRE:  ${preState.db_pretty}`);
log(`  WAL LSN PRE:  ${preState.wal_lsn}`);

log("\n─── PRE-CHECK PASSED · executing pg_restore ───");

// ================================ EXECUTE ================================
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

// ================================ POST-CHECK ================================
log("\n─── POST-CHECK ───");

const post = (await q(`SELECT pg_database_size(current_database()) AS db_bytes, pg_size_pretty(pg_database_size(current_database())) AS db_pretty, pg_current_wal_lsn()::text AS wal_lsn`)).body[0];
const dbDelta = Number(post.db_bytes) - Number(preState.db_bytes);
log(`  DB size PRE→POST:  ${preState.db_pretty} → ${post.db_pretty}  delta: ${dbDelta >= 0 ? "+" : ""}${dbDelta} bytes (${(dbDelta/1024/1024).toFixed(2)} MB)`);
log(`  WAL LSN PRE→POST:  ${preState.wal_lsn} → ${post.wal_lsn}`);

// Per-table Batch 2 reconciliation
const b2Post = (await q(`SELECT ${cols2}`)).body[0];
let matched = 0, mismatched = 0, totalActual = 0;
const failed = [];
for (const t of BATCH2_TABLES) {
  const actual = Number(b2Post[t]);
  const expected = BATCH2_EXPECTED[t];
  totalActual += actual;
  if (actual === expected) matched++;
  else { mismatched++; failed.push({ table: t, expected, actual }); }
}
if (failed.length === 0) log(`  ✓ ALL ${matched}/${BATCH2_TABLES.length} Batch 2 tables match · total = ${totalActual} (expected ${BATCH2_EXPECTED_TOTAL})`);
else {
  log(`  ❌ ${failed.length} mismatches:`);
  for (const r of failed) log(`     ${r.table.padEnd(45)} expected=${r.expected}  actual=${r.actual}`);
  log(`  matched: ${matched}, mismatched: ${mismatched}, total: ${totalActual}/${BATCH2_EXPECTED_TOTAL}`);
}

// Batch 1 unchanged
const b1Post = (await q(`SELECT ${cols1}`)).body[0];
const b1sumPost = Object.values(b1Post).reduce((a,v) => a + Number(v), 0);
log(`  Batch 1 still: ${b1sumPost}/722 rows ${b1sumPost === 722 ? "✓" : "❌"}`);

// public unchanged
const pp = (await q(`SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables, (SELECT count(*) FROM public.knowledge_records) AS kr, (SELECT count(*) FROM public.worker_jobs) AS wj, (SELECT count(*) FROM public.worker_results) AS wr`)).body[0];
const pubOk = pp.public_tables === 17 && pp.kr === 3627 && pp.wj === 19167 && pp.wr === 19140;
log(`  public POST: ${JSON.stringify(pp)} · unchanged=${pubOk ? "✓" : "❌"}`);

// RLS + FK unchanged
const rlsPost = (await q(`SELECT count(*) FILTER (WHERE c.relrowsecurity=true) AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r'`)).body[0];
log(`  RLS enabled POST: ${rlsPost.rls_enabled} (expected 92) ${rlsPost.rls_enabled === 92 ? "✓" : "❌"}`);
const fkPost = (await q(`SELECT count(*) AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f'`)).body[0];
log(`  FK count POST: ${fkPost.n} (expected 0) ${Number(fkPost.n) === 0 ? "✓" : "❌"}`);

// Readonly
const roPost = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  readonly POST: enabled=${roPost.enabled}`);

const report = {
  batch: 2, pg_restore_exit: exit, elapsed_seconds: Number(elapsed),
  pre: preState, post,
  db_delta_bytes: dbDelta, db_delta_pretty: `${(dbDelta/1024/1024).toFixed(2)} MB`,
  wal_delta: `${preState.wal_lsn} → ${post.wal_lsn}`,
  batch2_reconciliation: { matched, mismatched, expected_total: BATCH2_EXPECTED_TOTAL, actual_total: totalActual, failures: failed },
  batch1_still_intact: b1sumPost === 722,
  public_baseline_post: pp, public_unchanged: pubOk,
  rls_state_post: rlsPost, rls_unchanged: rlsPost.rls_enabled === 92,
  fks_post: Number(fkPost.n), readonly_post: roPost,
};
writeFileSync(resolve(__dirname, "batch-02-report.json"), JSON.stringify(report, null, 2));
log(`\n─── HARD STOP · Batch 2 complete · awaiting Philip approval for Batch 3 ───`);
process.exit(exit);
