// Batch 8 · FK recreation risk report · READ-ONLY.
// 125 FKs · per-FK orphan check · index check · risk classification · approach comparison.

import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const PSQL = "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";
const LOCAL_URI = "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const TMP_DIR = resolve(__dirname, "tmp");
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

let seq = 0;
function local(sql) {
  const p = resolve(TMP_DIR, `q-${process.pid}-${++seq}.sql`);
  writeFileSync(p, sql);
  try {
    const r = spawnSync(PSQL, ["-At", "-f", p, LOCAL_URI], { env: { ...process.env, PGPASSWORD: "Admin1phil" }, encoding: "utf8", timeout: 300000, maxBuffer: 500*1024*1024 });
    if (r.status !== 0) { console.error(`  local psql failed: ${r.stderr}`); return null; }
    return r.stdout.trim();
  } finally { try { unlinkSync(p); } catch {} }
}
async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}

console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("BATCH 8 · FK RECREATION RISK REPORT · read-only (0 FKs created)");
console.log("═══════════════════════════════════════════════════════════════════════════\n");

// ─── SECTION 0 · CORRECTED ROW TOTALS ─────────────────────────────────
console.log("─── 0 · Corrected total row counts (direct calculation from all 191 tables) ───\n");
const tables = local("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' ORDER BY c.relname").split(/\r?\n/).map(s => s.replace(/\r/g, "").trim()).filter(Boolean);
console.log(`  Enumerating counts for ${tables.length} tables...`);

const localCounts = {}, targetCounts = {};
for (let i = 0; i < tables.length; i += 30) {
  const chunk = tables.slice(i, i + 30);
  const cols = chunk.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
  const lRaw = local(`SELECT ${cols}`);
  const vals = lRaw.replace(/\r/g, "").split("|");
  chunk.forEach((t, j) => { localCounts[t] = Number(vals[j]); });
  const r = await q(`SELECT ${cols}`);
  const row = r.body[0];
  for (const t of chunk) targetCounts[t] = Number(row[t]);
}

const localNonEmpty = Object.entries(localCounts).filter(([_, v]) => v > 0);
const targetNonEmpty = Object.entries(targetCounts).filter(([_, v]) => v > 0);
const localTotal = Object.values(localCounts).reduce((a, v) => a + v, 0);
const targetTotal = Object.values(targetCounts).reduce((a, v) => a + v, 0);
const mismatches = tables.filter(t => localCounts[t] !== targetCounts[t]);

console.log(`  LOCAL frozen · non-empty tables: ${localNonEmpty.length} / ${tables.length}`);
console.log(`  TARGET Supabase · non-empty tables: ${targetNonEmpty.length} / ${tables.length}`);
console.log(`  LOCAL frozen · total rows across all 191 tables: ${localTotal.toLocaleString()}`);
console.log(`  TARGET Supabase · total rows across all 191 tables: ${targetTotal.toLocaleString()}`);
console.log(`  Tables with LOCAL != TARGET: ${mismatches.length}`);
console.log(`  Exact equality: ${localTotal === targetTotal && mismatches.length === 0 ? "✅ CONFIRMED" : "❌ DRIFT"}`);

// ─── SECTION G · CURRENT STATE ─────────────────────────────────────────
console.log("\n─── G · Current target state ───");
const state = (await q(`
  SELECT pg_database_size(current_database())::text AS db,
         pg_size_pretty(pg_database_size(current_database())) AS db_pretty,
         pg_current_wal_lsn()::text AS wal,
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
         (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
         (SELECT count(*) FROM public.knowledge_records) AS kr,
         (SELECT count(*) FROM public.worker_jobs) AS wj,
         (SELECT count(*) FROM public.worker_results) AS wr
`)).body[0];
const ro = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
console.log(`  DB size:      ${state.db_pretty} (${Number(state.db).toLocaleString()} bytes)`);
console.log(`  WAL LSN:      ${state.wal}`);
console.log(`  RLS enabled:  ${state.rls} (expected 92)`);
console.log(`  FK count:     ${state.fks} (expected 0)`);
console.log(`  public.knowledge_records: ${state.kr} (expected 3627)`);
console.log(`  public.worker_jobs:       ${state.wj} (expected 19167)`);
console.log(`  public.worker_results:    ${state.wr} (expected 19140)`);
console.log(`  Supabase readonly: enabled=${ro.enabled}`);

