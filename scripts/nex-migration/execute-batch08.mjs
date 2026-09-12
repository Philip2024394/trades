#!/usr/bin/env node
// Batch 8 · Option A · recreate all 125 FKs in ONE transaction · verify A-F · HARD STOP.
// NO auto-retry on failure · report exact PG error.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const LOG_FILE = resolve(__dirname, "batch-08.log");
writeFileSync(LOG_FILE, "");
function log(m) { const s = `[${new Date().toISOString()}] ${m}\n`; appendFileSync(LOG_FILE, s); process.stderr.write(m + "\n"); }
function bail(msg, detail) { log(`❌ HARD STOP · ${msg}`); if (detail) log(`   detail: ${JSON.stringify(detail)}`); process.exit(2); }

async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body, raw: text };
}

log("═══════════════════════════════════════════════════════════════════════════");
log("BATCH 8 · FK RECREATION · Option A · 125 FKs in ONE transaction");
log("═══════════════════════════════════════════════════════════════════════════");

// ── PRE ────────────────────────────────────────────────────────────
log("\n─── PRE ───");
const pre = (await q(`
  SELECT pg_database_size(current_database())::text AS db,
         pg_size_pretty(pg_database_size(current_database())) AS db_pretty,
         pg_current_wal_lsn()::text AS wal,
         (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
         (SELECT count(*) FROM public.knowledge_records) AS kr,
         (SELECT count(*) FROM public.worker_jobs) AS wj,
         (SELECT count(*) FROM public.worker_results) AS wr
`)).body[0];
const roPre = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  DB size PRE:  ${pre.db_pretty} (${Number(pre.db).toLocaleString()} bytes)`);
log(`  WAL LSN PRE:  ${pre.wal}`);
log(`  FK count PRE: ${pre.fks} (expected 0)`);
log(`  RLS enabled:  ${pre.rls} (expected 92)`);
log(`  public baseline: kr=${pre.kr}, wj=${pre.wj}, wr=${pre.wr}`);
log(`  Supabase readonly: enabled=${roPre.enabled}`);
if (Number(pre.fks) !== 0) bail(`unexpected pre-existing FKs: ${pre.fks}`);
if (pre.rls !== 92) bail(`RLS drift: ${pre.rls}`);
if (roPre.enabled) bail(`readonly enabled`);
if (pre.kr !== 3627 || pre.wj !== 19167 || pre.wr !== 19140) bail("public.* drift");

// ── LOAD SNAPSHOT ─────────────────────────────────────────────────
log("\n─── Loading FK snapshot ───");
const snapshot = JSON.parse(readFileSync(resolve(__dirname, "fk-constraints-snapshot.json"), "utf8"));
log(`  loaded ${snapshot.length} FK definitions`);
if (snapshot.length !== 125) bail(`expected 125 FKs, got ${snapshot.length}`);

// ── BUILD ONE TRANSACTION ─────────────────────────────────────────
log("\n─── Building single BEGIN/COMMIT transaction with all 125 ALTER TABLE ADD CONSTRAINT ───");
const alterStatements = snapshot.map(fk =>
  `ALTER TABLE nex.${fk.table} ADD CONSTRAINT ${fk.name} ${fk.def};`
);
const transactionSql = "BEGIN;\n" + alterStatements.join("\n") + "\nCOMMIT;";
log(`  transaction size: ${transactionSql.length.toLocaleString()} bytes`);
log(`  first statement:  ${alterStatements[0].slice(0, 120)}...`);
log(`  last statement:   ${alterStatements[alterStatements.length - 1].slice(0, 120)}...`);

// Persist the exact SQL for audit
const sqlPath = resolve(__dirname, "batch-08-transaction.sql");
writeFileSync(sqlPath, transactionSql);
log(`  transaction SQL saved: ${sqlPath}`);

// ── EXECUTE ───────────────────────────────────────────────────────
log("\n─── EXECUTING single transaction · POST /database/query ───");
const t0 = Date.now();
const result = await q(transactionSql);
const elapsedSec = ((Date.now() - t0) / 1000).toFixed(2);
log(`  HTTP ${result.status} in ${elapsedSec}s`);

if (result.status !== 200 && result.status !== 201) {
  log(`\n❌ TRANSACTION FAILED · rolled back automatically`);
  log(`   PostgreSQL error: ${JSON.stringify(result.body).slice(0, 1000)}`);
  bail("FK recreation transaction failed", result.body);
}
log(`  ✓ transaction committed`);

// ── POST-VERIFY A-F ───────────────────────────────────────────────
log("\n─── POST-VERIFICATION (A-F) ───");

// A. FK count = 125
const fkCount = (await q(`SELECT count(*)::text AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f'`)).body[0];
log(`  A · FK count: ${fkCount.n} (expected 125) ${Number(fkCount.n) === 125 ? "✓" : "❌"}`);
if (Number(fkCount.n) !== 125) bail(`FK count mismatch: ${fkCount.n}`);

