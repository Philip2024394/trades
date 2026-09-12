#!/usr/bin/env node
// Batch 6 · identity_merge_log · 14-chunk stream from frozen local to Supabase.
// Per-chunk: PRE measure · EXTRACT to CSV · VERIFY CSV boundaries + count · LOAD · POST measure · VERIFY delta.
// STOP thresholds enforced. Progress persisted after each COMMIT. Full post-batch verification.

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync, appendFileSync, createReadStream } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const DB_URL = envText.match(/^NEX_SUPABASE_DB_URL=(.+)$/m)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const PSQL = "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";
const LOCAL_URI = "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

const BASELINE = JSON.parse(readFileSync(resolve(__dirname, "batch-06-baseline.json"), "utf8"));
const PROGRESS_FILE = resolve(__dirname, "batch-06-progress.json");
const TMP_DIR = resolve(__dirname, "tmp");
const LOG_FILE = resolve(__dirname, "batch-06.log");
const CHUNK_SIZE = 100000;

// Thresholds
const STOP_DB_BYTES     = 3n * 1024n * 1024n * 1024n;   // 3 GB
const STOP_WAL_BYTES    = 200n * 1024n * 1024n;         // 200 MB per chunk
const STOP_ELAPSED_SEC  = 3600;                         // 60 min total

if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
if (!existsSync(LOG_FILE)) writeFileSync(LOG_FILE, "");

const PW = DB_URL.split("@")[0].split(":").pop();
function scrub(s) { return String(s).split(PW).join("<PASSWORD>").split(encodeURIComponent(PW)).join("<PASSWORD>"); }
function log(m) { const s = `[${new Date().toISOString()}] ${m}\n`; appendFileSync(LOG_FILE, scrub(s)); process.stderr.write(scrub(m + "\n")); }

function localSql(sql) {
  const r = spawnSync(PSQL, ["-Atc", sql, LOCAL_URI], { env: { ...process.env, PGPASSWORD: "Admin1phil" }, encoding: "utf8", timeout: 300000 });
  if (r.status !== 0) { log(`  local psql error: ${r.stderr}`); return null; }
  return r.stdout.trim();
}
async function targetSql(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}
async function targetReadonly() {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return await r.json();
}

function loadState() {
  if (!existsSync(PROGRESS_FILE)) return { started_at: new Date().toISOString(), last_merge_id: null, target_row_count: 0, chunks_completed: [], complete: false };
  return JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
}
function saveState(state) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2));
}

// Read first + last non-empty line of a file efficiently, return their first tab-column.
async function csvFirstLastFirstCol(path) {
  const size = statSync(path).size;
  if (size === 0) return { first: null, last: null, rows: 0 };
  // Read first line
  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let firstLine = null;
  let count = 0;
  let lastLine = null;
  for await (const line of rl) {
    if (line.length === 0) continue;
    if (firstLine === null) firstLine = line;
    lastLine = line;
    count++;
  }
  const first = firstLine ? firstLine.split("\t")[0] : null;
  const last = lastLine ? lastLine.split("\t")[0] : null;
  return { first, last, rows: count };
}

// LSN diff in bytes
async function lsnDiff(before, after) {
  const r = await targetSql(`SELECT pg_wal_lsn_diff('${after}'::pg_lsn, '${before}'::pg_lsn)::text AS d`);
  if (r.status !== 200 && r.status !== 201) return null;
  return BigInt(r.body[0].d);
}

const t0 = Date.now();
async function bail(msg, extra) {
  log(`❌ HARD STOP · ${msg}`);
  if (extra) log(`   detail: ${JSON.stringify(extra)}`);
  process.exit(2);
}

// ── PRE-EXECUTION ────────────────────────────────────────────────────────
log(`\n════════════════════════════════════════════════════════════════════════`);
log(`BATCH 6 · identity_merge_log · streaming ${CHUNK_SIZE.toLocaleString()}-row chunks`);
log(`baseline: ${BASELINE.total_rows.toLocaleString()} rows · ${BASELINE.chunk_count} chunks expected`);
log(`════════════════════════════════════════════════════════════════════════`);

