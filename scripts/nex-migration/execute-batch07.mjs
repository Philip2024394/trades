#!/usr/bin/env node
// Batch 7 · reconciliation load · 3 tables · 3,135 rows.
// Load order: worker_cycle_run (parent) → work_item → worker_heartbeat (independent).
// Per-table: PK diff · extract with WHERE PK IN (...) · verify CSV · load · verify target.

import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync, appendFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const DB_URL = envText.match(/^NEX_SUPABASE_DB_URL=(.+)$/m)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const PSQL = "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";
const LOCAL_URI = "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const TMP_DIR = resolve(__dirname, "tmp");
const LOG_FILE = resolve(__dirname, "batch-07.log");
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
writeFileSync(LOG_FILE, "");

const PW = DB_URL.split("@")[0].split(":").pop();
function scrub(s) { return String(s).split(PW).join("<PASSWORD>"); }
function log(m) { const s = `[${new Date().toISOString()}] ${m}\n`; appendFileSync(LOG_FILE, scrub(s)); process.stderr.write(scrub(m + "\n")); }
function bail(msg) { log(`❌ HARD STOP · ${msg}`); process.exit(2); }

let localCallSeq = 0;
function local(sql) {
  const tmpSql = resolve(TMP_DIR, `q-${process.pid}-${++localCallSeq}.sql`);
  writeFileSync(tmpSql, sql);
  try {
    const r = spawnSync(PSQL, ["-At", "-f", tmpSql, LOCAL_URI], { env: { ...process.env, PGPASSWORD: "Admin1phil" }, encoding: "utf8", timeout: 300000, maxBuffer: 500*1024*1024 });
    if (r.status !== 0) { log(`  local psql failed: ${r.stderr}`); return null; }
    return r.stdout.trim();
  } finally { try { unlinkSync(tmpSql); } catch {} }
}
async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

// Load a psql script file
function psqlFile(uri, sql, extraEnv = {}) {
  const tmpSql = resolve(TMP_DIR, `run-${process.pid}-${Date.now()}.sql`);
  writeFileSync(tmpSql, sql);
  try {
    const r = spawnSync(PSQL, ["-v", "ON_ERROR_STOP=1", "-f", tmpSql, uri], { env: { ...process.env, ...extraEnv }, encoding: "utf8", timeout: 300000, maxBuffer: 200*1024*1024 });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  } finally { try { unlinkSync(tmpSql); } catch {} }
}

// Read first + last + count from CSV
async function csvStats(path) {
  const size = statSync(path).size;
  if (size === 0) return { first: null, last: null, rows: 0 };
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let first = null, last = null, count = 0;
  for await (const line of rl) {
    if (line.length === 0) continue;
    if (first === null) first = line;
    last = line;
    count++;
  }
  return { first: first ? first.split("\t")[0] : null, last: last ? last.split("\t")[0] : null, rows: count };
}

log("═══════════════════════════════════════════════════════════════════════════");
log("BATCH 7 · RECONCILIATION · 3 tables · 3,135 rows expected");
log("═══════════════════════════════════════════════════════════════════════════");

const TABLES = [
  {
    name: "worker_cycle_run",
    pk: "id", pk_type: "uuid",
    cols: "id, worker_id, worker_type, worker_config, job_id_external, started_at, finished_at, duration_ms, status, records_processed, records_new, records_updated, records_skipped, records_flagged, cycle_outcome, error_message, cycle_config, metadata, created_at",
  },
  {
    name: "work_item",
    pk: "work_item_id", pk_type: "uuid",
    cols: "work_item_id, idempotency_key, job_slug, city, status, worker_id, cycle_run_id, lease_owner, lease_expires_at, attempt_count, max_attempts, next_retry_at, last_error, last_error_class, error_history, records_processed, records_new, cycle_outcome, created_at, updated_at, started_at, finished_at",
  },
  {
    name: "worker_heartbeat",
    pk: "worker_id", pk_type: "text",
    cols: "worker_id, worker_type, worker_config, last_heartbeat_at, last_status, last_cycle_run_id, metadata, created_at, updated_at",
  },
];

// Discover cols dynamically for accuracy · verify vs schema
for (const tbl of TABLES) {
  const actualCols = local(`SELECT string_agg(attname, ', ' ORDER BY attnum) FROM pg_attribute WHERE attrelid='nex.${tbl.name}'::regclass AND attnum > 0 AND NOT attisdropped`);
  if (!actualCols) bail(`could not fetch schema for ${tbl.name}`);
  tbl.cols = actualCols;
  log(`  ${tbl.name} columns: ${tbl.cols}`);
}

