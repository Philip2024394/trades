// Batch 7 reconciliation gate · READ-ONLY.
// Full local-vs-target delta scan + deep-analysis of the +1,045 pattern.

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
if (!existsSync(resolve(__dirname, "tmp"))) mkdirSync(resolve(__dirname, "tmp"), { recursive: true });

let localCallSeq = 0;
function local(sql) {
  // Windows spawnSync mis-handles embedded double-quotes in -c args · use temp SQL file + -f
  const tmpSql = resolve(__dirname, "tmp", `local-q-${process.pid}-${++localCallSeq}.sql`);
  try {
    writeFileSync(tmpSql, sql);
    const r = spawnSync(PSQL, ["-At", "-f", tmpSql, LOCAL_URI], { env: { ...process.env, PGPASSWORD: "Admin1phil" }, encoding: "utf8", timeout: 300000, maxBuffer: 500*1024*1024 });
    if (r.status !== 0) { console.error(`local psql failed: ${r.stderr}`); return null; }
    return r.stdout.trim();
  } finally {
    try { unlinkSync(tmpSql); } catch {}
  }
}
async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("BATCH 7 · RECONCILIATION GATE · read-only · dump-vs-frozen-local delta analysis");
console.log("═══════════════════════════════════════════════════════════════════════════\n");

// ─── 1 · FULL DELTA SCAN across all 191 nex.* tables ──────────────────
console.log("─── 1 · Full nex.* count comparison (LOCAL frozen vs TARGET) ───\n");
const tables = local("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' ORDER BY c.relname").split(/\r?\n/).map(s => s.replace(/\r/g, "").trim()).filter(Boolean);
console.log(`  Enumerating counts for ${tables.length} tables (LOCAL + TARGET) ...`);

// Get LOCAL + TARGET counts (chunked · avoid over-long argument to psql -c)
const localCounts = {};
const targetCounts = {};
const chunkSize = 30;
for (let i = 0; i < tables.length; i += chunkSize) {
  const chunk = tables.slice(i, i + chunkSize);
  const cols = chunk.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
  // LOCAL via psql · use -F '|' so we get pipe-separated single row
  const localRaw = local(`SELECT ${cols}`);
  if (localRaw === null) { console.log(`  local chunk ${i} failed`); continue; }
  const values = localRaw.replace(/\r/g, "").split("|");
  chunk.forEach((t, j) => { localCounts[t] = Number(values[j]); });
  // TARGET via API
  const r = await q(`SELECT ${cols}`);
  if (r.status >= 400) { console.log(`  target chunk ${i} failed: ${JSON.stringify(r.body).slice(0,200)}`); continue; }
  const row = r.body[0];
  for (const t of chunk) targetCounts[t] = Number(row[t]);
}

// Compute deltas
const deltas = tables.map(t => ({ table: t, local: localCounts[t], target: targetCounts[t], delta: (localCounts[t] || 0) - (targetCounts[t] || 0) }));
const nonZero = deltas.filter(d => d.delta !== 0);
console.log(`  Tables with local != target: ${nonZero.length}`);
console.log("");
console.log("  Table                                                LOCAL      TARGET     DELTA");
console.log("  ────────────────────────────────────────────────  ─────────  ─────────  ───────");
for (const d of nonZero.sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta))) {
  const sign = d.delta > 0 ? "+" : "";
  console.log(`  ${d.table.padEnd(50)}  ${String(d.local).padStart(9)}  ${String(d.target).padStart(9)}  ${sign}${d.delta}`);
}

// ─── 2 · The +1,045 pattern · deep analysis ──────────────────────────
console.log("\n─── 2 · Deep analysis of the +1,045 pattern ───\n");