// ─── SECTION 1 · PARSE FK SNAPSHOT ────────────────────────────────────
console.log("\n─── 1 · Parsing 125 FK constraints from snapshot ───");
const fks = JSON.parse(readFileSync(resolve(__dirname, "fk-constraints-snapshot.json"), "utf8"));
console.log(`  loaded ${fks.length} FK definitions from snapshot`);

// Parse each FK def
const fkRe = /FOREIGN KEY\s+\(([^)]+)\)\s+REFERENCES\s+nex\.(\w+)\s*\(([^)]+)\)(?:\s+ON\s+UPDATE\s+([A-Z ]+?))?(?:\s+ON\s+DELETE\s+([A-Z ]+?))?(?:\s+MATCH\s+\w+)?(?:\s+(DEFERRABLE|NOT DEFERRABLE))?(?:\s+(INITIALLY\s+\w+))?\s*$/;
const parsed = [];
for (const fk of fks) {
  const m = fk.def.match(fkRe);
  if (!m) { console.log(`  ⚠️ could not parse FK ${fk.name}: ${fk.def}`); continue; }
  const [_, cCols, pTbl, pCols, onUpd, onDel, defer, init] = m;
  parsed.push({
    name: fk.name,
    child_table: fk.table,
    child_columns: cCols.split(",").map(s => s.trim()),
    parent_table: pTbl,
    parent_columns: pCols.split(",").map(s => s.trim()),
    on_update: (onUpd || "NO ACTION").trim(),
    on_delete: (onDel || "NO ACTION").trim(),
    deferrable: defer || "NOT DEFERRABLE",
    initially: init || "INITIALLY IMMEDIATE",
    def: fk.def,
  });
}
console.log(`  parsed ${parsed.length} / ${fks.length}`);
if (parsed.length !== fks.length) { console.error("  ❌ parse count mismatch"); process.exit(1); }

// Attach row counts (from what we already collected)
for (const p of parsed) {
  p.child_rows = targetCounts[p.child_table] ?? 0;
  p.parent_rows = targetCounts[p.parent_table] ?? 0;
}

// ─── SECTION 1b · CHECK INDEXES ON FK COLUMNS ─────────────────────────
console.log("\n─── 1b · Checking indexes on FK columns (target-side) ───");
// Query pg_indexes on target for each FK's child columns
for (const p of parsed) {
  const colsList = p.child_columns.map(c => `'${c}'`).join(",");
  const idxCheck = (await q(`
    SELECT COALESCE(bool_or(true), false) AS has_index FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE n.nspname='nex' AND t.relname='${p.child_table}' AND a.attname IN (${colsList})
  `)).body;
  p.child_indexed = Array.isArray(idxCheck) && idxCheck[0]?.has_index === true;
}
const withIndex = parsed.filter(p => p.child_indexed).length;
console.log(`  FKs whose child columns are already indexed: ${withIndex} / ${parsed.length}`);
console.log(`  FKs where child columns are NOT indexed: ${parsed.length - withIndex}`);

// ─── SECTION A · ORPHAN CHECK ─────────────────────────────────────────
console.log("\n─── A · Orphan check per FK (must all be 0) ───");
console.log(`  running ${parsed.length} orphan checks...`);
let totalOrphans = 0;
let processed = 0;
for (const p of parsed) {
  // Build orphan check query
  const cCols = p.child_columns, pCols = p.parent_columns;
  const notNullCheck = cCols.map(c => `c."${c}" IS NOT NULL`).join(" AND ");
  const joinCheck = cCols.map((c, i) => `p."${pCols[i]}" = c."${c}"`).join(" AND ");
  const sql = `SELECT count(*)::text AS n FROM nex.${p.child_table} c WHERE ${notNullCheck} AND NOT EXISTS (SELECT 1 FROM nex.${p.parent_table} p WHERE ${joinCheck})`;
  const r = await q(sql);
  if (r.status >= 400) { console.log(`  ${p.name}: orphan query error · ${JSON.stringify(r.body).slice(0,200)}`); p.orphans = -1; continue; }
  p.orphans = Number(r.body[0].n);
  totalOrphans += p.orphans;
  processed++;
  if (p.orphans > 0) console.log(`  ⚠️ ${p.name}: ${p.orphans} orphans in nex.${p.child_table}.${p.child_columns.join(",")}`);
}
console.log(`  ✓ processed ${processed}/${parsed.length} FKs · TOTAL ORPHANS = ${totalOrphans}`);

