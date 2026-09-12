#!/usr/bin/env node
// Batch 3 · MEDIUM GROUP A · pre-check + pg_restore --role=service_role + post-check.
// Special attention: conv_knowledge_items (9.4 MB toast · monitor for toast anomalies).

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
const LIST_FILE = resolve(__dirname, "batch-03-medium-a.list");
const LOG_FILE = resolve(__dirname, "batch-03.log");
const PG_RESTORE = "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe";

const BATCH1_TABLES = ["alert_dispatches","alert_rules","alerts","audit_log","benchmark_runs","bike_rental_listing","brain_user_saved_facts","call_record","campaign_segments","chat_message","chat_message_archive","chat_message_deletion","compliance_events","contact_segments","conv_intents","conversion_events","cost_budget","delivery_workers_archive_2026_08_22","email_templates","events","experiment_variants","experiments","food_business_promotion_decision","food_claim_code","food_commercial_event","food_hq_rule","food_outreach_attempt","food_outreach_suppression","food_outreach_template","geo_landmark","journey_inbound_events","journey_triggers","journeys","knowledge_inbox_stats","meaningful_area","mp_commerce_policy","mp_product","mp_product_image","mp_product_option","mp_product_option_value","mp_product_variant","object_blob_current","prediction_models","predictive_controls","provider_rate_config","provider_registry","provider_wallet","recovery_runs","rollup_campaigns","rollup_country","rollup_daily","rollup_monthly","rollup_provider","rollup_segment","safety_audit_config","social_admin_access_log","social_category_automation","social_controls","sparks_product","sparks_product_price","user_wallet","worker_heartbeats_archive_2026_08_22"];
const BATCH2_TABLES = ["analytics_events","campaign_recipients","delivery_job_attempts","delivery_jobs","experiment_assignments","food_business_promotion","food_business_promotion_audit","food_next_action_audit","journey_states","mp_category","social_accounts","social_audit_events","social_brand_profiles","social_content_templates","social_dek_wraps","social_oauth_states","social_scheduled_posts","social_validator_runs","transport_acquisition_record","video_feed_impression","wallet_transaction"];

const BATCH3_EXPECTED = {
  accommodation_business: 9203, accommodation_business_source_snapshot: 9203, attributions: 9,
  bike_model: 50, brain_did_you_know_indonesia: 39, brain_english_vocabulary: 30,
  business_image: 660, business_knowledge: 1258, campaigns: 13, category_candidate: 4,
  category_registry: 13, contacts: 67, conv_edges: 4970, conv_entities: 70,
  conv_knowledge_items: 890, conv_learning_candidate: 1607, conv_states: 303, conv_turns: 583,
  food_business_next_action: 806, food_enrichment_evidence: 1450, journey_campaign_executions: 54,
  journey_events: 928, knowledge_dump_jobs: 76, knowledge_inbox: 279, knowledge_records: 1,
  llm_retry_queue: 41, media_object: 16, object_manifest: 5, predictions: 6,
  provider_profile: 7, provider_wallet_transaction: 7, safety_audit_event: 27,
  service_business: 3922, service_business_source_snapshot: 3930, service_request: 4,
  service_request_offer: 20, social_content_drafts: 617, social_content_sources: 1022,
  social_publish_intents: 8, social_tenants: 1160, transport_acquisition_source_snapshot: 603,
  work_item: 9632,
};
const BATCH3_TABLES = Object.keys(BATCH3_EXPECTED);
const BATCH3_EXPECTED_TOTAL = Object.values(BATCH3_EXPECTED).reduce((a,b)=>a+b,0);

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

log(`=== BATCH 3 EXECUTION · ${BATCH3_TABLES.length} tables · expected ${BATCH3_EXPECTED_TOTAL} rows ===`);

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

const cols1 = BATCH1_TABLES.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const b1sumPre = Object.values((await q(`SELECT ${cols1}`)).body[0]).reduce((a,v)=>a+Number(v),0);
if (b1sumPre !== 722) bail(`Batch 1 drift: ${b1sumPre}/722`);
log(`  ✓ Batch 1 still 722`);