// Pre-flight
log("\n─── PRE-FLIGHT ───");
const inv = (await q(`
  SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
         (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
         (SELECT count(*) FROM public.knowledge_records) AS kr,
         (SELECT count(*) FROM public.worker_jobs) AS wj,
         (SELECT count(*) FROM public.worker_results) AS wr
`)).body[0];
if (inv.rls !== 92) bail(`RLS drift: ${inv.rls}`);
if (Number(inv.fks) !== 0) bail(`FK drift: ${inv.fks}`);
if (inv.kr !== 3627 || inv.wj !== 19167 || inv.wr !== 19140) bail("public.* drift");
const ro = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
if (ro.enabled) bail("readonly enabled");
log(`  ✓ invariants: RLS=92 · FKs=0 · public baseline · readonly=false`);

const results = {};

// Per-table load
for (const tbl of TABLES) {
  log(`\n─── LOAD ${tbl.name} ───`);

  // Get LOCAL PKs
  const localPks = local(`SELECT ${tbl.pk}::text FROM nex.${tbl.name} ORDER BY ${tbl.pk}`).split(/\r?\n/).map(s => s.replace(/\r/g, "").trim()).filter(Boolean);
  log(`  local PKs: ${localPks.length}`);

  // Get TARGET PKs
  const targetPksRes = await q(`SELECT ${tbl.pk}::text AS pk FROM nex.${tbl.name} ORDER BY ${tbl.pk}`);
  if (targetPksRes.status >= 400) bail(`target PK fetch failed for ${tbl.name}`);
  const targetPks = new Set(targetPksRes.body.map(r => r.pk));
  log(`  target PKs: ${targetPks.size}`);

  // Delta = in local not target
  const delta = localPks.filter(p => !targetPks.has(p));
  const targetOnly = [...targetPks].filter(p => !new Set(localPks).has(p));
  log(`  delta (in-local-not-target): ${delta.length}`);
  log(`  target-only: ${targetOnly.length}`);
  if (delta.length !== 1045) bail(`unexpected delta size for ${tbl.name}: ${delta.length} (expected 1045)`);
  if (targetOnly.length !== 0) bail(`target has rows not in local for ${tbl.name}: ${targetOnly.length}`);
  const uniq = new Set(delta);
  if (uniq.size !== delta.length) bail(`duplicate PKs in delta list for ${tbl.name}`);

  // Extract delta rows to CSV · use WHERE pk IN (...) with proper quoting
  const chunkPath = resolve(TMP_DIR, `batch07-${tbl.name}.csv`);
  if (existsSync(chunkPath)) unlinkSync(chunkPath);
  // Build IN clause · for uuid: cast; for text: quote_literal
  const inList = delta.map(v => tbl.pk_type === "uuid" ? `'${v}'::uuid` : `'${v.replace(/'/g, "''")}'`).join(",");
  const extractSql = `\\copy (SELECT ${tbl.cols} FROM nex.${tbl.name} WHERE ${tbl.pk} IN (${inList}) ORDER BY ${tbl.pk}) TO '${chunkPath.replace(/\\/g, "/")}'`;
  const ex = psqlFile(LOCAL_URI, extractSql, { PGPASSWORD: "Admin1phil" });
  if (ex.status !== 0) bail(`extract failed for ${tbl.name}`, { stderr: ex.stderr });
  const csv = await csvStats(chunkPath);
  const csvSize = statSync(chunkPath).size;
  log(`  extracted: ${csv.rows} rows · ${csvSize} bytes · first=${csv.first} · last=${csv.last}`);
  if (csv.rows !== 1045) bail(`CSV row count mismatch for ${tbl.name}: ${csv.rows}`);

  // Pre-load: target count before
  const preTarget = Number((await q(`SELECT count(*)::text AS c FROM nex.${tbl.name}`)).body[0].c);
  log(`  target rows BEFORE load: ${preTarget}`);

  // LOAD via -f script (SET ROLE + BEGIN + \copy + COMMIT)
  const loadSql = `SET ROLE service_role;
BEGIN;
\\copy nex.${tbl.name} (${tbl.cols}) FROM '${chunkPath.replace(/\\/g, "/")}'
COMMIT;
`;
  const ld = psqlFile(DB_URL, loadSql, { PGOPTIONS: "-c statement_timeout=0 -c lock_timeout=0 -c idle_in_transaction_session_timeout=0" });
  if (ld.status !== 0) bail(`load failed for ${tbl.name}`, { stderr: ld.stderr, stdout: ld.stdout });
  log(`  load exit 0`);

  // Verify
  const postTarget = Number((await q(`SELECT count(*)::text AS c FROM nex.${tbl.name}`)).body[0].c);
  const targetDelta = postTarget - preTarget;
  log(`  target rows AFTER load: ${postTarget} (delta +${targetDelta})`);
  if (targetDelta !== 1045) bail(`target delta mismatch for ${tbl.name}: expected +1045, got +${targetDelta}`);

  // Cleanup CSV
  try { unlinkSync(chunkPath); } catch {}

  results[tbl.name] = { pre: preTarget, post: postTarget, delta: targetDelta };
  log(`  ✓ ${tbl.name} · ${postTarget.toLocaleString()} rows`);
}