const initState = await targetSql(`SELECT count(*)::text AS c, pg_database_size(current_database())::text AS db, pg_current_wal_lsn()::text AS wal FROM nex.identity_merge_log`);
const initInv = initState.body[0];
log(`  target initial: identity_merge_log=${initInv.c}, db_size=${(Number(initInv.db)/1024/1024).toFixed(1)} MB, wal_lsn=${initInv.wal}`);
if (Number(initInv.c) !== 0) log(`  ⚠️ target already has ${initInv.c} rows in identity_merge_log — will resume/append if state file exists`);

const state = loadState();
log(`  loaded state: chunks_completed=${state.chunks_completed.length}, last_merge_id=${state.last_merge_id ?? '(none)'}, target_row_count=${state.target_row_count}`);

if (state.complete) {
  log(`  state.complete=true · batch already finished · exiting`);
  process.exit(0);
}

// ── CHUNK LOOP ───────────────────────────────────────────────────────────
for (let chunkNum = state.chunks_completed.length + 1; chunkNum <= BASELINE.chunk_count; chunkNum++) {
  log(`\n─── Chunk ${chunkNum} of ${BASELINE.chunk_count} ───`);

  // Elapsed check
  const elapsedSec = (Date.now() - t0) / 1000;
  if (elapsedSec > STOP_ELAPSED_SEC) await bail(`total elapsed > ${STOP_ELAPSED_SEC}s (${elapsedSec.toFixed(0)}s)`);

  const lastId = state.last_merge_id ?? "00000000-0000-0000-0000-000000000000";

  // PRE measurements
  const pre = (await targetSql(`
    SELECT pg_database_size(current_database())::text AS db,
           pg_current_wal_lsn()::text AS wal,
           (SELECT count(*) FROM nex.identity_merge_log)::text AS cnt
  `)).body[0];
  const roPre = await targetReadonly();
  log(`  PRE:  db=${(Number(pre.db)/1024/1024).toFixed(1)} MB, wal=${pre.wal}, target_count=${pre.cnt}, readonly=${roPre.enabled}`);
  if (roPre.enabled) await bail("readonly=true at PRE");
  if (BigInt(pre.db) > STOP_DB_BYTES) await bail(`db_size > 3GB at PRE: ${pre.db} bytes`);

  // Predict expected boundaries + count from local (before extraction)
  const predict = localSql(`
    WITH t AS (
      SELECT merge_id::text AS mid FROM nex.identity_merge_log
      WHERE merge_id > '${lastId}'::uuid
      ORDER BY merge_id LIMIT ${CHUNK_SIZE}
    )
    SELECT
      (SELECT count(*) FROM t)::text || '|' ||
      coalesce((SELECT min(mid) FROM t), 'NULL') || '|' ||
      coalesce((SELECT max(mid) FROM t), 'NULL')
  `);
  if (!predict) await bail("predict query failed");
  const [predCountStr, predFirst, predLast] = predict.split("|");
  const predCount = Number(predCountStr);
  log(`  predicted: rows=${predCount}, first=${predFirst}, last=${predLast}`);
  if (predCount === 0) { log(`  no more rows to extract · exiting loop early`); break; }

  // Extract chunk to CSV (text format · tab-delimited · backslash-escaped)
  const chunkPath = resolve(TMP_DIR, `chunk-${chunkNum}.csv`);
  if (existsSync(chunkPath)) unlinkSync(chunkPath);
  const extractSql = `\\copy (SELECT merge_id, table_name, existing_ref, match_layer, incoming_source, incoming_source_reference, incoming_name, incoming_city, incoming_website, incoming_phone, incoming_whatsapp, incoming_lat, incoming_lng, incoming_extras, enriched_fields, skipped_reason, worker_id, cycle_run_id, merged_at FROM nex.identity_merge_log WHERE merge_id > '${lastId}'::uuid ORDER BY merge_id LIMIT ${CHUNK_SIZE}) TO '${chunkPath.replace(/\\/g, "/")}'`;
  const t1 = Date.now();
  const ex = spawnSync(PSQL, ["-v", "ON_ERROR_STOP=1", "-Atc", extractSql, LOCAL_URI], { env: { ...process.env, PGPASSWORD: "Admin1phil" }, encoding: "utf8", timeout: 300000 });
  if (ex.status !== 0) await bail(`extract failed`, { stderr: ex.stderr, stdout: ex.stdout });
  const csvSize = statSync(chunkPath).size;
  const extractSec = ((Date.now() - t1) / 1000).toFixed(2);
  log(`  extracted: ${csvSize.toLocaleString()} bytes in ${extractSec}s`);

  // Verify CSV boundaries + row count
  const csv = await csvFirstLastFirstCol(chunkPath);
  log(`  CSV: rows=${csv.rows}, first=${csv.first}, last=${csv.last}`);
  if (csv.rows !== predCount) await bail(`CSV row count mismatch`, { predicted: predCount, csv: csv.rows });
  if (csv.first !== predFirst) await bail(`CSV first merge_id mismatch`, { predicted: predFirst, csv: csv.first });
  if (csv.last !== predLast) await bail(`CSV last merge_id mismatch`, { predicted: predLast, csv: csv.last });
  log(`  ✓ CSV verified · exact boundaries + count`);

  // LOAD via temp SQL file (psql \copy is a meta-command · must be on its own line)
  const loadScriptPath = resolve(TMP_DIR, `load-chunk-${chunkNum}.sql`);
  const loadScriptContent = `SET ROLE service_role;
BEGIN;
\\copy nex.identity_merge_log (merge_id, table_name, existing_ref, match_layer, incoming_source, incoming_source_reference, incoming_name, incoming_city, incoming_website, incoming_phone, incoming_whatsapp, incoming_lat, incoming_lng, incoming_extras, enriched_fields, skipped_reason, worker_id, cycle_run_id, merged_at) FROM '${chunkPath.replace(/\\/g, "/")}'
COMMIT;
`;
  writeFileSync(loadScriptPath, loadScriptContent);
  const t2 = Date.now();
  const ld = spawnSync(PSQL, ["-v", "ON_ERROR_STOP=1", "-f", loadScriptPath, DB_URL], { env: { ...process.env, PGOPTIONS: "-c statement_timeout=0 -c lock_timeout=0 -c idle_in_transaction_session_timeout=0" }, encoding: "utf8", timeout: 600000 });
  try { unlinkSync(loadScriptPath); } catch {}
  if (ld.status !== 0) await bail(`load failed (transaction rolled back)`, { stderr: scrub(ld.stderr), stdout: scrub(ld.stdout) });
  const loadSec = ((Date.now() - t2) / 1000).toFixed(2);
  log(`  loaded in ${loadSec}s · psql exit ${ld.status}`);

  // POST measurements
  const post = (await targetSql(`
    SELECT pg_database_size(current_database())::text AS db,
           pg_current_wal_lsn()::text AS wal,
           (SELECT count(*) FROM nex.identity_merge_log)::text AS cnt
  `)).body[0];
  const roPost = await targetReadonly();
  const dbDelta = BigInt(post.db) - BigInt(pre.db);
  const walDelta = await lsnDiff(pre.wal, post.wal);
  log(`  POST: db=${(Number(post.db)/1024/1024).toFixed(1)} MB, wal=${post.wal}, target_count=${post.cnt}, readonly=${roPost.enabled}`);
  log(`  DELTA: db=+${dbDelta.toString()} B (${(Number(dbDelta)/1024/1024).toFixed(2)} MB), wal=+${walDelta?.toString()} B (${walDelta ? (Number(walDelta)/1024/1024).toFixed(2) : "?"} MB)`);

  // Verify delta
  const targetDelta = Number(post.cnt) - Number(pre.cnt);
  if (targetDelta !== csv.rows) await bail(`target delta mismatch`, { csv_rows: csv.rows, target_delta: targetDelta });
  if (walDelta !== null && walDelta > STOP_WAL_BYTES) await bail(`WAL delta > 200 MB: ${walDelta}`);
  if (BigInt(post.db) > STOP_DB_BYTES) await bail(`db_size > 3 GB after chunk: ${post.db}`);
  if (roPost.enabled) await bail("readonly=true at POST");

  // Success · persist state
  state.chunks_completed.push({
    chunk_num: chunkNum,
    first_merge_id: csv.first,
    last_merge_id: csv.last,
    rows_sent: csv.rows,
    target_before: Number(pre.cnt),
    target_after: Number(post.cnt),
    db_bytes_before: pre.db, db_bytes_after: post.db, db_delta_bytes: dbDelta.toString(),
    wal_lsn_before: pre.wal, wal_lsn_after: post.wal, wal_delta_bytes: walDelta ? walDelta.toString() : null,
    extract_seconds: Number(extractSec), load_seconds: Number(loadSec),
    at: new Date().toISOString(),
  });
  state.last_merge_id = csv.last;
  state.target_row_count = Number(post.cnt);
  saveState(state);

  // Cleanup temp CSV
  try { unlinkSync(chunkPath); } catch {}
  log(`  ✓ chunk ${chunkNum} committed · cumulative ${state.target_row_count.toLocaleString()} / ${BASELINE.total_rows.toLocaleString()}`);
}