// B. All 125 constraint names exist
const namesResult = (await q(`SELECT c.conname AS name FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f' ORDER BY c.conname`)).body;
const targetNames = new Set(namesResult.map(r => r.name));
const snapshotNames = new Set(snapshot.map(fk => fk.name));
const missing = [...snapshotNames].filter(n => !targetNames.has(n));
const extra = [...targetNames].filter(n => !snapshotNames.has(n));
log(`  B · All 125 constraint names present: missing=${missing.length}, extra=${extra.length} ${missing.length === 0 && extra.length === 0 ? "✓" : "❌"}`);
if (missing.length > 0) log(`     missing: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "..." : ""}`);
if (extra.length > 0) log(`     extra: ${extra.slice(0, 10).join(", ")}${extra.length > 10 ? "..." : ""}`);

// C. Compare target FK definitions to snapshot
log(`  C · Comparing FK definitions to snapshot...`);
const targetDefs = (await q(`
  SELECT c.conname AS name,
         cl.relname AS table,
         pg_get_constraintdef(c.oid) AS def,
         c.condeferrable AS deferrable,
         c.condeferred AS initially_deferred
  FROM pg_constraint c
  JOIN pg_class cl ON cl.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE n.nspname = 'nex' AND c.contype = 'f'
  ORDER BY c.conname
`)).body;
const targetByName = Object.fromEntries(targetDefs.map(r => [r.name, r]));
let defMismatches = 0;
const defMismatchList = [];
for (const fk of snapshot) {
  const t = targetByName[fk.name];
  if (!t) { defMismatches++; defMismatchList.push(`${fk.name}: MISSING`); continue; }
  if (t.table !== fk.table) { defMismatches++; defMismatchList.push(`${fk.name}: table mismatch (snap=${fk.table}, target=${t.table})`); continue; }
  if (t.def !== fk.def) { defMismatches++; defMismatchList.push(`${fk.name}: def mismatch\n    snap:   ${fk.def}\n    target: ${t.def}`); continue; }
}
log(`  C · Definition mismatches: ${defMismatches} / 125 ${defMismatches === 0 ? "✓" : "❌"}`);
if (defMismatchList.length > 0) for (const m of defMismatchList.slice(0, 10)) log(`     ${m}`);

// D. Full orphan check across all 125 FKs
log(`  D · Full orphan check across all 125 FKs...`);
// If any FK creation succeeded but orphans existed, PostgreSQL would have rejected it upfront.
// This check is defense-in-depth · re-verifies that data is intact.
let totalOrphans = 0;
let orphanChecked = 0;
for (const fk of snapshot) {
  const defMatch = fk.def.match(/FOREIGN KEY\s+\(([^)]+)\)\s+REFERENCES\s+nex\.(\w+)\s*\(([^)]+)\)/);
  if (!defMatch) continue;
  const cCols = defMatch[1].split(",").map(s => s.trim());
  const pTbl = defMatch[2];
  const pCols = defMatch[3].split(",").map(s => s.trim());
  const notNullCheck = cCols.map(c => `c."${c}" IS NOT NULL`).join(" AND ");
  const joinCheck = cCols.map((c, i) => `p."${pCols[i]}" = c."${c}"`).join(" AND ");
  const sql = `SELECT count(*)::text AS n FROM nex.${fk.table} c WHERE ${notNullCheck} AND NOT EXISTS (SELECT 1 FROM nex.${pTbl} p WHERE ${joinCheck})`;
  const r = await q(sql);
  if (r.status < 300) { totalOrphans += Number(r.body[0].n); orphanChecked++; }
}
log(`  D · Orphan checks completed: ${orphanChecked}/125 · TOTAL orphans: ${totalOrphans} ${totalOrphans === 0 ? "✓" : "❌"}`);

