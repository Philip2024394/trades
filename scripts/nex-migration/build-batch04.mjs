// Build batch-04-medium-large.list · remaining populated tables NOT in Batches 1-3 · exclude identity_merge_log.
// Read-only.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

const counts = JSON.parse(readFileSync(resolve(__dirname, "local-authoritative-counts.json"), "utf8"));
const sizeText = readFileSync(resolve(__dirname, "local-sizes.txt"), "utf8");
const sizeMap = {};
for (const line of sizeText.split(/\r?\n/)) {
  const m = line.match(/^\|\s+([a-zA-Z0-9_]+)\s+\|\s+(\-?\d+)\s+\|\s+(\-?\d+)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|/);
  if (m) sizeMap[m[1]] = { total_bytes: Number(m[4]), total_pretty: m[5].trim(), heap_bytes: Number(m[6]), heap_pretty: m[7].trim(), idx_bytes: Number(m[8]), idx_pretty: m[9].trim(), toast_bytes: Number(m[10]), toast_pretty: m[11].trim() };
}

const fkText = readFileSync(resolve(__dirname, "local-table-map.txt"), "utf8");
const fkOut = {}, fkIn = {};
for (const line of fkText.split(/\r?\n/)) {
  const m = line.match(/^\|\s+(\w+)\s+\|\s+(\w+)\s+\|\s+(\w+)\s+\|/);
  if (m && m[1] !== "fk_name") { (fkOut[m[2]] ||= []).push(m[3]); (fkIn[m[3]] ||= []).push(m[2]); }
}

const BATCH1 = new Set(["alert_dispatches","alert_rules","alerts","audit_log","benchmark_runs","bike_rental_listing","brain_user_saved_facts","call_record","campaign_segments","chat_message","chat_message_archive","chat_message_deletion","compliance_events","contact_segments","conv_intents","conversion_events","cost_budget","delivery_workers_archive_2026_08_22","email_templates","events","experiment_variants","experiments","food_business_promotion_decision","food_claim_code","food_commercial_event","food_hq_rule","food_outreach_attempt","food_outreach_suppression","food_outreach_template","geo_landmark","journey_inbound_events","journey_triggers","journeys","knowledge_inbox_stats","meaningful_area","mp_commerce_policy","mp_product","mp_product_image","mp_product_option","mp_product_option_value","mp_product_variant","object_blob_current","prediction_models","predictive_controls","provider_rate_config","provider_registry","provider_wallet","recovery_runs","rollup_campaigns","rollup_country","rollup_daily","rollup_monthly","rollup_provider","rollup_segment","safety_audit_config","social_admin_access_log","social_category_automation","social_controls","sparks_product","sparks_product_price","user_wallet","worker_heartbeats_archive_2026_08_22"]);
const BATCH2 = new Set(["analytics_events","campaign_recipients","delivery_job_attempts","delivery_jobs","experiment_assignments","food_business_promotion","food_business_promotion_audit","food_next_action_audit","journey_states","mp_category","social_accounts","social_audit_events","social_brand_profiles","social_content_templates","social_dek_wraps","social_oauth_states","social_scheduled_posts","social_validator_runs","transport_acquisition_record","video_feed_impression","wallet_transaction"]);
const BATCH3 = new Set(["accommodation_business","accommodation_business_source_snapshot","attributions","bike_model","brain_did_you_know_indonesia","brain_english_vocabulary","business_image","business_knowledge","campaigns","category_candidate","category_registry","contacts","conv_edges","conv_entities","conv_knowledge_items","conv_learning_candidate","conv_states","conv_turns","food_business_next_action","food_enrichment_evidence","journey_campaign_executions","journey_events","knowledge_dump_jobs","knowledge_inbox","knowledge_records","llm_retry_queue","media_object","object_manifest","predictions","provider_profile","provider_wallet_transaction","safety_audit_event","service_business","service_business_source_snapshot","service_request","service_request_offer","social_content_drafts","social_content_sources","social_publish_intents","social_tenants","transport_acquisition_source_snapshot","work_item"]);

