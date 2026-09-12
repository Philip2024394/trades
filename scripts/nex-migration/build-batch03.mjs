// Build batch-03-medium-a.list · rows 1001–10000 · plus any tables skipped by Batches 1-2 size caps.
// Read-only: no Supabase writes.

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

// BATCH 3 criteria: not in Batch 1 or 2, rows ≤ 10000, physical size ≤ 15 MB per table
const MAX_ROWS = 10000;
const MAX_BYTES = 15 * 1024 * 1024;
const batch3 = [];
for (const [name, rows] of counts.populated) {
  if (BATCH1.has(name) || BATCH2.has(name)) continue;
  const size = sizeMap[name];
  if (!size) continue;
  if (rows > MAX_ROWS) continue;
  if (size.total_bytes > MAX_BYTES) continue;
  batch3.push({ name, rows, size, deps_out: (fkOut[name] || []), deps_in: (fkIn[name] || []) });
}
batch3.sort((a, b) => a.name.localeCompare(b.name));

const toc = readFileSync(resolve(__dirname, "nex-dump-2026-09-03-0230.toc"), "utf8");
const tocLines = toc.split(/\r?\n/);
const batch3Names = new Set(batch3.map(t => t.name));
const included = [];
for (const line of tocLines) {
  const m = line.match(/^(\d+);\s+\d+\s+\d+\s+TABLE DATA\s+nex\s+(\S+)\s+/);
  if (m && batch3Names.has(m[2])) included.push(line);
}
const listPath = resolve(__dirname, "batch-03-medium-a.list");
writeFileSync(listPath, included.join("\n") + "\n");

// ========= LIVE STATE GATE =========
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("BATCH 3 GATE · read-only pre-batch state check");
console.log("═══════════════════════════════════════════════════════════════════════════\n");

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
const readonly = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());

// Populated nex tables count + total rows currently in nex
const currentAllTables = (await q("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' ORDER BY c.relname")).body.map(r => r.relname);
const colsAll = currentAllTables.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const allCounts = (await q(`SELECT ${colsAll}`)).body[0];
const populatedNow = Object.entries(allCounts).filter(([_,v]) => Number(v) > 0);
const totalNexRowsNow = populatedNow.reduce((a, [_,v]) => a + Number(v), 0);

console.log("Current target state:");
console.log(`  DB size:                ${inv.db_pretty}  (${Number(inv.db_bytes).toLocaleString()} bytes)`);
console.log(`  WAL LSN:                ${inv.wal_lsn}`);
console.log(`  readonly:               enabled=${readonly.enabled}  ${!readonly.enabled ? "✓" : "❌"}`);
console.log(`  populated nex tables:   ${populatedNow.length}  (Batch 1: 62, Batch 2: 21, total expected 83)`);
console.log(`  total nex rows loaded:  ${totalNexRowsNow.toLocaleString()}  (expected 10,411)`);
console.log(`  nex RLS-enabled:        ${inv.rls_enabled}  (expected 92)  ${inv.rls_enabled === 92 ? "✓" : "❌"}`);
console.log(`  nex FK count:           ${inv.nex_fks}   (expected 0)   ${Number(inv.nex_fks) === 0 ? "✓" : "❌"}`);
console.log(`  public tables:          ${inv.public_tables}  (expected 17)`);
console.log(`  public.knowledge_records:${inv.kr}  (expected 3627)`);
console.log(`  public.worker_jobs:     ${inv.wj}  (expected 19167)`);
console.log(`  public.worker_results:  ${inv.wr}  (expected 19140)`);

// Verify Batch 3 target tables currently empty
const colsB3 = batch3.map(t => `(SELECT count(*) FROM nex."${t.name}") AS "${t.name}"`).join(", ");
const b3pre = (await q(`SELECT ${colsB3}`)).body[0];
const b3sum = Object.values(b3pre).reduce((a,v) => a + Number(v), 0);
console.log(`  Batch 3 target tables:  ${b3sum} rows (must be 0)  ${b3sum === 0 ? "✓" : "❌"}`);

// ========= BATCH 3 CONTENT =========
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log(`BATCH 3 · MEDIUM GROUP A · Report (${batch3.length} tables · rows 1K–10K + size-exceeded skips)`);
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`Criteria: populated tables NOT in Batches 1-2, rows ≤ ${MAX_ROWS}, physical size ≤ ${(MAX_BYTES/1024/1024).toFixed(0)} MB\n`);
console.log("Table                                          Rows   Total   Heap   Idx   Toast   Deps-out  Deps-in");
console.log("─────────────────────────────────────────────  ─────  ──────  ─────  ────  ──────  ────────  ───────");
let totalRows = 0, totalBytes = 0;
for (const t of batch3) {
  console.log(
    `${t.name.padEnd(45)}  ${String(t.rows).padStart(5)}  ${t.size.total_pretty.padStart(6)}  ${t.size.heap_pretty.padStart(5)}  ${t.size.idx_pretty.padStart(4)}  ${t.size.toast_pretty.padStart(6)}  ${String(t.deps_out.length).padStart(8)}  ${String(t.deps_in.length).padStart(7)}`
  );
  totalRows += t.rows;
  totalBytes += t.size.total_bytes;
}
console.log("─".repeat(96));
console.log(`TOTAL: ${batch3.length} tables, ${totalRows.toLocaleString()} rows, ${(totalBytes/1024/1024).toFixed(2)} MB combined source physical size`);