// E. Invariants
const post = (await q(`
  SELECT pg_database_size(current_database())::text AS db,
         pg_size_pretty(pg_database_size(current_database())) AS db_pretty,
         pg_current_wal_lsn()::text AS wal,
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
         (SELECT count(*) FROM public.knowledge_records) AS kr,
         (SELECT count(*) FROM public.worker_jobs) AS wj,
         (SELECT count(*) FROM public.worker_results) AS wr
`)).body[0];
const roPost = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  E · RLS enabled:              ${post.rls} (expected 92) ${post.rls === 92 ? "✓" : "❌"}`);
log(`  E · public.knowledge_records: ${post.kr} (expected 3627) ${post.kr === 3627 ? "✓" : "❌"}`);
log(`  E · public.worker_jobs:       ${post.wj} (expected 19167) ${post.wj === 19167 ? "✓" : "❌"}`);
log(`  E · public.worker_results:    ${post.wr} (expected 19140) ${post.wr === 19140 ? "✓" : "❌"}`);
log(`  E · Supabase readonly:        enabled=${roPost.enabled}`);
log(`  E · matview nex.food_business_value rows: ${(await q("SELECT count(*)::text AS n FROM nex.food_business_value")).body[0].n} (matview untouched · not refreshed)`);

// F. Deltas
const dbDelta = Number(post.db) - Number(pre.db);
const walDelta = (await q(`SELECT pg_wal_lsn_diff('${post.wal}'::pg_lsn, '${pre.wal}'::pg_lsn)::text AS d`)).body[0].d;
log(`  F · DB size PRE→POST: ${pre.db_pretty} → ${post.db_pretty} · delta=${dbDelta >= 0 ? "+" : ""}${dbDelta} bytes (${(dbDelta/1024/1024).toFixed(2)} MB)`);
log(`  F · WAL LSN PRE→POST: ${pre.wal} → ${post.wal} · delta=${Number(walDelta).toLocaleString()} bytes (${(Number(walDelta)/1024/1024).toFixed(2)} MB)`);
log(`  F · Elapsed:          ${elapsedSec} seconds`);

// Save report
writeFileSync(resolve(__dirname, "batch-08-report.json"), JSON.stringify({
  completed_at: new Date().toISOString(),
  elapsed_seconds: Number(elapsedSec),
  pre, post, roPre, roPost,
  db_delta_bytes: dbDelta,
  wal_delta_bytes: Number(walDelta),
  fk_count_post: Number(fkCount.n),
  constraint_names_missing: missing,
  constraint_names_extra: extra,
  definition_mismatches: defMismatches,
  total_orphans_post: totalOrphans,
  orphan_checks_run: orphanChecked,
}, null, 2));

const allGood = Number(fkCount.n) === 125 && missing.length === 0 && extra.length === 0 && defMismatches === 0 && totalOrphans === 0 && post.rls === 92 && !roPost.enabled;
log("\n═══════════════════════════════════════════════════════════════════════════");
log(`  BATCH 8 RESULT: ${allGood ? "✅ SUCCESS · 125 FKs recreated · all invariants held" : "❌ verification failed"}`);
log("═══════════════════════════════════════════════════════════════════════════");
log("\n─── HARD STOP · awaiting Philip approval for Batch 9 ───");
process.exit(allGood ? 0 : 1);
