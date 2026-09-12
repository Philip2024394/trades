#!/usr/bin/env node
// Batch 5 · LARGE · pre-check + pg_restore --role=service_role + post-check.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const DB_URL = envText.match(/^NEX_SUPABASE_DB_URL=(.+)$/m)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const BACKUP = "D:/nex-backups/nex_dev-2026-09-03-0230-post-enum-fix.dump";
const LIST_FILE = resolve(__dirname, "batch-05-large.list");
const LOG_FILE = resolve(__dirname, "batch-05.log");
const PG_RESTORE = "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe";

const BATCH5_EXPECTED = {
  discovery_rotation_state: 54550,
  provider_rate_lease: 87954,
  food_business_field_provenance: 105320,
};
const BATCH5_TABLES = Object.keys(BATCH5_EXPECTED);
const BATCH5_EXPECTED_TOTAL = Object.values(BATCH5_EXPECTED).reduce((a,b)=>a+b,0);

writeFileSync(LOG_FILE, "");
function scrub(s) { const pw = DB_URL.split("@")[0].split(":").pop(); return String(s).split(pw).join("<PASSWORD>"); }
function log(m) { const s = `[${new Date().toISOString()}] ${m}\n`; appendFileSync(LOG_FILE, scrub(s)); process.stderr.write(scrub(m + "\n")); }

async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}
function bail(msg) { log(`❌ HARD STOP · ${msg}`); process.exit(2); }

log(`=== BATCH 5 EXECUTION · ${BATCH5_TABLES.length} tables · expected ${BATCH5_EXPECTED_TOTAL} rows ===`);

