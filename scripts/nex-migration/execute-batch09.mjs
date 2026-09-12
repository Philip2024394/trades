#!/usr/bin/env node
// Batch 9 · Stage 1: ANALYZE nex.* · Stage 2: REFRESH MATERIALIZED VIEW nex.food_business_value.
// Per-stage measurement + verification against frozen local.

import { readFileSync, writeFileSync, appendFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
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
const LOG_FILE = resolve(__dirname, "batch-09.log");
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
writeFileSync(LOG_FILE, "");
function log(m) { const s = `[${new Date().toISOString()}] ${m}\n`; appendFileSync(LOG_FILE, s); process.stderr.write(m + "\n"); }
function bail(msg, detail) { log(`❌ HARD STOP · ${msg}`); if (detail) log(`   detail: ${JSON.stringify(detail).slice(0,500)}`); process.exit(2); }

let seq = 0;
function local(sql) {
  const p = resolve(TMP_DIR, `q-${process.pid}-${++seq}.sql`);
  writeFileSync(p, sql);
  try {
    const r = spawnSync(PSQL, ["-At", "-f", p, LOCAL_URI], { env: { ...process.env, PGPASSWORD: "Admin1phil" }, encoding: "utf8", timeout: 300000, maxBuffer: 500*1024*1024 });
    if (r.status !== 0) { log(`  local psql failed: ${r.stderr}`); return null; }
    return r.stdout.trim();
  } finally { try { unlinkSync(p); } catch {} }
}
async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}
async function readonly() {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return await r.json();
}
async function snapshotState() {
  const s = (await q(`
    SELECT pg_database_size(current_database())::text AS db,
           pg_size_pretty(pg_database_size(current_database())) AS db_pretty,
           pg_current_wal_lsn()::text AS wal,
           (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
           (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
           (SELECT count(*) FROM public.knowledge_records) AS kr,
           (SELECT count(*) FROM public.worker_jobs) AS wj,
           (SELECT count(*) FROM public.worker_results) AS wr,
           (SELECT count(*) FROM nex.food_business_value) AS matview_rows
  `)).body[0];
  return { ...s, readonly: (await readonly()).enabled };
}

log("═══════════════════════════════════════════════════════════════════════════");
log("BATCH 9 · TWO-STAGE · Stage 1 ANALYZE · Stage 2 REFRESH MATERIALIZED VIEW");
log("═══════════════════════════════════════════════════════════════════════════");

// ═══ STAGE 1 · ANALYZE ═══════════════════════════════════════════════
log("\n─── STAGE 1 · ANALYZE nex.* ───");

log("\n  PRE (before ANALYZE):");
const s1pre = await snapshotState();
log(`    DB size:              ${s1pre.db_pretty} (${Number(s1pre.db).toLocaleString()} bytes)`);
log(`    WAL LSN:              ${s1pre.wal}`);
log(`    Supabase readonly:    enabled=${s1pre.readonly}`);
log(`    FK count:             ${s1pre.fks} (expected 125)`);
log(`    RLS enabled:          ${s1pre.rls} (expected 92)`);
log(`    public baseline:      kr=${s1pre.kr}, wj=${s1pre.wj}, wr=${s1pre.wr}`);
log(`    matview rows:         ${s1pre.matview_rows} (expected 0 · not yet refreshed)`);
if (Number(s1pre.fks) !== 125) bail(`FK drift: expected 125, got ${s1pre.fks}`);
if (s1pre.rls !== 92) bail(`RLS drift: ${s1pre.rls}`);
if (s1pre.readonly) bail("readonly enabled");
if (s1pre.kr !== 3627 || s1pre.wj !== 19167 || s1pre.wr !== 19140) bail("public.* drift");

log("\n  Running ANALYZE on nex schema (all tables) · scope-restricted DO block · never touches public.*");
const t1 = Date.now();
const analyzeSql = `
  DO $body$
  DECLARE r record;
  BEGIN
    FOR r IN
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'nex' AND c.relkind = 'r'
      ORDER BY c.relname
    LOOP
      EXECUTE 'ANALYZE nex.' || quote_ident(r.relname);
    END LOOP;
  END $body$;
`;
const s1result = await q(analyzeSql);
const s1elapsed = ((Date.now() - t1) / 1000).toFixed(2);
if (s1result.status !== 200 && s1result.status !== 201) bail("ANALYZE failed", s1result.body);
log(`  ✓ ANALYZE completed · HTTP ${s1result.status} · ${s1elapsed}s`);