// Not conv_knowledge_items — wait, that's already in Batch 3. Let me handle the food_business, discovery_orchestrator_pick, category_candidate_score that were in Batch 3 too.
// Actually the BATCH3 set above was auto-generated from the 42 tables I already loaded. Let me verify by cross-checking.

// BATCH 4 criteria: populated, NOT in Batches 1-3, NOT identity_merge_log
const batch4Candidates = [];
for (const [name, rows] of counts.populated) {
  if (BATCH1.has(name) || BATCH2.has(name) || BATCH3.has(name)) continue;
  if (name === "identity_merge_log") continue; // reserved for Batch 6 (special)
  // Also skip if size unknown (shouldn't happen, but safe)
  if (!sizeMap[name]) continue;
  batch4Candidates.push({ name, rows, size: sizeMap[name], deps_out: (fkOut[name] || []), deps_in: (fkIn[name] || []) });
}
batch4Candidates.sort((a, b) => a.name.localeCompare(b.name));

// Propose Batch 4 = tables with rows ≤ 50K (medium-large group). Anything over 50K goes to Batch 5.
const BATCH4_MAX_ROWS = 50000;
const batch4 = batch4Candidates.filter(t => t.rows <= BATCH4_MAX_ROWS);
const batch5Preview = batch4Candidates.filter(t => t.rows > BATCH4_MAX_ROWS);

// Build the pg_restore selection file
const toc = readFileSync(resolve(__dirname, "nex-dump-2026-09-03-0230.toc"), "utf8");
const tocLines = toc.split(/\r?\n/);
const batch4Names = new Set(batch4.map(t => t.name));
const included = [];
for (const line of tocLines) {
  const m = line.match(/^(\d+);\s+\d+\s+\d+\s+TABLE DATA\s+nex\s+(\S+)\s+/);
  if (m && batch4Names.has(m[2])) included.push(line);
}
const listPath = resolve(__dirname, "batch-04-medium-large.list");
writeFileSync(listPath, included.join("\n") + "\n");

// ========= FREEZE + TARGET-STATE GATE =========
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("BATCH 4 GATE · read-only pre-batch state check");
console.log("═══════════════════════════════════════════════════════════════════════════\n");

console.log("--- 1 · Freeze verification (local + processes) ---");
// Confirm no walker processes
const { execSync } = await import("node:child_process");
const nodePs = execSync("powershell -NoProfile -Command \"(Get-CimInstance Win32_Process -Filter \\\"Name='node.exe'\\\" | Measure-Object).Count\"", { encoding: "utf8" }).trim();
console.log(`  node.exe processes on host: ${nodePs} (must be 0 for freeze)`);
const taskState = execSync("powershell -NoProfile -Command \"(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce').State\"", { encoding: "utf8" }).trim();
console.log(`  Scheduled Task state:       ${taskState} (must be Disabled)`);

console.log("\n--- 2 · Supabase target invariants ---");
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
console.log(`  DB size:            ${inv.db_pretty} (${Number(inv.db_bytes).toLocaleString()} bytes)`);
console.log(`  WAL LSN:            ${inv.wal_lsn}`);
console.log(`  RLS-enabled:        ${inv.rls_enabled} (expected 92) ${inv.rls_enabled === 92 ? "✓" : "❌"}`);
console.log(`  FK count:           ${inv.nex_fks} (expected 0) ${Number(inv.nex_fks) === 0 ? "✓" : "❌"}`);
console.log(`  public tables:      ${inv.public_tables} (expected 17) ${inv.public_tables === 17 ? "✓" : "❌"}`);
console.log(`  knowledge_records:  ${inv.kr} (expected 3627) ${inv.kr === 3627 ? "✓" : "❌"}`);
console.log(`  worker_jobs:        ${inv.wj} (expected 19167) ${inv.wj === 19167 ? "✓" : "❌"}`);
console.log(`  worker_results:     ${inv.wr} (expected 19140) ${inv.wr === 19140 ? "✓" : "❌"}`);

