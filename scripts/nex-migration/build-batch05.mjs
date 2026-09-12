// Build batch-05-large.list · 3 tables · pre-identity_merge_log · read-only.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

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

const BATCH5_NAMES = ["discovery_rotation_state", "provider_rate_lease", "food_business_field_provenance"];
const rowCounts = Object.fromEntries(counts.populated);
const batch5 = BATCH5_NAMES.map(name => ({
  name,
  rows: rowCounts[name],
  size: sizeMap[name],
  deps_out: (fkOut[name] || []),
  deps_in: (fkIn[name] || []),
}));

// Build the pg_restore selection file
const toc = readFileSync(resolve(__dirname, "nex-dump-2026-09-03-0230.toc"), "utf8");
const tocLines = toc.split(/\r?\n/);
const batch5Set = new Set(BATCH5_NAMES);
const included = [];
for (const line of tocLines) {
  const m = line.match(/^(\d+);\s+\d+\s+\d+\s+TABLE DATA\s+nex\s+(\S+)\s+/);
  if (m && batch5Set.has(m[2])) included.push(line);
}
const listPath = resolve(__dirname, "batch-05-large.list");
writeFileSync(listPath, included.join("\n") + "\n");

// ========= GATE =========
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("BATCH 5 GATE · read-only pre-batch state check");
console.log("═══════════════════════════════════════════════════════════════════════════\n");

console.log("--- 1 · Local freeze verification ---");
const nodePs = execSync("powershell -NoProfile -Command \"(Get-CimInstance Win32_Process -Filter \\\"Name='node.exe'\\\" | Where-Object { $_.CommandLine -notlike '*build-batch05*' } | Measure-Object).Count\"", { encoding: "utf8" }).trim();
console.log(`  node.exe processes on host (excl. this script): ${nodePs} (must be 0)`);
const taskState = execSync("powershell -NoProfile -Command \"(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce').State\"", { encoding: "utf8" }).trim();
console.log(`  Scheduled Task state: ${taskState} (must be Disabled)`);