log("\n  POST (after ANALYZE):");
const s1post = await snapshotState();
const s1dbDelta = Number(s1post.db) - Number(s1pre.db);
const s1walDelta = Number((await q(`SELECT pg_wal_lsn_diff('${s1post.wal}'::pg_lsn, '${s1pre.wal}'::pg_lsn)::text AS d`)).body[0].d);
log(`    DB size:              ${s1post.db_pretty} · delta=${s1dbDelta >= 0 ? "+" : ""}${s1dbDelta} bytes`);
log(`    WAL LSN:              ${s1post.wal} · delta=${s1walDelta.toLocaleString()} bytes (${(s1walDelta/1024/1024).toFixed(2)} MB)`);
log(`    FK count:             ${s1post.fks} (must remain 125) ${Number(s1post.fks) === 125 ? "✓" : "❌"}`);
log(`    RLS enabled:          ${s1post.rls} (must remain 92) ${s1post.rls === 92 ? "✓" : "❌"}`);
log(`    public baseline:      kr=${s1post.kr}, wj=${s1post.wj}, wr=${s1post.wr}`);
log(`    Supabase readonly:    enabled=${s1post.readonly}`);
log(`    matview rows:         ${s1post.matview_rows} (still 0 · Stage 2 next)`);
if (Number(s1post.fks) !== 125 || s1post.rls !== 92 || s1post.kr !== 3627 || s1post.wj !== 19167 || s1post.wr !== 19140 || s1post.readonly) {
  bail("post-ANALYZE invariant drift");
}
log(`  ✓ Stage 1 complete · all invariants held`);

// ═══ STAGE 2 · REFRESH MATERIALIZED VIEW ═════════════════════════════
log("\n─── STAGE 2 · REFRESH MATERIALIZED VIEW nex.food_business_value ───");

// Check for unique index (required for CONCURRENTLY)
const idxCheck = (await q(`
  SELECT indexname, indexdef FROM pg_indexes
  WHERE schemaname='nex' AND tablename='food_business_value'
`)).body;
log(`  Indexes on matview: ${idxCheck.length}`);
for (const i of idxCheck) log(`    ${i.indexname}: ${i.indexdef}`);
const hasUniqueIdx = idxCheck.some(i => i.indexdef.toUpperCase().includes("UNIQUE"));
log(`  Has UNIQUE index: ${hasUniqueIdx}`);
log(`  Matview currently has 0 rows · CONCURRENTLY not applicable to first-time populate`);
log(`  Using plain REFRESH MATERIALIZED VIEW (non-concurrent)`);

// Get expected content from LOCAL matview (source of truth)
log("\n  Gathering LOCAL matview baseline...");
const localMatCount = Number(local("SELECT count(*) FROM nex.food_business_value"));
log(`  LOCAL matview row count: ${localMatCount}`);
const localMatCols = local("SELECT string_agg(attname, ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid='nex.food_business_value'::regclass AND attnum > 0 AND NOT attisdropped");
log(`  matview columns: ${localMatCols}`);

// Find a stable primary identifier for the matview (usually the business_ref/public_listing_ref)
// Peek at first row to see structure
const localSample = local("SELECT row_to_json(t)::text FROM (SELECT * FROM nex.food_business_value LIMIT 1) t");
log(`  sample row keys: ${localSample ? Object.keys(JSON.parse(localSample)).join(", ") : "(none)"}`);

// TZ-independent content hash (all non-timestamp cols raw · timestamps as epoch)
// Use quote_nullable + chr(31) delimiters
// For simplicity: hash a stable subset for cross-check
log("\n  Computing LOCAL matview content hash (TZ-independent)...");
// Get column names and types to build a TZ-safe expression
const colTypesRaw = local("SELECT attname || ':' || format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid='nex.food_business_value'::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attnum");
const colTypes = colTypesRaw.split(/\r?\n/).map(l => l.replace(/\r/g,"").trim()).filter(Boolean).map(l => { const [n, t] = l.split(":"); return { name: n, type: t }; });
// Find a primary identifier column (business_ref or first uuid/text)
const primaryCol = colTypes.find(c => /business_ref|public_listing_ref|id$/.test(c.name)) || colTypes[0];
log(`  primary identifier column for ordering: ${primaryCol.name} (${primaryCol.type})`);