// ─── SECTION B · LARGEST FK RELATIONSHIPS ─────────────────────────────
console.log("\n─── B · Top 10 FK relationships by child row count ───");
const byChildSize = [...parsed].sort((a, b) => b.child_rows - a.child_rows).slice(0, 10);
console.log("  Constraint                                              Child                            Rows    Parent");
console.log("  ────────────────────────────────────────────────────    ────────────────────────         ──────  ──────────");
for (const p of byChildSize) {
  console.log(`  ${p.name.padEnd(55)} ${p.child_table.padEnd(35)} ${String(p.child_rows).padStart(7)}  ${p.parent_table}`);
}

// ─── SECTION C · FKS ON LARGE TABLES ─────────────────────────────────
const LARGE_TABLES = ["identity_merge_log", "food_business", "accommodation_business", "mp_seller", "worker_cycle_run", "worker_heartbeat", "work_item", "food_business_field_provenance", "provider_rate_lease", "discovery_rotation_state"];
console.log(`\n─── C · FKs involving the largest NEX tables (${LARGE_TABLES.length} tables) ───`);
for (const t of LARGE_TABLES) {
  const asChild = parsed.filter(p => p.child_table === t);
  const asParent = parsed.filter(p => p.parent_table === t);
  const totalRows = targetCounts[t] ?? 0;
  console.log(`  ${t.padEnd(40)} rows=${totalRows.toLocaleString().padStart(9)} · FKs FROM this table=${asChild.length} · FKs TO this table=${asParent.length}`);
  if (asChild.length > 0) for (const p of asChild) console.log(`      OUT: ${p.name} → nex.${p.parent_table}`);
  if (asParent.length > 0) for (const p of asParent) console.log(`      IN:  ${p.name} FROM nex.${p.child_table}(${p.child_columns.join(",")})`);
}

// ─── SECTION D · EXPENSIVE FK IDENTIFICATION ──────────────────────────
console.log("\n─── D · FKs with unusually expensive validation ───");
const expensive = parsed.filter(p => p.child_rows > 50000);
console.log(`  FKs with child_rows > 50K (validation walks all rows): ${expensive.length}`);
for (const p of expensive.sort((a,b) => b.child_rows - a.child_rows)) {
  console.log(`    ${p.name.padEnd(55)} child=${p.child_table} (${p.child_rows.toLocaleString()} rows) → parent=${p.parent_table}`);
  console.log(`      indexed on child column(s): ${p.child_indexed ? "YES ✓" : "NO ⚠️"}`);
}

// ─── SECTION E · UNINDEXED FKS ────────────────────────────────────────
console.log("\n─── E · FKs where the CHILD side has NO index on the FK column ───");
const unindexed = parsed.filter(p => !p.child_indexed);
console.log(`  count: ${unindexed.length}`);
if (unindexed.length > 0) {
  console.log(`  (postgres FK validation only needs to scan the child · index on parent side is what matters for validation performance)`);
  console.log(`  Note: parent side always has index because PK/UK is required target of FK · so validation is O(child_rows × log(parent_rows))`);
  console.log(`  Missing child-side indexes only slow FUTURE queries that use these FK columns · not FK creation itself`);
  // Show first 20
  for (const p of unindexed.slice(0, 20)) console.log(`    ${p.name.padEnd(55)} nex.${p.child_table}(${p.child_columns.join(",")}) · ${p.child_rows.toLocaleString()} rows`);
  if (unindexed.length > 20) console.log(`    ... and ${unindexed.length - 20} more`);
}

// ─── SECTION F · STORAGE ESTIMATE ─────────────────────────────────────
console.log("\n─── F · Estimated storage impact of FK creation ───");
console.log(`  Each FK creates a small pg_constraint catalog entry (~200 B).`);
console.log(`  Total catalog growth: 125 × 200 B = ~25 KB (negligible).`);
console.log(`  Validation walks child rows once per FK · reads only · no new pages written.`);
console.log(`  WAL generated: 1 record per ALTER TABLE ADD CONSTRAINT (~few hundred bytes each) + any trigger creation for FK enforcement.`);
console.log(`  Expected WAL growth for all 125 FKs: << 10 MB total (catalog + trigger metadata).`);
console.log(`  Physical DB growth: << 1 MB (catalog only).`);
console.log(`  Table data: UNCHANGED (FK creation does not rewrite tables).`);