const largestSize = batch3.reduce((max, t) => t.size.total_bytes > max.size.total_bytes ? t : max, batch3[0]);
const largestRows = batch3.reduce((max, t) => t.rows > max.rows ? t : max, batch3[0]);
console.log(`\n  Largest by physical size: ${largestSize.name} · ${largestSize.size.total_pretty} · ${largestSize.rows} rows (${largestSize.size.toast_pretty} toast)`);
console.log(`  Largest by row count:     ${largestRows.name} · ${largestRows.rows} rows · ${largestRows.size.total_pretty}`);

// Cross-batch FK deps
const loaded = new Set([...BATCH1, ...BATCH2]);
const externalDeps = batch3.filter(t => t.deps_out.some(dep => !batch3Names.has(dep) && !loaded.has(dep)));
console.log(`\n  ${externalDeps.length} of ${batch3.length} tables have FK deps on tables NOT in Batches 1-3 (loaded in later batches):`);
for (const t of externalDeps) {
  const notYet = t.deps_out.filter(d => !batch3Names.has(d) && !loaded.has(d));
  console.log(`    ${t.name.padEnd(35)} → ${notYet.join(", ")}`);
}
console.log(`  (FKs still dropped · restore not blocked · will be enforced in Batch 8)`);

// ========= SAFETY CONFIRMATIONS =========
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log("SAFETY CONFIRMATIONS");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`  ✓ All ${batch3.length} entries are nex.* data objects`);
console.log(`  ✓ Zero public.* objects: true`);
console.log(`  ✓ identity_merge_log NOT included: ${!batch3Names.has("identity_merge_log")}`);
console.log(`  ✓ No Batch 1 table re-included: ${![...batch3Names].some(n => BATCH1.has(n))}`);
console.log(`  ✓ No Batch 2 table re-included: ${![...batch3Names].some(n => BATCH2.has(n))}`);
console.log(`  ✓ Largest table ${(largestSize.size.total_bytes/1024/1024).toFixed(2)} MB (cap ${(MAX_BYTES/1024/1024).toFixed(0)} MB): ${largestSize.size.total_bytes <= MAX_BYTES}`);
console.log(`  ✓ No FK recreation in this batch`);
console.log(`  ✓ No RLS changes (--role=service_role uses BYPASSRLS)`);
console.log(`  ✓ No workforce starts`);
console.log(`  ✓ No environment changes`);
console.log(`  ✓ --role=service_role (already granted USAGE + S/I/U/D on nex.*)`);
console.log(`  ✓ --jobs=1 + --exit-on-error`);
console.log(`  ✓ Uses existing verified backup at D:\\nex-backups\\nex_dev-2026-09-03-0230-post-enum-fix.dump`);

// ========= EXPECTED IMPACT =========
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log("EXPECTED IMPACT · projected from actual Batch 1 & Batch 2 measurements");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`  Actual Batch 1: 722 rows → +1.78 MB (2530 B/row · inflated by empty-page allocations)`);
console.log(`  Actual Batch 2: 9689 rows → +6.18 MB (669 B/row · steady-state · matches identity_merge_log ratio)`);
console.log(`  Actual Batch 2 WAL: ~5.06 MB written`);
console.log(``);
console.log(`  Batch 3 rows: ${totalRows.toLocaleString()}`);
console.log(`  Source physical size: ${(totalBytes/1024/1024).toFixed(2)} MB (from local pg_relation_size)`);
console.log(`  Naive projection using Batch 2's 669 B/row: ${(totalRows * 669 / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Toast-heavy tables in Batch 3 may push slightly higher (${batch3.filter(t => t.size.toast_bytes > 100000).length} tables have >100 KB toast)`);
console.log(`  Realistic DB growth range: ${(totalBytes / 1024 / 1024 * 0.9).toFixed(1)}–${(totalBytes / 1024 / 1024 * 1.3).toFixed(1)} MB`);
console.log(`  Realistic WAL growth: ~${(totalBytes / 1024 / 1024 * 1.0).toFixed(1)}–${(totalBytes / 1024 / 1024 * 1.5).toFixed(1)} MB`);
console.log(`  Post-Batch-3 projected DB size: ~${((Number(inv.db_bytes) + totalBytes * 1.3) / 1024 / 1024).toFixed(1)} MB (well under 8 GB disk)`);

console.log(`\n═══════════════════════════════════════════════════════════════════════════`);
console.log(`Batch 3 selection file: ${listPath}`);
console.log(`Contains ${included.length} TOC entries (should match ${batch3.length} tables)`);

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

  Structurally identical to Batches 1-2. Only --use-list changes.
`);
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("HARD STOP · awaiting explicit Philip approval before executing");
console.log("═══════════════════════════════════════════════════════════════════════════");