// ── POST-BATCH VERIFICATION ──────────────────────────────────────────────
log(`\n════════════════════════════════════════════════════════════════════════`);
log(`POST-BATCH VERIFICATION`);
log(`════════════════════════════════════════════════════════════════════════`);

// A. Target count
const targetCount = Number((await targetSql(`SELECT count(*)::text AS c FROM nex.identity_merge_log`)).body[0].c);
log(`  A · target count: ${targetCount.toLocaleString()} (expected ${BASELINE.total_rows.toLocaleString()}) ${targetCount === BASELINE.total_rows ? "✓" : "❌"}`);

// B. min/max
const mm = (await targetSql(`SELECT min(merge_id::text) AS mn, max(merge_id::text) AS mx FROM nex.identity_merge_log`)).body[0];
log(`  B · min/max: min=${mm.mn} ${mm.mn === BASELINE.min_merge_id ? "✓" : "❌"} · max=${mm.mx} ${mm.mx === BASELINE.max_merge_id ? "✓" : "❌"}`);

// C. match_layer distribution
const layers = (await targetSql(`SELECT match_layer AS k, count(*)::text AS v FROM nex.identity_merge_log GROUP BY match_layer`)).body;
const layerOk = layers.every(r => Number(r.v) === BASELINE.by_match_layer[r.k]) && Object.keys(BASELINE.by_match_layer).length === layers.length;
log(`  C · match_layer: ${layerOk ? "✓ all 5 match" : "❌"} · ${JSON.stringify(layers)}`);