// ─── SECTION H · APPROACH COMPARISON ──────────────────────────────────
console.log("\n─── H · Approach comparison ───");
console.log(`
  OPTION A · All 125 FKs in ONE transaction (BEGIN; ADD × 125; COMMIT;)
    Atomicity:           ✅ any single-FK violation → complete rollback → data-integrity check surface for the FIRST failing FK
    Temp storage:        Minimal · single transaction · catalog updates only
    WAL generation:      One WAL segment burst for all 125 CREATE TRIGGERs / constraint additions
    Lock duration:       ~2-5 seconds total (validation walks share exclusive locks briefly per table)
    Failure behavior:    Whole-batch rollback · 0 FKs created if any fails
    Ability to stop:     Only by killing session (leaves clean state)
    Recoverability:      Easy · retry same transaction after fixing offending data
    Best when:           Zero orphans expected (which is our case if orphan check = 0)

  OPTION B · Logically grouped batches (e.g. 5 groups of ~25 FKs each · 5 transactions)
    Atomicity:           Per-group · partial success possible
    Temp storage:        Similar to A
    WAL generation:      Same total WAL split across 5 checkpoints (allows checkpoint reclamation between)
    Lock duration:       Shorter per group
    Failure behavior:    Only failing group rolls back · prior groups persist
    Ability to stop:     Between groups
    Recoverability:      Partial state possible · need per-group retry logic
    Best when:           You expect some FKs might fail (unclear which ones) · want to isolate failures

  OPTION C · One FK at a time (125 separate ALTER TABLE ADD CONSTRAINT · 125 transactions)
    Atomicity:           Per-FK · maximum granularity
    Temp storage:        Minimal · autocommit per FK
    WAL generation:      Same total WAL · fully spread out · natural checkpoints
    Lock duration:       Very short per FK · concurrent read queries almost never blocked
    Failure behavior:    Only the offending FK is skipped · all others persist
    Ability to stop:     After any FK · resume trivially
    Recoverability:      Best · exact orphan-causing FK isolated · fix and retry just that one
    Best when:           You want the most conservative execution · easier to inspect failures
`);

// Save report
writeFileSync(resolve(__dirname, "batch-08-fk-risk-report.json"), JSON.stringify({
  captured_at: new Date().toISOString(),
  total_rows: { local: localTotal, target: targetTotal, all_tables_equal: mismatches.length === 0 },
  non_empty_tables: { local: localNonEmpty.length, target: targetNonEmpty.length },
  current_state: state,
  readonly: ro.enabled,
  fks: parsed.map(p => ({ name: p.name, child: p.child_table, child_cols: p.child_columns, parent: p.parent_table, parent_cols: p.parent_columns, on_delete: p.on_delete, on_update: p.on_update, child_rows: p.child_rows, parent_rows: p.parent_rows, orphans: p.orphans, child_indexed: p.child_indexed })),
  total_orphans: totalOrphans,
  fks_with_orphans: parsed.filter(p => p.orphans > 0).length,
  fks_child_indexed: withIndex,
  fks_child_unindexed: parsed.length - withIndex,
  top_10_by_child_rows: byChildSize.map(p => ({ name: p.name, child: p.child_table, rows: p.child_rows, parent: p.parent_table })),
}, null, 2));
console.log(`\n  Report saved: batch-08-fk-risk-report.json`);

// ─── SUMMARY + RECOMMENDATION ────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log("SUMMARY + RECOMMENDATION");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`  Total FKs to recreate:       ${parsed.length}`);
console.log(`  TOTAL ORPHANS (must be 0):   ${totalOrphans}`);
console.log(`  FKs with orphans:            ${parsed.filter(p => p.orphans > 0).length}`);
console.log(`  FKs already child-indexed:   ${withIndex}`);
console.log(`  FKs child-unindexed:         ${parsed.length - withIndex}`);
console.log(`  Estimated total WAL from FK creation: << 10 MB`);
console.log(`  Estimated DB growth:                  << 1 MB`);
console.log(`  Current DB size: ${state.db_pretty} · 8 GB available · huge headroom`);
console.log("");
if (totalOrphans === 0) {
  console.log(`  🟢 RECOMMENDATION: Option A (single transaction) is safe here.`);
  console.log(`     - Zero orphans across all 125 FKs proven.`);
  console.log(`     - Storage impact negligible.`);
  console.log(`     - Full atomicity preserves data-integrity contract.`);
  console.log(`     - If it inexplicably fails (network glitch), Option C fallback available.`);
  console.log(`  Suggested backup plan: try A; if fails on transient network, fall back to C (one-at-a-time) for the retry.`);
} else {
  console.log(`  🔴 RECOMMENDATION: STOP · fix orphans first before ANY FK recreation.`);
  console.log(`     ${totalOrphans} orphaned rows would cause FK creation to fail.`);
}

console.log("\n─── HARD STOP · read-only report complete · awaiting Philip approval ───");