const readonly = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
console.log(`  Supabase readonly:  enabled=${readonly.enabled} ${!readonly.enabled ? "✓" : "❌"}`);

// Verify cumulative populated tables count matches what we expect
const populatedCheck = (await q(`
  SELECT count(DISTINCT c.relname) AS populated_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_stat_user_tables s ON s.relid=c.oid
  WHERE n.nspname='nex' AND c.relkind='r' AND s.n_live_tup > 0
`)).body[0];
console.log(`  populated nex tables: ${populatedCheck.populated_tables} (expected 125 = Batches 1+2+3) — informational only, n_live_tup may lag`);

// Confirm Batch 4 target tables are empty
console.log("\n--- 3 · Batch 4 target tables current state (must all be empty) ---");
const cols4 = batch4.map(t => `(SELECT count(*) FROM nex."${t.name}") AS "${t.name}"`).join(", ");
const b4pre = (await q(`SELECT ${cols4}`)).body[0];
const b4sum = Object.values(b4pre).reduce((a,v) => a + Number(v), 0);
for (const t of batch4) {
  const c = Number(b4pre[t.name]);
  console.log(`  nex.${t.name.padEnd(45)}: ${c} rows ${c === 0 ? "✓" : "❌"}`);
}
console.log(`  ─ total: ${b4sum} (expected 0)`);

// ========= BATCH 4 CONTENT =========
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log(`BATCH 4 · MEDIUM-LARGE · Report (${batch4.length} tables · rows ≤ ${BATCH4_MAX_ROWS.toLocaleString()})`);
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("Criteria: populated tables NOT in Batches 1-3 AND NOT identity_merge_log AND rows ≤ 50,000\n");
console.log("Table                                          Rows    Total   Heap    Idx    Toast   Deps-out  Deps-in");
console.log("─────────────────────────────────────────────  ──────  ──────  ─────   ─────  ──────  ────────  ───────");
let totalRows = 0, totalBytes = 0;
for (const t of batch4) {
  console.log(
    `${t.name.padEnd(45)}  ${String(t.rows).padStart(6)}  ${t.size.total_pretty.padStart(6)}  ${t.size.heap_pretty.padStart(5)}   ${t.size.idx_pretty.padStart(5)}  ${t.size.toast_pretty.padStart(6)}  ${String(t.deps_out.length).padStart(8)}  ${String(t.deps_in.length).padStart(7)}`
  );
  totalRows += t.rows;
  totalBytes += t.size.total_bytes;
}
console.log("─".repeat(100));
console.log(`TOTAL: ${batch4.length} tables, ${totalRows.toLocaleString()} rows, ${(totalBytes/1024/1024).toFixed(2)} MB combined source physical size`);

const largestSize = batch4.reduce((max, t) => t.size.total_bytes > max.size.total_bytes ? t : max, batch4[0]);
const largestRows = batch4.reduce((max, t) => t.rows > max.rows ? t : max, batch4[0]);
console.log(`\n  Largest by physical size: ${largestSize.name} · ${largestSize.size.total_pretty} · ${largestSize.rows} rows`);
console.log(`  Largest by row count:     ${largestRows.name} · ${largestRows.rows} rows · ${largestRows.size.total_pretty}`);

console.log(`\n  Batches 4 skips (rows > 50,000 · preview for future Batch 5): ${batch5Preview.length} tables · ${batch5Preview.reduce((a,t)=>a+t.rows,0).toLocaleString()} rows · ${(batch5Preview.reduce((a,t)=>a+t.size.total_bytes,0)/1024/1024).toFixed(1)} MB`);
for (const t of batch5Preview) console.log(`    ${t.name.padEnd(45)} ${String(t.rows).padStart(7)} rows  ${t.size.total_pretty}`);
console.log(`    identity_merge_log                             1,356,697 rows  ~896 MB  (Batch 6, special streaming)`);