// ─── FULL 191-TABLE FINAL VERIFICATION ───────────────────────────────
log("\n─── FULL 191-TABLE VERIFICATION ───");
const tables = local("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' ORDER BY c.relname").split(/\r?\n/).map(s => s.replace(/\r/g, "").trim()).filter(Boolean);
const localCounts = {}, targetCounts = {};
for (let i = 0; i < tables.length; i += 30) {
  const chunk = tables.slice(i, i + 30);
  const cols = chunk.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
  const localRaw = local(`SELECT ${cols}`);
  const values = localRaw.replace(/\r/g, "").split("|");
  chunk.forEach((t, j) => { localCounts[t] = Number(values[j]); });
  const r = await q(`SELECT ${cols}`);
  const row = r.body[0];
  for (const t of chunk) targetCounts[t] = Number(row[t]);
}

const nonZero = tables.map(t => ({ table: t, local: localCounts[t], target: targetCounts[t], delta: (localCounts[t] || 0) - (targetCounts[t] || 0) })).filter(d => d.delta !== 0);
log(`\n  Tables with delta != 0: ${nonZero.length}`);
if (nonZero.length > 0) {
  for (const d of nonZero) log(`    ${d.table.padEnd(50)} local=${d.local} target=${d.target} delta=${d.delta > 0 ? '+' : ''}${d.delta}`);
} else {
  log(`  ✅ ALL 191 nex.* tables · LOCAL == TARGET`);
}

// Final invariants
const finalInv = (await q(`
  SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
         (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
         (SELECT count(*) FROM public.knowledge_records) AS kr,
         (SELECT count(*) FROM public.worker_jobs) AS wj,
         (SELECT count(*) FROM public.worker_results) AS wr,
         pg_database_size(current_database())::text AS db,
         pg_size_pretty(pg_database_size(current_database())) AS db_pretty
`)).body[0];
const roFinal = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`\n  Final invariants:`);
log(`    RLS enabled tables: ${finalInv.rls} (expected 92) ${finalInv.rls === 92 ? "✓" : "❌"}`);
log(`    FK count:           ${finalInv.fks} (expected 0) ${Number(finalInv.fks) === 0 ? "✓" : "❌"}`);
log(`    public.knowledge_records: ${finalInv.kr} ${finalInv.kr === 3627 ? "✓" : "❌"}`);
log(`    public.worker_jobs:       ${finalInv.wj} ${finalInv.wj === 19167 ? "✓" : "❌"}`);
log(`    public.worker_results:    ${finalInv.wr} ${finalInv.wr === 19140 ? "✓" : "❌"}`);
log(`    Supabase readonly:  enabled=${roFinal.enabled}`);
log(`    Final DB size:      ${finalInv.db_pretty}`);

// 1:1:1 cross-check
log("\n  Cross-check work_item.cycle_run_id ↔ worker_cycle_run.id relationship:");
const crossCheck = (await q(`SELECT count(*)::text AS orphans FROM nex.work_item wi WHERE wi.cycle_run_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM nex.worker_cycle_run wcr WHERE wcr.id = wi.cycle_run_id)`)).body[0];
log(`    Orphan work_items with cycle_run_id pointing at missing worker_cycle_run: ${crossCheck.orphans} (must be 0)`);

const allGood = nonZero.length === 0 && crossCheck.orphans === "0" && finalInv.rls === 92 && Number(finalInv.fks) === 0;
log("\n═══════════════════════════════════════════════════════════════════════════");
log(`  BATCH 7 RESULT: ${allGood ? "✅ ALL 191 TABLES SYNCHRONIZED · ready for Batch 8 (FK recreation)" : "❌ verification failed"}`);
log("═══════════════════════════════════════════════════════════════════════════");

writeFileSync(resolve(__dirname, "batch-07-reconciliation-report.json"), JSON.stringify({
  completed_at: new Date().toISOString(),
  loaded_tables: results,
  final_full_scan: { tables_checked: tables.length, tables_with_delta: nonZero.length, deltas: nonZero },
  final_invariants: finalInv,
  cross_check_orphans: crossCheck.orphans,
  all_synced: allGood,
}, null, 2));

log("\n─── HARD STOP · awaiting Philip approval for Batch 8 (FK recreation) ───");
process.exit(allGood ? 0 : 1);