const cols2 = BATCH2_TABLES.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const b2sumPre = Object.values((await q(`SELECT ${cols2}`)).body[0]).reduce((a,v)=>a+Number(v),0);
if (b2sumPre !== 9689) bail(`Batch 2 drift: ${b2sumPre}/9689`);
log(`  ✓ Batch 2 still 9689`);

const cols3 = BATCH3_TABLES.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const b3sumPre = Object.values((await q(`SELECT ${cols3}`)).body[0]).reduce((a,v)=>a+Number(v),0);
if (b3sumPre !== 0) bail(`Batch 3 tables not empty: ${b3sumPre}`);
log(`  ✓ Batch 3 target tables all empty (0/0)`);

const ro = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
if (ro.enabled) bail("readonly enabled");
log(`  ✓ readonly enabled=false`);

const preState = { db_bytes: inv.db_bytes, db_pretty: inv.db_pretty, wal_lsn: inv.wal_lsn };
log(`  DB size PRE:  ${preState.db_pretty}  (${Number(preState.db_bytes).toLocaleString()} bytes)`);
log(`  WAL LSN PRE:  ${preState.wal_lsn}`);

// Special: pre-capture conv_knowledge_items details (Philip wants toast behavior)
const ckPre = (await q(`
  SELECT
    pg_total_relation_size('nex.conv_knowledge_items') AS total,
    pg_relation_size('nex.conv_knowledge_items') AS heap,
    pg_indexes_size('nex.conv_knowledge_items') AS idx,
    (SELECT pg_total_relation_size(reltoastrelid) FROM pg_class WHERE oid='nex.conv_knowledge_items'::regclass) AS toast
`)).body[0];
log(`  conv_knowledge_items PRE: total=${ckPre.total}, heap=${ckPre.heap}, idx=${ckPre.idx}, toast=${ckPre.toast}`);

log("\n─── PRE-CHECK PASSED · executing pg_restore ───");

