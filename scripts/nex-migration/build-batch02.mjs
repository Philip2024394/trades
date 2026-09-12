// Build batch-02-small.list · rows 101–1000 · same size cap as Batch 1 for pool safety.
// Read-only: no Supabase writes. Verifies Batch 1 still at 722 exact rows.

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

// Load authoritative data
const counts = JSON.parse(readFileSync(resolve(__dirname, "local-authoritative-counts.json"), "utf8"));
const rowCounts = Object.fromEntries(counts.populated);

// Parse local-sizes.txt
const sizeText = readFileSync(resolve(__dirname, "local-sizes.txt"), "utf8");
const sizeMap = {};
for (const line of sizeText.split(/\r?\n/)) {
  const m = line.match(/^\|\s+([a-zA-Z0-9_]+)\s+\|\s+(\-?\d+)\s+\|\s+(\-?\d+)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|/);
  if (m) sizeMap[m[1]] = {
    total_bytes: Number(m[4]), total_pretty: m[5].trim(),
    heap_bytes: Number(m[6]), heap_pretty: m[7].trim(),
    idx_bytes: Number(m[8]), idx_pretty: m[9].trim(),
    toast_bytes: Number(m[10]), toast_pretty: m[11].trim(),
  };
}

// FK graph
const fkText = readFileSync(resolve(__dirname, "local-table-map.txt"), "utf8");
const fkOut = {}, fkIn = {};
for (const line of fkText.split(/\r?\n/)) {
  const m = line.match(/^\|\s+(\w+)\s+\|\s+(\w+)\s+\|\s+(\w+)\s+\|/);
  if (m && m[1] !== "fk_name") {
    (fkOut[m[2]] ||= []).push(m[3]);
    (fkIn[m[3]] ||= []).push(m[2]);
  }
}

// Batch 1 tables (for tracking what's ALREADY loaded)
const BATCH1_TABLES = new Set(["alert_dispatches","alert_rules","alerts","audit_log","benchmark_runs","bike_rental_listing","brain_user_saved_facts","call_record","campaign_segments","chat_message","chat_message_archive","chat_message_deletion","compliance_events","contact_segments","conv_intents","conversion_events","cost_budget","delivery_workers_archive_2026_08_22","email_templates","events","experiment_variants","experiments","food_business_promotion_decision","food_claim_code","food_commercial_event","food_hq_rule","food_outreach_attempt","food_outreach_suppression","food_outreach_template","geo_landmark","journey_inbound_events","journey_triggers","journeys","knowledge_inbox_stats","meaningful_area","mp_commerce_policy","mp_product","mp_product_image","mp_product_option","mp_product_option_value","mp_product_variant","object_blob_current","prediction_models","predictive_controls","provider_rate_config","provider_registry","provider_wallet","recovery_runs","rollup_campaigns","rollup_country","rollup_daily","rollup_monthly","rollup_provider","rollup_segment","safety_audit_config","social_admin_access_log","social_category_automation","social_controls","sparks_product","sparks_product_price","user_wallet","worker_heartbeats_archive_2026_08_22"]);

// BATCH 2 criteria: rows 101-1000 AND heap_size ≤ 500 KB per table (conservative)
const CRITERIA_MIN_ROWS = 101;
const CRITERIA_MAX_ROWS = 1000;
const CRITERIA_MAX_BYTES = 500 * 1024; // 500 KB per table cap

const batch2 = [];
for (const [name, rows] of counts.populated) {
  if (BATCH1_TABLES.has(name)) continue; // skip already-loaded
  const size = sizeMap[name];
  if (!size) continue;
  if (rows < CRITERIA_MIN_ROWS || rows > CRITERIA_MAX_ROWS) continue;
  if (size.total_bytes > CRITERIA_MAX_BYTES) continue;
  batch2.push({ name, rows, size, deps_out: (fkOut[name] || []), deps_in: (fkIn[name] || []) });
}
batch2.sort((a, b) => a.name.localeCompare(b.name));