// PRE-CHECK
log("\n─── PRE-CHECK ───");
const inv = (await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls_enabled,
    (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS nex_fks,
    (SELECT count(*) FROM public.knowledge_records) AS kr,
    (SELECT count(*) FROM public.worker_jobs) AS wj,
    (SELECT count(*) FROM public.worker_results) AS wr,
    (SELECT count(*) FROM nex.identity_merge_log) AS imel,
    pg_database_size(current_database()) AS db_bytes,
    pg_size_pretty(pg_database_size(current_database())) AS db_pretty,
    pg_current_wal_lsn()::text AS wal_lsn
`)).body[0];
log(`  invariants: ${JSON.stringify(inv)}`);
if (inv.rls_enabled !== 92) bail(`RLS drift: ${inv.rls_enabled}`);
if (Number(inv.nex_fks) !== 0) bail(`FK drift: ${inv.nex_fks}`);
if (inv.kr !== 3627 || inv.wj !== 19167 || inv.wr !== 19140) bail("public.* drift");
if (Number(inv.imel) !== 0) bail(`identity_merge_log populated: ${inv.imel}`);
log(`  ✓ identity_merge_log still 0 rows (untouched)`);

const cols5 = BATCH5_TABLES.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const b5pre = (await q(`SELECT ${cols5}`)).body[0];
const b5sumPre = Object.values(b5pre).reduce((a,v)=>a+Number(v),0);
if (b5sumPre !== 0) bail(`Batch 5 tables not empty: ${b5sumPre}`);
log(`  ✓ Batch 5 target tables all empty`);

const ro = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
if (ro.enabled) bail("readonly enabled");
log(`  ✓ readonly enabled=false`);

const preState = { db_bytes: inv.db_bytes, db_pretty: inv.db_pretty, wal_lsn: inv.wal_lsn };
log(`  DB size PRE:  ${preState.db_pretty} (${Number(preState.db_bytes).toLocaleString()} bytes)`);
log(`  WAL LSN PRE:  ${preState.wal_lsn}`);

log("\n─── EXECUTING pg_restore ───");
const t0 = Date.now();
const args = ["--dbname", DB_URL, "--role=service_role", "--data-only", "--schema=nex", `--use-list=${LIST_FILE}`, "--jobs=1", "--exit-on-error", "--verbose", "--no-owner", "--no-acl", BACKUP];
const restoreEnv = { ...process.env, PGOPTIONS: "-c statement_timeout=0 -c lock_timeout=0 -c idle_in_transaction_session_timeout=0" };
const proc = spawn(PG_RESTORE, args, { env: restoreEnv, stdio: ["ignore", "pipe", "pipe"] });
proc.stdout.on("data", d => { const s = scrub(d.toString()); process.stdout.write(s); appendFileSync(LOG_FILE, s); });
proc.stderr.on("data", d => { const s = scrub(d.toString()); process.stderr.write(s); appendFileSync(LOG_FILE, s); });
const exit = await new Promise(res => proc.on("close", res));
const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
log(`\npg_restore exit: ${exit} · elapsed: ${elapsed}s`);

// POST-CHECK
log("\n─── POST-CHECK ───");
const post = (await q(`SELECT pg_database_size(current_database()) AS db_bytes, pg_size_pretty(pg_database_size(current_database())) AS db_pretty, pg_current_wal_lsn()::text AS wal_lsn`)).body[0];
const dbDelta = Number(post.db_bytes) - Number(preState.db_bytes);
log(`  DB size PRE→POST:  ${preState.db_pretty} → ${post.db_pretty}  delta: +${dbDelta} bytes (${(dbDelta/1024/1024).toFixed(2)} MB)`);
log(`  WAL LSN PRE→POST:  ${preState.wal_lsn} → ${post.wal_lsn}`);

const b5Post = (await q(`SELECT ${cols5}`)).body[0];
let matched = 0, mismatched = 0, totalActual = 0;
const failed = [];
for (const t of BATCH5_TABLES) {
  const actual = Number(b5Post[t]);
  const expected = BATCH5_EXPECTED[t];
  totalActual += actual;
  if (actual === expected) matched++;
  else { mismatched++; failed.push({ table: t, expected, actual, delta: expected - actual }); }
}
if (failed.length === 0) log(`  ✓ ALL ${matched}/${BATCH5_TABLES.length} Batch 5 tables match · total = ${totalActual} (expected ${BATCH5_EXPECTED_TOTAL})`);
else {
  log(`  ⚠️ ${failed.length} mismatches (likely dump-vs-local drift):`);
  for (const r of failed) log(`     ${r.table.padEnd(45)} expected=${r.expected}  actual=${r.actual}  delta=${r.delta}`);
  log(`  matched: ${matched}, mismatched: ${mismatched}, total: ${totalActual}/${BATCH5_EXPECTED_TOTAL}`);
}

const imelPost = (await q("SELECT count(*) AS n FROM nex.identity_merge_log")).body[0];
log(`  identity_merge_log POST: ${imelPost.n} rows ${Number(imelPost.n) === 0 ? "✓ untouched" : "❌"}`);

const pp = (await q(`SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables, (SELECT count(*) FROM public.knowledge_records) AS kr, (SELECT count(*) FROM public.worker_jobs) AS wj, (SELECT count(*) FROM public.worker_results) AS wr`)).body[0];
const pubOk = pp.public_tables === 17 && pp.kr === 3627 && pp.wj === 19167 && pp.wr === 19140;
log(`  public POST: ${JSON.stringify(pp)} · unchanged=${pubOk ? "✓" : "❌"}`);

const rlsPost = (await q(`SELECT count(*) FILTER (WHERE c.relrowsecurity=true) AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r'`)).body[0];
log(`  RLS POST: ${rlsPost.rls_enabled} (expected 92) ${rlsPost.rls_enabled === 92 ? "✓" : "❌"}`);
const fkPost = (await q(`SELECT count(*) AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f'`)).body[0];
log(`  FK POST: ${fkPost.n} (expected 0) ${Number(fkPost.n) === 0 ? "✓" : "❌"}`);

const roPost = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
log(`  readonly POST: enabled=${roPost.enabled}`);

const B5_BYTES_PER_ROW = totalActual > 0 ? dbDelta / totalActual : 0;
log(`\n  Batch 5 efficiency: ${B5_BYTES_PER_ROW.toFixed(0)} B/row (B2=669, B3=800, B4=808)`);
log(`  Cumulative populated tables: 134 (through Batch 4) + ${matched === BATCH5_TABLES.length ? BATCH5_TABLES.length : matched + " matched"} = 137 expected`);

const report = {
  batch: 5, pg_restore_exit: exit, elapsed_seconds: Number(elapsed),
  pre: preState, post,
  db_delta_bytes: dbDelta, db_delta_pretty: `${(dbDelta/1024/1024).toFixed(2)} MB`,
  wal_delta: `${preState.wal_lsn} → ${post.wal_lsn}`,
  batch5_reconciliation: { matched, mismatched, expected_total: BATCH5_EXPECTED_TOTAL, actual_total: totalActual, failures: failed },
  identity_merge_log_untouched: Number(imelPost.n) === 0,
  public_baseline_post: pp, public_unchanged: pubOk,
  rls_state_post: rlsPost, rls_unchanged: rlsPost.rls_enabled === 92,
  fks_post: Number(fkPost.n), readonly_post: roPost,
  bytes_per_row_batch5: Math.round(B5_BYTES_PER_ROW),
};
writeFileSync(resolve(__dirname, "batch-05-report.json"), JSON.stringify(report, null, 2));

// Local freeze sanity check
const { execSync } = await import("node:child_process");
const nodePs = execSync("powershell -NoProfile -Command \"(Get-CimInstance Win32_Process -Filter \\\"Name='node.exe'\\\" | Where-Object { $_.CommandLine -notlike '*execute-batch05*' } | Measure-Object).Count\"", { encoding: "utf8" }).trim();
const taskState = execSync("powershell -NoProfile -Command \"(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce').State\"", { encoding: "utf8" }).trim();
log(`\n  Local freeze: node processes=${nodePs} (excl this script), scheduled task=${taskState}`);

log(`\n─── HARD STOP · Batch 5 complete · awaiting approval for Batch 6 (identity_merge_log) ───`);
process.exit(exit);