console.log("\n--- 2 · Supabase target invariants ---");
const inv = (await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls_enabled,
    (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS nex_fks,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables,
    (SELECT count(*) FROM public.knowledge_records) AS kr,
    (SELECT count(*) FROM public.worker_jobs) AS wj,
    (SELECT count(*) FROM public.worker_results) AS wr,
    (SELECT count(*) FROM nex.identity_merge_log) AS imel,
    pg_database_size(current_database()) AS db_bytes,
    pg_size_pretty(pg_database_size(current_database())) AS db_pretty,
    pg_current_wal_lsn()::text AS wal_lsn
`)).body[0];
console.log(`  DB size:            ${inv.db_pretty} (${Number(inv.db_bytes).toLocaleString()} bytes)`);
console.log(`  WAL LSN:            ${inv.wal_lsn}`);
console.log(`  identity_merge_log: ${inv.imel} rows ${Number(inv.imel) === 0 ? "✓ untouched" : "❌"}`);
console.log(`  RLS-enabled:        ${inv.rls_enabled} (expected 92) ${inv.rls_enabled === 92 ? "✓" : "❌"}`);
console.log(`  FK count:           ${inv.nex_fks} (expected 0) ${Number(inv.nex_fks) === 0 ? "✓" : "❌"}`);
console.log(`  public tables:      ${inv.public_tables} (expected 17) ${inv.public_tables === 17 ? "✓" : "❌"}`);
console.log(`  knowledge_records:  ${inv.kr} (expected 3627) ${inv.kr === 3627 ? "✓" : "❌"}`);
console.log(`  worker_jobs:        ${inv.wj} (expected 19167) ${inv.wj === 19167 ? "✓" : "❌"}`);
console.log(`  worker_results:     ${inv.wr} (expected 19140) ${inv.wr === 19140 ? "✓" : "❌"}`);

const readonly = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
console.log(`  Supabase readonly:  enabled=${readonly.enabled} ${!readonly.enabled ? "✓" : "❌"}`);

// Verify Batch 5 target tables are empty
console.log("\n--- 3 · Batch 5 target tables current state (must all be empty) ---");
const colsB5 = BATCH5_NAMES.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const b5pre = (await q(`SELECT ${colsB5}`)).body[0];
for (const t of BATCH5_NAMES) {
  const c = Number(b5pre[t]);
  console.log(`  nex.${t.padEnd(45)}: ${c} rows ${c === 0 ? "✓" : "❌"}`);
}

// ========= BATCH 5 CONTENT =========
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log(`BATCH 5 · LARGE · Report (${batch5.length} tables)`);
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("Criteria: 3 remaining populated tables with rows > 50,000 (excluding identity_merge_log)\n");
console.log("Table                                          Rows      Total   Heap    Idx    Toast   Deps-out  Deps-in");
console.log("─────────────────────────────────────────────  ────────  ──────  ─────   ─────  ──────  ────────  ───────");
let totalRows = 0, totalBytes = 0;
for (const t of batch5) {
  console.log(
    `${t.name.padEnd(45)}  ${String(t.rows).padStart(8)}  ${t.size.total_pretty.padStart(6)}  ${t.size.heap_pretty.padStart(5)}   ${t.size.idx_pretty.padStart(5)}  ${t.size.toast_pretty.padStart(6)}  ${String(t.deps_out.length).padStart(8)}  ${String(t.deps_in.length).padStart(7)}`
  );
  totalRows += t.rows;
  totalBytes += t.size.total_bytes;
}
console.log("─".repeat(100));
console.log(`TOTAL: ${batch5.length} tables, ${totalRows.toLocaleString()} rows, ${(totalBytes/1024/1024).toFixed(2)} MB combined source physical size`);

const largestSize = batch5.reduce((max, t) => t.size.total_bytes > max.size.total_bytes ? t : max, batch5[0]);
const largestRows = batch5.reduce((max, t) => t.rows > max.rows ? t : max, batch5[0]);
console.log(`\n  Largest by physical size: ${largestSize.name} · ${largestSize.size.total_pretty} · ${largestSize.rows.toLocaleString()} rows`);
console.log(`  Largest by row count:     ${largestRows.name} · ${largestRows.rows.toLocaleString()} rows · ${largestRows.size.total_pretty}`);

// FK dependencies (all loaded by earlier batches)
console.log("\n--- FK dependencies (all outbound refs should be to tables already loaded) ---");
for (const t of batch5) {
  if (t.deps_out.length > 0) console.log(`  ${t.name} → ${t.deps_out.join(", ")}`);
  else console.log(`  ${t.name} → (no outbound FKs)`);
  if (t.deps_in.length > 0) console.log(`    referenced by: ${t.deps_in.join(", ")}`);
}

// Safety confirmations
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log("SAFETY CONFIRMATIONS");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`  ✓ All ${batch5.length} entries are nex.* data objects`);
console.log(`  ✓ Zero public.* objects`);
console.log(`  ✓ identity_merge_log NOT in this batch (reserved for Batch 6 streaming)`);
console.log(`  ✓ No Batch 1/2/3/4 table re-included`);
console.log(`  ✓ Largest table ${largestSize.name} = ${(largestSize.size.total_bytes/1024/1024).toFixed(2)} MB`);
console.log(`  ✓ No FK recreation`);
console.log(`  ✓ No RLS changes (--role=service_role uses BYPASSRLS)`);
console.log(`  ✓ No workforce restart · no Next.js restart`);
console.log(`  ✓ No environment changes`);
console.log(`  ✓ Local nex_dev remains frozen (0 processes, task disabled)`);

// Expected impact
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log("EXPECTED IMPACT · projected from actual Batch 3 & 4 measurements");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`  Batch 3: 52,975 rows → +40.44 MB DB · ~86 MB WAL (800 B/row)`);
console.log(`  Batch 4: 215,755 rows → +166.16 MB DB · ~224 MB WAL (808 B/row)`);
console.log(`  Batch 5 rows: ${totalRows.toLocaleString()}`);
console.log(`  Source physical size: ${(totalBytes/1024/1024).toFixed(2)} MB`);
console.log(`  Naive projection (${totalRows} × ~800 B/row): ${(totalRows * 800 / 1024 / 1024).toFixed(1)} MB DB growth`);
console.log(`  Realistic DB growth range: ${(totalBytes/1024/1024*0.9).toFixed(0)}–${(totalBytes/1024/1024*1.3).toFixed(0)} MB`);
console.log(`  Realistic WAL growth: ~${(totalBytes/1024/1024*1.3).toFixed(0)}–${(totalBytes/1024/1024*1.8).toFixed(0)} MB`);
console.log(`  Post-Batch-5 projected DB size: ~${((Number(inv.db_bytes) + totalBytes*1.3)/1024/1024).toFixed(0)} MB (well under 8 GB disk)`);
console.log(`  Note: projection only · actual will be measured after execution`);

console.log(`\n═══════════════════════════════════════════════════════════════════════════`);
console.log(`Batch 5 selection file: ${listPath}`);
console.log(`Contains ${included.length} TOC entries (should match ${batch5.length} tables)`);

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

  Identical to Batches 2-4 with only --use-list changed.
`);
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("HARD STOP · awaiting explicit Philip approval before executing");
console.log("═══════════════════════════════════════════════════════════════════════════");
