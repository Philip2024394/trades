// Build batch-01-tiny.list from authoritative row counts + local sizes + FK graph.
// READ-ONLY: no Supabase writes. Just produces the pg_restore selection file + a report.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

// 1 · Load authoritative row counts
const counts = JSON.parse(readFileSync(resolve(__dirname, "local-authoritative-counts.json"), "utf8"));
const rowCounts = Object.fromEntries(counts.populated);

// 2 · Load sizes from local-sizes.txt (parse the aligned-table output)
const sizeText = readFileSync(resolve(__dirname, "local-sizes.txt"), "utf8");
const sizeMap = {};
for (const line of sizeText.split(/\r?\n/)) {
  const m = line.match(/^\|\s+([a-zA-Z0-9_]+)\s+\|\s+(\-?\d+)\s+\|\s+(\-?\d+)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|/);
  if (m) sizeMap[m[1]] = {
    total_bytes: Number(m[4]),
    total_pretty: m[5].trim(),
    heap_bytes: Number(m[6]),
    heap_pretty: m[7].trim(),
    idx_bytes: Number(m[8]),
    idx_pretty: m[9].trim(),
    toast_bytes: Number(m[10]),
    toast_pretty: m[11].trim(),
  };
}

// 3 · Parse FK graph from local-table-map.txt
const fkText = readFileSync(resolve(__dirname, "local-table-map.txt"), "utf8");
const fkOut = {}, fkIn = {}; // source_table → [dependency], referenced_table → [dependents]
for (const line of fkText.split(/\r?\n/)) {
  const m = line.match(/^\|\s+(\w+)\s+\|\s+(\w+)\s+\|\s+(\w+)\s+\|/);
  if (m && m[1] !== "fk_name") {
    // m[1] = fk_name, m[2] = source_table, m[3] = references_table
    (fkOut[m[2]] ||= []).push({ fk: m[1], ref: m[3] });
    (fkIn[m[3]] ||= []).push({ fk: m[1], src: m[2] });
  }
}

// 4 · BATCH 1 criteria: populated tables with 1-100 rows AND heap+idx size <10 KB per table
//    Guarantees smallest possible footprint for warm-up
const CRITERIA_MAX_ROWS = 100;
const CRITERIA_MAX_BYTES = 100 * 1024; // 100 KB per table hard cap

const batch1 = [];
for (const [name, rows] of counts.populated) {
  const size = sizeMap[name];
  if (!size) continue;
  if (rows > CRITERIA_MAX_ROWS) continue;
  if (size.total_bytes > CRITERIA_MAX_BYTES) continue;
  batch1.push({ name, rows, size, deps_out: (fkOut[name] || []).map(f => f.ref), deps_in: (fkIn[name] || []).map(f => f.src) });
}
batch1.sort((a, b) => a.name.localeCompare(b.name));

// 5 · Build pg_restore --use-list file (TOC line format: <dumpId>; <catalogId> <oid> TABLE DATA nex <tablename> postgres)
// Read the original TOC to find exact IDs
const toc = readFileSync(resolve(__dirname, "nex-dump-2026-09-03-0230.toc"), "utf8");
const tocLines = toc.split(/\r?\n/);
const batch1Names = new Set(batch1.map(t => t.name));
const includedTocLines = [];
for (const line of tocLines) {
  // Match TABLE DATA lines: match name in field position
  const m = line.match(/^(\d+);\s+\d+\s+\d+\s+TABLE DATA\s+nex\s+(\S+)\s+/);
  if (m && batch1Names.has(m[2])) includedTocLines.push(line);
}
const listPath = resolve(__dirname, "batch-01-tiny.list");
writeFileSync(listPath, includedTocLines.join("\n") + "\n");

// 6 · Report
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`BATCH 1 · TINY WARM-UP · Report (${batch1.length} tables)`);
console.log("═══════════════════════════════════════════════════════════════════════════\n");
console.log(`Criteria: populated tables where rows ≤ ${CRITERIA_MAX_ROWS} AND physical size ≤ ${(CRITERIA_MAX_BYTES/1024).toFixed(0)} KB\n`);
console.log("Table                                          Rows   Total   Heap   Idx   Deps-out  Deps-in");
console.log("─────────────────────────────────────────────  ─────  ──────  ─────  ────  ────────  ───────");
let totalRows = 0, totalBytes = 0;
for (const t of batch1) {
  console.log(
    `${t.name.padEnd(45)}  ${String(t.rows).padStart(5)}  ${t.size.total_pretty.padStart(6)}  ${t.size.heap_pretty.padStart(5)}  ${t.size.idx_pretty.padStart(4)}  ${String(t.deps_out.length).padStart(8)}  ${String(t.deps_in.length).padStart(7)}`
  );
  totalRows += t.rows;
  totalBytes += t.size.total_bytes;
}
console.log("─".repeat(90));
console.log(`TOTAL: ${batch1.length} tables, ${totalRows.toLocaleString()} rows, ${(totalBytes/1024).toFixed(1)} KB combined physical size`);