// D. table_name distribution
const tables = (await targetSql(`SELECT table_name AS k, count(*)::text AS v FROM nex.identity_merge_log GROUP BY table_name`)).body;
const tableOk = tables.every(r => Number(r.v) === BASELINE.by_table_name[r.k]) && Object.keys(BASELINE.by_table_name).length === tables.length;
log(`  D · table_name: ${tableOk ? "✓ all match" : "❌"} · ${JSON.stringify(tables)}`);

// E. day distribution
const days = (await targetSql(`SELECT date_trunc('day', merged_at)::date::text AS k, count(*)::text AS v FROM nex.identity_merge_log GROUP BY date_trunc('day', merged_at) ORDER BY 1`)).body;
const dayOk = days.every(r => Number(r.v) === BASELINE.by_day_merged_at[r.k]) && Object.keys(BASELINE.by_day_merged_at).length === days.length;
log(`  E · day(merged_at): ${dayOk ? "✓ all match" : "❌"} · ${JSON.stringify(days)}`);

// F. 100 random deep-compare
log(`  F · 100 random full-row compares...`);
const randSample = (await targetSql(`SELECT merge_id::text FROM nex.identity_merge_log ORDER BY random() LIMIT 100`)).body.map(r => r.merge_id);
let fMatch = 0, fMismatch = 0;
for (const mid of randSample) {
  const localRow = localSql(`SELECT md5(row(merge_id, table_name, existing_ref, match_layer, incoming_source, incoming_source_reference, incoming_name, incoming_city, incoming_website, incoming_phone, incoming_whatsapp, incoming_lat, incoming_lng, incoming_extras, enriched_fields, skipped_reason, worker_id, cycle_run_id, merged_at)::text) FROM nex.identity_merge_log WHERE merge_id = '${mid}'::uuid`);
  const targetRow = (await targetSql(`SELECT md5(row(merge_id, table_name, existing_ref, match_layer, incoming_source, incoming_source_reference, incoming_name, incoming_city, incoming_website, incoming_phone, incoming_whatsapp, incoming_lat, incoming_lng, incoming_extras, enriched_fields, skipped_reason, worker_id, cycle_run_id, merged_at)::text) FROM nex.identity_merge_log WHERE merge_id = '${mid}'::uuid`)).body[0]?.md5;
  if (localRow === targetRow) fMatch++;
  else fMismatch++;
}
log(`  F · sample deep-compare: ${fMatch}/100 match · ${fMismatch} mismatches ${fMismatch === 0 ? "✓" : "❌"}`);