// ================================ EXECUTE ================================
const t0 = Date.now();
const args = [
  "--dbname", DB_URL, "--role=service_role", "--data-only", "--schema=nex",
  `--use-list=${LIST_FILE}`, "--jobs=1", "--exit-on-error", "--verbose",
  "--no-owner", "--no-acl", BACKUP,
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

// Batch 3 reconciliation
const b3Post = (await q(`SELECT ${cols3}`)).body[0];
let matched = 0, mismatched = 0, totalActual = 0;
const failed = [];
for (const t of BATCH3_TABLES) {
  const actual = Number(b3Post[t]);
  const expected = BATCH3_EXPECTED[t];
  totalActual += actual;
  if (actual === expected) matched++;
  else { mismatched++; failed.push({ table: t, expected, actual }); }
}
if (failed.length === 0) log(`  ✓ ALL ${matched}/${BATCH3_TABLES.length} Batch 3 tables match · total = ${totalActual} (expected ${BATCH3_EXPECTED_TOTAL})`);
else {
  log(`  ❌ ${failed.length} mismatches:`);
  for (const r of failed) log(`     ${r.table.padEnd(45)} expected=${r.expected}  actual=${r.actual}`);
  log(`  matched: ${matched}, mismatched: ${mismatched}, total: ${totalActual}/${BATCH3_EXPECTED_TOTAL}`);
}

// Batch 1 + 2 still exact
const b1sumPost = Object.values((await q(`SELECT ${cols1}`)).body[0]).reduce((a,v)=>a+Number(v),0);
const b2sumPost = Object.values((await q(`SELECT ${cols2}`)).body[0]).reduce((a,v)=>a+Number(v),0);
log(`  Batch 1 still: ${b1sumPost}/722 ${b1sumPost === 722 ? "✓" : "❌"}`);
log(`  Batch 2 still: ${b2sumPost}/9689 ${b2sumPost === 9689 ? "✓" : "❌"}`);

// public
const pp = (await q(`SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables, (SELECT count(*) FROM public.knowledge_records) AS kr, (SELECT count(*) FROM public.worker_jobs) AS wj, (SELECT count(*) FROM public.worker_results) AS wr`)).body[0];
const pubOk = pp.public_tables === 17 && pp.kr === 3627 && pp.wj === 19167 && pp.wr === 19140;
log(`  public POST: ${JSON.stringify(pp)} · unchanged=${pubOk ? "✓" : "❌"}`);

// RLS + FK
const rlsPost = (await q(`SELECT count(*) FILTER (WHERE c.relrowsecurity=true) AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r'`)).body[0];
log(`  RLS POST: ${rlsPost.rls_enabled} (expected 92) ${rlsPost.rls_enabled === 92 ? "✓" : "❌"}`);
const fkPost = (await q(`SELECT count(*) AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f'`)).body[0];
log(`  FK POST: ${fkPost.n} (expected 0) ${Number(fkPost.n) === 0 ? "✓" : "❌"}`);

// readonly
const roPost = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  readonly POST: enabled=${roPost.enabled}`);

// Special: conv_knowledge_items TOAST behavior
const ckPost = (await q(`
  SELECT
    pg_total_relation_size('nex.conv_knowledge_items') AS total,
    pg_relation_size('nex.conv_knowledge_items') AS heap,
    pg_indexes_size('nex.conv_knowledge_items') AS idx,
    (SELECT pg_total_relation_size(reltoastrelid) FROM pg_class WHERE oid='nex.conv_knowledge_items'::regclass) AS toast,
    (SELECT count(*) FROM nex.conv_knowledge_items) AS rows
`)).body[0];
log(`\n  conv_knowledge_items POST: rows=${ckPost.rows}, total=${(Number(ckPost.total)/1024/1024).toFixed(2)} MB, heap=${(Number(ckPost.heap)/1024).toFixed(0)} KB, idx=${(Number(ckPost.idx)/1024).toFixed(0)} KB, toast=${(Number(ckPost.toast)/1024/1024).toFixed(2)} MB`);
log(`  conv_knowledge_items local source was: total=10 MB, heap=568 KB, idx=328 KB, toast=9.4 MB`);
const toastMB = Number(ckPost.toast) / 1024 / 1024;
const toastAnomaly = toastMB < 5 || toastMB > 15;
log(`  toast behavior: ${toastAnomaly ? "⚠️ ANOMALY · expected ~9.4 MB, got " + toastMB.toFixed(2) + " MB" : "✓ within expected range"}`);

// Efficiency report
const B2_BYTES_PER_ROW = 6479872 / 9689;
const B3_BYTES_PER_ROW = dbDelta / totalActual;
log(`\n  Batch 2 efficiency: ${B2_BYTES_PER_ROW.toFixed(0)} B/row`);
log(`  Batch 3 efficiency: ${B3_BYTES_PER_ROW.toFixed(0)} B/row`);

const report = {
  batch: 3, pg_restore_exit: exit, elapsed_seconds: Number(elapsed),
  pre: preState, post,
  db_delta_bytes: dbDelta, db_delta_pretty: `${(dbDelta/1024/1024).toFixed(2)} MB`,
  wal_delta: `${preState.wal_lsn} → ${post.wal_lsn}`,
  batch3_reconciliation: { matched, mismatched, expected_total: BATCH3_EXPECTED_TOTAL, actual_total: totalActual, failures: failed },
  batch1_still_intact: b1sumPost === 722, batch2_still_intact: b2sumPost === 9689,
  public_baseline_post: pp, public_unchanged: pubOk,
  rls_state_post: rlsPost, rls_unchanged: rlsPost.rls_enabled === 92,
  fks_post: Number(fkPost.n), readonly_post: roPost,
  conv_knowledge_items: { pre: ckPre, post: ckPost, toast_anomaly: toastAnomaly },
  bytes_per_row_batch3: Math.round(B3_BYTES_PER_ROW),
};
writeFileSync(resolve(__dirname, "batch-03-report.json"), JSON.stringify(report, null, 2));
log(`\n─── HARD STOP · Batch 3 complete · awaiting Philip approval for Batch 4 ───`);
process.exit(exit);