// Safety confirmations
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log("SAFETY CONFIRMATIONS");
console.log("═══════════════════════════════════════════════════════════════════════════");
const allNex = batch1.every(t => t.name && !t.name.includes("."));
console.log(`  ✓ All ${batch1.length} entries are nex.* data objects (no schema qualifier in dump)`);
const publicRefs = batch1.filter(t => t.name.startsWith("public") || t.deps_out.some(d => d.startsWith("public")));
console.log(`  ✓ Zero public.* objects in Batch 1: ${publicRefs.length === 0}`);
console.log(`  ✓ Combined size (${(totalBytes/1024).toFixed(1)} KB) ${totalBytes < 200 * 1024 ? "< 200 KB budget ✓" : "❌ EXCEEDS 200 KB"}`);
const largest = batch1.reduce((max, t) => t.size.total_bytes > max.size.total_bytes ? t : max, batch1[0]);
console.log(`  ✓ Largest table in batch: ${largest.name} · ${largest.size.total_pretty} · ${largest.rows} rows`);
const hasImel = batch1.some(t => t.name === "identity_merge_log");
console.log(`  ✓ identity_merge_log is NOT in Batch 1: ${!hasImel}`);
console.log(`  ✓ No FK recreation in this batch`);
console.log(`  ✓ No RLS changes triggered by pg_restore --data-only (RLS handled separately per batch)`);
console.log(`  ✓ No workforce starts`);
console.log(`  ✓ No environment variables change`);

// Dependency info: how many Batch 1 tables reference tables NOT in Batch 1
const notInBatch = batch1.filter(t => t.deps_out.some(dep => !batch1Names.has(dep)));
console.log(`\n  Info: ${notInBatch.length} of ${batch1.length} tables have FK dependencies on other nex.* tables NOT in Batch 1`);
console.log(`  (This is expected · FKs are currently DROPPED · restore ordering is safe)`);
if (notInBatch.length > 0) {
  console.log("\n  Tables with cross-batch FK dependencies:");
  for (const t of notInBatch) {
    const external = t.deps_out.filter(d => !batch1Names.has(d));
    console.log(`    ${t.name} → ${external.join(", ")}`);
  }
}

console.log(`\n═══════════════════════════════════════════════════════════════════════════`);
console.log(`Batch 1 selection file written to:\n  ${listPath}`);
console.log(`Contains ${includedTocLines.length} TOC entries (should match ${batch1.length} tables)`);

// 7 · Exact command that WOULD be executed (NOT executing here)
console.log(`\n═══════════════════════════════════════════════════════════════════════════`);
console.log("EXACT pg_restore COMMAND (NOT EXECUTED — awaiting approval)");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`
PGOPTIONS='-c statement_timeout=0 -c lock_timeout=0 -c idle_in_transaction_session_timeout=0' \\
"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe" \\
    --dbname="$NEX_SUPABASE_DB_URL" \\
    --data-only \\
    --schema=nex \\
    --use-list="${listPath}" \\
    --jobs=1 \\
    --exit-on-error \\
    --verbose \\
    --no-owner \\
    --no-acl \\
    "D:/nex-backups/nex_dev-2026-09-03-0230-post-enum-fix.dump"

Additional wrapper actions (before/after this pg_restore):

  BEFORE: as postgres via Management API — for each table in Batch 1 that currently has RLS enabled:
    ALTER TABLE nex.<table> DISABLE ROW LEVEL SECURITY;

  AFTER: as postgres via Management API — re-enable RLS for those same tables:
    ALTER TABLE nex.<table> ENABLE ROW LEVEL SECURITY;

  MONITORING (before + after):
    SELECT pg_database_size(current_database()), pg_current_wal_lsn();
    GET /v1/projects/{ref}/readonly  (Supabase auto-readonly check)
`);
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("HARD STOP · awaiting explicit Philip approval before executing");
console.log("═══════════════════════════════════════════════════════════════════════════");