// G. Subset hash
const subsetHash = (await targetSql(`
  SELECT md5(string_agg(
    merge_id::text || chr(31) ||
    coalesce(quote_nullable(table_name), 'NULL') || chr(31) ||
    coalesce(quote_nullable(match_layer), 'NULL') || chr(31) ||
    coalesce(quote_nullable(incoming_source), 'NULL') || chr(31) ||
    merged_at::text,
    chr(30) ORDER BY merge_id
  )) AS h
  FROM nex.identity_merge_log
  WHERE merge_id::text LIKE '00%'
`)).body[0].h;
const hashOk = subsetHash === BASELINE.subset_hash;
log(`  G · subset md5: ${subsetHash} ${hashOk ? "✓ MATCHES baseline" : "❌ MISMATCH · baseline=" + BASELINE.subset_hash}`);

// Invariants check
const inv = (await targetSql(`
  SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
         (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
         (SELECT count(*) FROM public.knowledge_records) AS kr,
         (SELECT count(*) FROM public.worker_jobs) AS wj,
         (SELECT count(*) FROM public.worker_results) AS wr,
         pg_database_size(current_database())::text AS db
`)).body[0];
log(`\n  Invariants: RLS=${inv.rls}(exp 92) FKs=${inv.fks}(exp 0) kr=${inv.kr}(exp 3627) wj=${inv.wj}(exp 19167) wr=${inv.wr}(exp 19140)`);
log(`  Final DB size: ${(Number(inv.db)/1024/1024).toFixed(1)} MB`);

// Summary
const allOk = targetCount === BASELINE.total_rows && mm.mn === BASELINE.min_merge_id && mm.mx === BASELINE.max_merge_id && layerOk && tableOk && dayOk && fMismatch === 0 && hashOk;
const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
const chunkDeltas = state.chunks_completed.map(c => ({ chunk: c.chunk_num, db: c.db_delta_bytes, wal: c.wal_delta_bytes }));
const largestDb = state.chunks_completed.reduce((max, c) => BigInt(c.db_delta_bytes) > BigInt(max.db_delta_bytes) ? c : max, state.chunks_completed[0]);
const largestWal = state.chunks_completed.filter(c => c.wal_delta_bytes).reduce((max, c) => BigInt(c.wal_delta_bytes) > BigInt(max.wal_delta_bytes) ? c : max, state.chunks_completed[0]);
log(`\n════════════════════════════════════════════════════════════════════════`);
log(`SUMMARY`);
log(`════════════════════════════════════════════════════════════════════════`);
log(`  All verifications passed: ${allOk ? "✅" : "❌"}`);
log(`  Total elapsed: ${totalElapsed}s`);
log(`  Chunks completed: ${state.chunks_completed.length}`);
log(`  Cumulative rows: ${state.target_row_count.toLocaleString()}`);
log(`  Cumulative DB growth: ${(Number(BigInt(inv.db) - BigInt(initInv.db))/1024/1024).toFixed(2)} MB`);
log(`  Largest chunk DB delta: chunk ${largestDb.chunk_num} · ${(Number(largestDb.db_delta_bytes)/1024/1024).toFixed(2)} MB`);
log(`  Largest chunk WAL delta: chunk ${largestWal?.chunk_num} · ${largestWal?.wal_delta_bytes ? (Number(largestWal.wal_delta_bytes)/1024/1024).toFixed(2) + " MB" : "n/a"}`);
log(`  Final readonly: ${(await targetReadonly()).enabled}`);

state.complete = allOk;
state.verification = { A: targetCount === BASELINE.total_rows, B_min: mm.mn === BASELINE.min_merge_id, B_max: mm.mx === BASELINE.max_merge_id, C: layerOk, D: tableOk, E: dayOk, F: { match: fMatch, mismatch: fMismatch }, G: hashOk };
state.ended_at = new Date().toISOString();
state.total_elapsed_seconds = Number(totalElapsed);
saveState(state);

log(`\n─── HARD STOP · awaiting Philip approval for Batch 7 (FK recreation) ───`);
process.exit(allOk ? 0 : 1);