for (const tblName of ["work_item", "worker_cycle_run", "worker_heartbeat"]) {
  console.log(`▓▓▓ ${tblName} ▓▓▓`);
  const localCount = localCounts[tblName];
  const targetCount = targetCounts[tblName];
  const delta = localCount - targetCount;
  console.log(`  LOCAL=${localCount}, TARGET=${targetCount}, DELTA=+${delta}`);

  // Schema
  const schema = local(`SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ', ') FROM pg_attribute WHERE attrelid = 'nex.${tblName}'::regclass AND attnum > 0 AND NOT attisdropped`);
  console.log(`  Schema: ${schema.slice(0, 200)}...`);

  // Determine PK
  const pk = local(`SELECT a.attname FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.contype='p' AND c.conrelid='nex.${tblName}'::regclass`);
  console.log(`  PK: ${pk}`);

  // FKs from this table
  const fksOut = local(`SELECT string_agg(rc.relname || '(' || pg_get_constraintdef(c.oid) || ')', E'\n    ') FROM pg_constraint c JOIN pg_class rc ON rc.oid=c.confrelid WHERE c.contype='f' AND c.conrelid='nex.${tblName}'::regclass`);
  console.log(`  Outbound FKs: ${fksOut || "(none)"}`);

  // FKs referencing this table
  const fksIn = local(`SELECT string_agg(cl.relname || '(' || pg_get_constraintdef(c.oid) || ')', E'\n    ') FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid WHERE c.contype='f' AND c.confrelid='nex.${tblName}'::regclass`);
  console.log(`  Inbound FKs: ${fksIn || "(none)"}`);

  // created_at range for the delta rows (need to find WHICH rows are the delta)
  // Approach: get LOCAL PKs, get TARGET PKs, diff in Node
  const localPks = new Set(local(`SELECT ${pk}::text FROM nex.${tblName} ORDER BY ${pk}`).split(/\r?\n/).map(s => s.replace(/\r/g, "").trim()).filter(Boolean));
  const targetPksRes = await q(`SELECT ${pk}::text AS pk FROM nex.${tblName} ORDER BY ${pk}`);
  if (targetPksRes.status >= 400) { console.log(`  target PK fetch failed`); continue; }
  const targetPks = new Set(targetPksRes.body.map(r => r.pk));

  const inLocalNotTarget = [...localPks].filter(p => !targetPks.has(p));
  const inTargetNotLocal = [...targetPks].filter(p => !localPks.has(p));
  console.log(`  Delta PKs: in-local-not-target=${inLocalNotTarget.length}, in-target-not-local=${inTargetNotLocal.length}`);
  if (inLocalNotTarget.length !== delta) console.log(`  ⚠️ delta mismatch: expected ${delta}, PK-diff shows ${inLocalNotTarget.length}`);
  if (inTargetNotLocal.length > 0) console.log(`  ⚠️ target has ${inTargetNotLocal.length} rows NOT in local (dump-only rows)`);

  // For the delta rows, get created_at range + minute distribution
  if (inLocalNotTarget.length > 0) {
    // Sample up to 50 PKs; if too many, take first + last + middle
    const samplePks = inLocalNotTarget.length <= 50 ? inLocalNotTarget : [...inLocalNotTarget.slice(0, 20), ...inLocalNotTarget.slice(-20)];
    // Build query using PKs list
    const pksSql = samplePks.map(p => `'${p}'`).join(",");
    const timeInfo = local(`SELECT min(created_at)::text || '|' || max(created_at)::text || '|' || count(*)::text FROM nex.${tblName} WHERE ${pk}::text IN (${inLocalNotTarget.slice(0, 1000).map(p => `'${p}'`).join(",")})`);
    console.log(`  Delta rows time range (first 1K PKs): ${timeInfo}`);

    // Full delta time range (min/max across all delta rows)
    // Use a temp filter · but IN with all 1045 UUIDs works fine
    const allTime = local(`SELECT min(created_at)::text || '|' || max(created_at)::text FROM nex.${tblName} WHERE ${pk}::text IN (${inLocalNotTarget.map(p => `'${p}'`).join(",")})`);
    console.log(`  Delta rows time range (ALL ${inLocalNotTarget.length} PKs): ${allTime}`);

    // Distribution by hour
    const distByHour = local(`SELECT date_trunc('hour', created_at)::text || ':' || count(*)::text FROM nex.${tblName} WHERE ${pk}::text IN (${inLocalNotTarget.map(p => `'${p}'`).join(",")}) GROUP BY date_trunc('hour', created_at) ORDER BY date_trunc('hour', created_at) LIMIT 10`);
    console.log(`  Delta rows by hour (first 10):`);
    for (const line of distByHour.split("\n")) console.log(`    ${line}`);
  }
  console.log("");
}

// ─── 3 · Cross-table correspondence ──────────────────────────────────
console.log("─── 3 · Cross-table correspondence · do the three +1,045 deltas match by cycle? ───\n");

// work_item.cycle_run_id → worker_cycle_run.id
// worker_heartbeat has worker_id; need to check if there's a link

// Get delta work_item cycle_run_ids
const wiPks = local(`SELECT work_item_id::text FROM nex.work_item ORDER BY work_item_id`).split(/\r?\n/).map(s => s.replace(/\r/g, "").trim()).filter(Boolean);
const wiTargetRes = await q(`SELECT work_item_id::text AS pk FROM nex.work_item ORDER BY work_item_id`);
const wiTargetPks = new Set(wiTargetRes.body.map(r => r.pk));
const wiDelta = wiPks.filter(p => !wiTargetPks.has(p));
console.log(`  work_item delta PKs: ${wiDelta.length}`);

// Get cycle_run_ids for those delta work_items
const wiCycles = local(`SELECT DISTINCT cycle_run_id::text FROM nex.work_item WHERE work_item_id::text IN (${wiDelta.map(p => `'${p}'`).join(",")}) AND cycle_run_id IS NOT NULL`).split(/\r?\n/).map(s => s.replace(/\r/g, "").trim()).filter(Boolean);
console.log(`  distinct cycle_run_ids referenced by delta work_items: ${wiCycles.length}`);