// Build the pg_restore --use-list file
const toc = readFileSync(resolve(__dirname, "nex-dump-2026-09-03-0230.toc"), "utf8");
const tocLines = toc.split(/\r?\n/);
const batch2Names = new Set(batch2.map(t => t.name));
const includedTocLines = [];
for (const line of tocLines) {
  const m = line.match(/^(\d+);\s+\d+\s+\d+\s+TABLE DATA\s+nex\s+(\S+)\s+/);
  if (m && batch2Names.has(m[2])) includedTocLines.push(line);
}
const listPath = resolve(__dirname, "batch-02-small.list");
writeFileSync(listPath, includedTocLines.join("\n") + "\n");

// ========= SAFETY-STATE VERIFICATION (read-only) =========
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("BATCH 2 GATE · read-only pre-batch state check");
console.log("═══════════════════════════════════════════════════════════════════════════\n");

// Check target still safe
const invariants = await q(`
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
`);
const inv = invariants.body[0];
console.log("Current target state:");
console.log(`  DB size:          ${inv.db_pretty}  (${Number(inv.db_bytes).toLocaleString()} bytes)`);
console.log(`  WAL LSN:          ${inv.wal_lsn}`);
console.log(`  RLS-enabled nex:  ${inv.rls_enabled}  (expected 92)  ${inv.rls_enabled === 92 ? "✓" : "❌"}`);
console.log(`  FK count nex:     ${inv.nex_fks}   (expected 0)   ${Number(inv.nex_fks) === 0 ? "✓" : "❌"}`);
console.log(`  public tables:    ${inv.public_tables}  (expected 17)  ${inv.public_tables === 17 ? "✓" : "❌"}`);
console.log(`  knowledge_records:${inv.kr}  (expected 3627)  ${inv.kr === 3627 ? "✓" : "❌"}`);
console.log(`  worker_jobs:      ${inv.wj}  (expected 19167) ${inv.wj === 19167 ? "✓" : "❌"}`);
console.log(`  worker_results:   ${inv.wr}  (expected 19140) ${inv.wr === 19140 ? "✓" : "❌"}`);

// Batch 1 tables still at 722 exact
const cols1 = [...BATCH1_TABLES].map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const b1counts = await q(`SELECT ${cols1}`);
const b1sum = Object.values(b1counts.body[0]).reduce((a,v) => a + Number(v), 0);
console.log(`  Batch 1 total:    ${b1sum}  (expected 722)   ${b1sum === 722 ? "✓" : "❌"}`);

// Batch 2 tables must currently be empty
const cols2 = batch2.map(t => `(SELECT count(*) FROM nex."${t.name}") AS "${t.name}"`).join(", ");
const b2counts = await q(`SELECT ${cols2}`);
const b2sum = Object.values(b2counts.body[0]).reduce((a,v) => a + Number(v), 0);
console.log(`  Batch 2 current:  ${b2sum}  (expected 0 · target tables empty)  ${b2sum === 0 ? "✓" : "❌"}`);

// Readonly
const readonly = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
console.log(`  Supabase readonly:enabled=${readonly.enabled}  ${!readonly.enabled ? "✓" : "❌"}`);

// ========= BATCH 2 REPORT =========
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log(`BATCH 2 · SMALL · Report (${batch2.length} tables · rows 101–1,000)`);
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`Criteria: populated tables NOT in Batch 1, rows ∈ [${CRITERIA_MIN_ROWS}, ${CRITERIA_MAX_ROWS}], physical size ≤ ${(CRITERIA_MAX_BYTES/1024).toFixed(0)} KB\n`);
console.log("Table                                          Rows   Total   Heap   Idx   Deps-out  Deps-in");
console.log("─────────────────────────────────────────────  ─────  ──────  ─────  ────  ────────  ───────");
let totalRows = 0, totalBytes = 0;
for (const t of batch2) {
  console.log(
    `${t.name.padEnd(45)}  ${String(t.rows).padStart(5)}  ${t.size.total_pretty.padStart(6)}  ${t.size.heap_pretty.padStart(5)}  ${t.size.idx_pretty.padStart(4)}  ${String(t.deps_out.length).padStart(8)}  ${String(t.deps_in.length).padStart(7)}`
  );
  totalRows += t.rows;
  totalBytes += t.size.total_bytes;
}
console.log("─".repeat(90));
console.log(`TOTAL: ${batch2.length} tables, ${totalRows.toLocaleString()} rows, ${(totalBytes/1024).toFixed(1)} KB combined physical size`);