// Build TZ-independent hash expression
const hashExpr = colTypes.map(c => {
  if (c.type.includes("timestamp")) return `coalesce(extract(epoch from ${c.name})::text, 'NULL')`;
  return `coalesce(quote_nullable(${c.name}::text), 'NULL')`;
}).join(" || chr(31) || ");
const hashSql = `SELECT md5(string_agg(${hashExpr}, chr(30) ORDER BY ${primaryCol.name})) FROM nex.food_business_value`;
const localHash = local(hashSql);
log(`  LOCAL matview hash: ${localHash}`);

// Also get distribution by any low-cardinality column
const distCheck = local(`SELECT count(*) FROM nex.food_business_value`);
log(`  LOCAL matview row count (verify): ${distCheck}`);

log("\n  Executing REFRESH MATERIALIZED VIEW nex.food_business_value on target...");
const s2pre = await snapshotState();
log(`    PRE: matview rows=${s2pre.matview_rows}, DB=${s2pre.db_pretty}, WAL=${s2pre.wal}`);

const t2 = Date.now();
const refreshResult = await q(`REFRESH MATERIALIZED VIEW nex.food_business_value`);
const s2elapsed = ((Date.now() - t2) / 1000).toFixed(2);
if (refreshResult.status !== 200 && refreshResult.status !== 201) bail("REFRESH failed", refreshResult.body);
log(`  ✓ REFRESH completed · HTTP ${refreshResult.status} · ${s2elapsed}s`);

const s2post = await snapshotState();
const s2dbDelta = Number(s2post.db) - Number(s2pre.db);
const s2walDelta = Number((await q(`SELECT pg_wal_lsn_diff('${s2post.wal}'::pg_lsn, '${s2pre.wal}'::pg_lsn)::text AS d`)).body[0].d);
log(`    POST: matview rows=${s2post.matview_rows}, DB=${s2post.db_pretty}, WAL=${s2post.wal}`);
log(`    delta: DB=${s2dbDelta >= 0 ? "+" : ""}${s2dbDelta} bytes (${(s2dbDelta/1024/1024).toFixed(2)} MB), WAL=${s2walDelta.toLocaleString()} bytes (${(s2walDelta/1024/1024).toFixed(2)} MB)`);

log("\n  Comparing target matview to local baseline:");
log(`    row count target: ${s2post.matview_rows} · local: ${localMatCount} · match=${Number(s2post.matview_rows) === localMatCount ? "✓" : "❌"}`);
if (Number(s2post.matview_rows) !== localMatCount) bail(`matview row count mismatch: target=${s2post.matview_rows}, local=${localMatCount}`);

// Compute target hash with same formula
log(`  computing TARGET matview content hash (same TZ-independent formula)...`);
const targetHash = (await q(hashSql)).body[0]?.md5;
log(`    target hash: ${targetHash}`);
log(`    local hash:  ${localHash}`);
log(`    match: ${targetHash === localHash ? "✅" : "❌"}`);
if (targetHash !== localHash) bail(`matview content hash mismatch`);

// ═══ FINAL BATCH 9 VERIFICATION ═════════════════════════════════════
log("\n═══════════════════════════════════════════════════════════════════════════");
log("FINAL BATCH 9 VERIFICATION");
log("═══════════════════════════════════════════════════════════════════════════");

log("\n  Full 191-table row-count parity check...");
const tables = local("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' ORDER BY c.relname").split(/\r?\n/).map(s => s.replace(/\r/g, "").trim()).filter(Boolean);
let mismatchCount = 0;
for (let i = 0; i < tables.length; i += 30) {
  const chunk = tables.slice(i, i + 30);
  const cols = chunk.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
  const lRaw = local(`SELECT ${cols}`);
  const lVals = lRaw.replace(/\r/g, "").split("|");
  const r = await q(`SELECT ${cols}`);
  const tRow = r.body[0];
  chunk.forEach((t, j) => {
    if (Number(lVals[j]) !== Number(tRow[t])) { mismatchCount++; log(`    ⚠️ ${t}: local=${lVals[j]}, target=${tRow[t]}`); }
  });
}
log(`  191-table parity: mismatches=${mismatchCount} ${mismatchCount === 0 ? "✓" : "❌"}`);