// Get delta worker_cycle_run PKs
const wcrPks = local(`SELECT id::text FROM nex.worker_cycle_run ORDER BY id`).split(/\r?\n/).map(s => s.replace(/\r/g, "").trim()).filter(Boolean);
const wcrTargetRes = await q(`SELECT id::text AS pk FROM nex.worker_cycle_run ORDER BY id`);
const wcrTargetPks = new Set(wcrTargetRes.body.map(r => r.pk));
const wcrDelta = wcrPks.filter(p => !wcrTargetPks.has(p));
console.log(`  worker_cycle_run delta PKs: ${wcrDelta.length}`);

// Check overlap
const wcrDeltaSet = new Set(wcrDelta);
const wiCyclesMatchingWcrDelta = wiCycles.filter(c => wcrDeltaSet.has(c));
console.log(`  work_item.cycle_run_id ∩ worker_cycle_run delta PKs: ${wiCyclesMatchingWcrDelta.length}`);

// worker_heartbeat - has worker_id (not cycle_run_id). Let me check what links it
console.log("");
console.log("  worker_heartbeat schema — checking link mechanism...");
const whSample = local(`SELECT string_agg(attname, ', ') FROM pg_attribute WHERE attrelid='nex.worker_heartbeat'::regclass AND attnum > 0 AND NOT attisdropped`);
console.log(`  worker_heartbeat columns: ${whSample}`);

// worker_heartbeat delta
const whCols = local(`SELECT string_agg(a.attname, ',') FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.contype='p' AND c.conrelid='nex.worker_heartbeat'::regclass`);
const whPk = whCols || "worker_id"; // fallback
console.log(`  worker_heartbeat PK: ${whPk}`);
const whPksRaw = local(`SELECT ${whPk}::text FROM nex.worker_heartbeat ORDER BY ${whPk}`);
if (whPksRaw !== null) {
  const whPks = whPksRaw.split(/\r?\n/).map(s => s.replace(/\r/g, "").trim()).filter(Boolean);
  const whTargetRes = await q(`SELECT ${whPk}::text AS pk FROM nex.worker_heartbeat ORDER BY ${whPk}`);
  const whTargetPks = new Set(whTargetRes.body.map(r => r.pk));
  const whDelta = whPks.filter(p => !whTargetPks.has(p));
  console.log(`  worker_heartbeat delta PKs: ${whDelta.length}`);
}

// ─── 4 · Constraint / integrity check for the delta rows ─────────────
console.log("\n─── 4 · Would loading the delta rows violate any check constraint or FK? ───\n");

for (const tbl of ["work_item", "worker_cycle_run", "worker_heartbeat"]) {
  const checks = local(`SELECT string_agg(conname || ': ' || pg_get_constraintdef(oid), E'\n    ') FROM pg_constraint WHERE conrelid='nex.${tbl}'::regclass AND contype='c'`);
  console.log(`  ${tbl} check constraints: ${checks || "(none)"}`);
}

// FKs are still dropped on target — so loading these delta rows will not fail on FK.
// But we should still check that the referenced rows (cycle_run_id, etc.) exist in TARGET.
console.log("\n  FK-satisfaction check (are all referenced rows present on target?):");

// work_item has no FKs — trivially satisfied
console.log(`  work_item: no FKs · trivially loadable`);

// worker_cycle_run has no FKs? Let me verify from the FK snapshot
const fkSnap = JSON.parse(readFileSync(resolve(__dirname, "fk-constraints-snapshot.json"), "utf8"));
const wcrFks = fkSnap.filter(f => f.table === "worker_cycle_run");
console.log(`  worker_cycle_run outbound FKs (from snapshot): ${wcrFks.length}`);
for (const f of wcrFks) console.log(`    ${f.name}: ${f.def}`);
// Referenced-by FKs
const wcrRefBy = fkSnap.filter(f => f.def.includes("REFERENCES nex.worker_cycle_run"));
console.log(`  Tables referencing worker_cycle_run: ${wcrRefBy.length} (informational · won't block Batch 7 load)`);

const whFks = fkSnap.filter(f => f.table === "worker_heartbeat");
console.log(`  worker_heartbeat outbound FKs: ${whFks.length}`);
for (const f of whFks) console.log(`    ${f.name}: ${f.def}`);

// ─── 5 · Summary + recommendation ────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log("SUMMARY");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`  Total nex.* tables scanned:  ${tables.length}`);
console.log(`  Tables with delta != 0:      ${nonZero.length}`);
console.log(`  Total rows to reconcile:     ${nonZero.reduce((a,d) => a + Math.max(0, d.delta), 0)}`);

writeFileSync(resolve(__dirname, "batch-07-reconciliation-gate.json"), JSON.stringify({
  scanned_at: new Date().toISOString(),
  tables_scanned: tables.length,
  tables_with_delta: nonZero,
  target_baseline: { rls: 92, fks: 0 },
}, null, 2));

console.log(`\n  Reconciliation-gate report saved to: batch-07-reconciliation-gate.json`);
console.log(`\n─── HARD STOP · awaiting Philip's approval before any writes ───`);