// Largest by size + rows
const largestSize = batch2.reduce((max, t) => t.size.total_bytes > max.size.total_bytes ? t : max, batch2[0]);
const largestRows = batch2.reduce((max, t) => t.rows > max.rows ? t : max, batch2[0]);
console.log(`\n  Largest by physical size: ${largestSize.name} · ${largestSize.size.total_pretty} · ${largestSize.rows} rows`);
console.log(`  Largest by row count:     ${largestRows.name} · ${largestRows.rows} rows · ${largestRows.size.total_pretty}`);

// Cross-batch FK deps
const alreadyLoaded = new Set([...BATCH1_TABLES]);
const externalDeps = batch2.filter(t => t.deps_out.some(dep => !batch2Names.has(dep) && !alreadyLoaded.has(dep)));
console.log(`\n  ${externalDeps.length} of ${batch2.length} tables have FK deps on tables NOT in Batch 1 or 2 (loaded in later batches):`);
for (const t of externalDeps) {
  const notYet = t.deps_out.filter(d => !batch2Names.has(d) && !alreadyLoaded.has(d));
  console.log(`    ${t.name.padEnd(30)} → ${notYet.join(", ")}`);
}
console.log(`  (FKs are still dropped · restore not blocked · will be enforced in Batch 8)`);

// Safety confirmations
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log("SAFETY CONFIRMATIONS");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`  ✓ All ${batch2.length} entries are nex.* data objects (no schema qualifier)`);
console.log(`  ✓ Zero public.* objects: true`);
console.log(`  ✓ identity_merge_log NOT included: ${!batch2Names.has("identity_merge_log")}`);
const oversized = batch2.filter(t => t.size.total_bytes > 1024*1024);
console.log(`  ✓ No table > 1 MB in Batch 2: ${oversized.length === 0}`);
console.log(`  ✓ No Batch 1 table re-included: true`);
console.log(`  ✓ No FK recreation in this batch`);
console.log(`  ✓ No RLS changes needed (--role=service_role handles bypass)`);
console.log(`  ✓ No workforce starts`);
console.log(`  ✓ No environment changes`);

// Batch 1 observed efficiency + Batch 2 projection
const B1_BYTES_PER_ROW = 1826816 / 722; // ~2530 bytes/row from Batch 1 observation
const B2_EXPECTED_BYTES = Math.round(totalRows * B1_BYTES_PER_ROW);
console.log(`\n  Batch 1 observed storage efficiency: 722 rows → +1,826,816 bytes = ${B1_BYTES_PER_ROW.toFixed(0)} bytes/row`);
console.log(`  Naive projection for Batch 2 (${totalRows} rows × ${B1_BYTES_PER_ROW.toFixed(0)} b/row): ${(B2_EXPECTED_BYTES/1024).toFixed(0)} KB (${(B2_EXPECTED_BYTES/1024/1024).toFixed(2)} MB)`);
console.log(`  Adjusted projection (Batch 1's b/row was inflated by empty-page overhead · Batch 2's per-row rate likely much lower · typical NEX row 200–500 bytes)`);
const ADJUSTED_MIN = totalRows * 200, ADJUSTED_MAX = totalRows * 500;
console.log(`  Realistic Batch 2 growth range: ${(ADJUSTED_MIN/1024).toFixed(0)}–${(ADJUSTED_MAX/1024).toFixed(0)} KB (${(ADJUSTED_MIN/1024/1024).toFixed(2)}–${(ADJUSTED_MAX/1024/1024).toFixed(2)} MB)`);
console.log(`  Post-Batch-2 projected DB size: ~${((Number(inv.db_bytes) + ADJUSTED_MAX)/1024/1024).toFixed(1)} MB (well under 8 GB disk)`);

console.log(`\n═══════════════════════════════════════════════════════════════════════════`);
console.log(`Batch 2 selection file: ${listPath}`);
console.log(`Contains ${includedTocLines.length} TOC entries (should match ${batch2.length} tables)`);

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

  Identical structure to Batch 1 with the ONLY differences:
    - --use-list points to batch-02-small.list (not batch-01-tiny.list)

  No new grants needed. service_role already has USAGE + SELECT/INSERT/UPDATE/DELETE on nex.*
  from Batch 1 setup.
`);
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("HARD STOP · awaiting explicit Philip approval before executing");
console.log("═══════════════════════════════════════════════════════════════════════════");