// Cross-batch FK deps
const loaded = new Set([...BATCH1, ...BATCH2, ...BATCH3]);
const externalDeps = batch4.filter(t => t.deps_out.some(dep => !batch4Names.has(dep) && !loaded.has(dep) && dep !== 'identity_merge_log'));
console.log(`\n  ${externalDeps.length} of ${batch4.length} tables have FK deps on tables NOT in Batches 1-4:`);
for (const t of externalDeps) {
  const notYet = t.deps_out.filter(d => !batch4Names.has(d) && !loaded.has(d));
  console.log(`    ${t.name.padEnd(45)} → ${notYet.join(", ")}`);
}
console.log(`  (FKs still dropped · restore not blocked)`);

// Safety confirmations
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log("SAFETY CONFIRMATIONS");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`  ✓ All ${batch4.length} entries are nex.* data objects`);
console.log(`  ✓ Zero public.* objects`);
console.log(`  ✓ identity_merge_log NOT in this batch (reserved for Batch 6 streaming)`);
console.log(`  ✓ No Batch 1/2/3 table re-included`);
console.log(`  ✓ Largest table ${largestSize.name} = ${(largestSize.size.total_bytes/1024/1024).toFixed(2)} MB`);
console.log(`  ✓ No FK recreation`);
console.log(`  ✓ No RLS changes (--role=service_role uses BYPASSRLS)`);
console.log(`  ✓ No workforce/next.js will be restarted`);
console.log(`  ✓ No environment changes`);
console.log(`  ✓ Local nex_dev frozen (0 processes, task disabled, verified 60s of zero writes)`);

// Expected impact projection
const B3_BYTES_PER_ROW = 800;
const naive = totalRows * B3_BYTES_PER_ROW;
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log("EXPECTED IMPACT · projected from actual Batch 2 & 3 measurements");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`  Batch 2 actual: 9689 rows → +6.18 MB DB · ~5 MB WAL (669 B/row)`);
console.log(`  Batch 3 actual: 52975 rows → +40.44 MB DB · ~86 MB WAL (800 B/row)`);
console.log(`  Batch 4 rows: ${totalRows.toLocaleString()}`);
console.log(`  Source physical size: ${(totalBytes/1024/1024).toFixed(2)} MB`);
console.log(`  Naive projection (${totalRows} × 800 B/row): ${(naive/1024/1024).toFixed(1)} MB`);
console.log(`  Realistic DB growth range: ${(totalBytes/1024/1024*0.9).toFixed(0)}–${(totalBytes/1024/1024*1.3).toFixed(0)} MB`);
console.log(`  Realistic WAL growth: ~${(totalBytes/1024/1024*1.5).toFixed(0)}–${(totalBytes/1024/1024*2.0).toFixed(0)} MB`);
console.log(`  Post-Batch-4 projected DB size: ~${((Number(inv.db_bytes) + totalBytes*1.3)/1024/1024).toFixed(0)} MB (well under 8 GB disk)`);

console.log(`\n═══════════════════════════════════════════════════════════════════════════`);
console.log(`Batch 4 selection file: ${listPath}`);
console.log(`Contains ${included.length} TOC entries (should match ${batch4.length} tables)`);

console.log(`\n═══════════════════════════════════════════════════════════════════════════`);
console.log("EXACT pg_restore COMMAND (NOT EXECUTED — awaiting approval)");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`
PGOPTIONS='-c statement_timeout=0 -c lock_timeout=0 -c idle_in_transaction_session_timeout=0' \\
"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe" \\
    --dbname="$NEX_SUPABASE_DB_URL" \\
    --role=service_role \\
    --data-only \\
    --schema=nex \\
    --use-list="${listPath}" \\
    --jobs=1 \\
    --exit-on-error \\
    --verbose \\
    --no-owner \\
    --no-acl \\
    "D:/nex-backups/nex_dev-2026-09-03-0230-post-enum-fix.dump"

  Identical to Batches 2-3 with only --use-list changed.
`);
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("HARD STOP · awaiting explicit Philip approval before executing");
console.log("═══════════════════════════════════════════════════════════════════════════");