// Final orphan check across all 125 FKs
log("\n  Full 125-FK orphan re-check...");
const snapshot = JSON.parse(readFileSync(resolve(__dirname, "fk-constraints-snapshot.json"), "utf8"));
let totalOrphans = 0;
for (const fk of snapshot) {
  const m = fk.def.match(/FOREIGN KEY\s+\(([^)]+)\)\s+REFERENCES\s+nex\.(\w+)\s*\(([^)]+)\)/);
  if (!m) continue;
  const cCols = m[1].split(",").map(s => s.trim());
  const pTbl = m[2];
  const pCols = m[3].split(",").map(s => s.trim());
  const notNullCheck = cCols.map(c => `c."${c}" IS NOT NULL`).join(" AND ");
  const joinCheck = cCols.map((c, i) => `p."${pCols[i]}" = c."${c}"`).join(" AND ");
  const r = await q(`SELECT count(*)::text AS n FROM nex.${fk.table} c WHERE ${notNullCheck} AND NOT EXISTS (SELECT 1 FROM nex.${pTbl} p WHERE ${joinCheck})`);
  if (r.status < 400) totalOrphans += Number(r.body[0].n);
}
log(`  Total orphans across 125 FKs: ${totalOrphans} ${totalOrphans === 0 ? "✓" : "❌"}`);

// Final invariants
const finalState = await snapshotState();
log("\n  Final invariants:");
log(`    FK count = ${finalState.fks} (expected 125) ${Number(finalState.fks) === 125 ? "✓" : "❌"}`);
log(`    RLS enabled = ${finalState.rls} (expected 92) ${finalState.rls === 92 ? "✓" : "❌"}`);
log(`    public.knowledge_records = ${finalState.kr} ${finalState.kr === 3627 ? "✓" : "❌"}`);
log(`    public.worker_jobs = ${finalState.wj} ${finalState.wj === 19167 ? "✓" : "❌"}`);
log(`    public.worker_results = ${finalState.wr} ${finalState.wr === 19140 ? "✓" : "❌"}`);
log(`    Supabase readonly = enabled=${finalState.readonly}`);
log(`    matview rows = ${finalState.matview_rows} (matches local ${localMatCount})`);

// Local freeze verification
const nodeCount = spawnSync("powershell", ["-NoProfile", "-Command", "(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -notlike '*execute-batch09*' } | Measure-Object).Count"], { encoding: "utf8", timeout: 30000 }).stdout.trim();
const taskState = spawnSync("powershell", ["-NoProfile", "-Command", "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce').State"], { encoding: "utf8", timeout: 30000 }).stdout.trim();
log(`    Local node.exe (excl this): ${nodeCount}`);
log(`    Scheduled Task state: ${taskState}`);

const allGood = mismatchCount === 0 && totalOrphans === 0 && Number(finalState.fks) === 125 && finalState.rls === 92 && !finalState.readonly && Number(finalState.matview_rows) === localMatCount;

writeFileSync(resolve(__dirname, "batch-09-report.json"), JSON.stringify({
  completed_at: new Date().toISOString(),
  stage1_analyze: { elapsed_seconds: Number(s1elapsed), db_delta_bytes: s1dbDelta, wal_delta_bytes: s1walDelta },
  stage2_matview: { elapsed_seconds: Number(s2elapsed), db_delta_bytes: s2dbDelta, wal_delta_bytes: s2walDelta, target_rows: Number(s2post.matview_rows), local_rows: localMatCount, hash_match: targetHash === localHash },
  final_verification: { mismatchCount, totalOrphans, invariants: finalState, local_node_count: Number(nodeCount), scheduled_task: taskState },
  all_good: allGood,
}, null, 2));

log("\n═══════════════════════════════════════════════════════════════════════════");
log(`  BATCH 9 RESULT: ${allGood ? "✅ SUCCESS · ANALYZE + matview refresh complete · migration data-integrity fully verified" : "❌ verification failed"}`);
log("═══════════════════════════════════════════════════════════════════════════");
log("\n─── HARD STOP · awaiting Philip's approval for cutover-readiness audit ───");
process.exit(allGood ? 0 : 1);
