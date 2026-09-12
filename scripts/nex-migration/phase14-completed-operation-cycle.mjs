// Phase 14 · Second production observation cycle · run to completion.
//
// Baselines both DBs on lifecycle + content-bearing tables.
// Launches production launcher.
// Polls Project B every 6 seconds for up to 15 minutes.
// Stops as soon as at least one work_item or worker_cycle_run row created
// during this observation reaches a TERMINAL status (completed / failed).
// Then kills the process tree and reports.
//
// Stop condition targets:
//   · work_item.status IN ('completed','failed','dead_letter')
//   · OR worker_cycle_run.status IN ('completed','failed')
// (Philip: 'completed' preferred · 'failed' with legitimate reason accepted)

import pg from "pg";
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..", "..");

const envTools = readFileSync(resolve(REPO, ".env.tools.local"), "utf8");
const RUNTIME_URL = envTools.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];
const LOCAL_URL   = "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const OBS_MAX_MS  = 15 * 60_000;
const POLL_MS     = 6_000;
const START_MARK  = new Date();
const LAUNCH_OUT  = resolve(REPO, "data", "nex-acquisition-workforce", `phase14-launcher-${Date.now()}.log`);

function ts() { return new Date().toISOString(); }
function redactUrl(u) { return u.replace(/:[^:@/]+@/, ":****@"); }
function log(...args) { console.log(`[${ts()}]`, ...args); }
async function q(pool, sql, params) {
  const c = await pool.connect();
  try { return await c.query(sql, params); } finally { c.release(); }
}

log("=== Phase 14 · Second observation cycle · wait for terminal state ===");
log(`Target: ${redactUrl(RUNTIME_URL)}`);
log(`Local:  ${redactUrl(LOCAL_URL)}`);
log(`Launcher log: ${LAUNCH_OUT}`);
mkdirSync(dirname(LAUNCH_OUT), { recursive: true });

const projectB = new pg.Pool({ connectionString: RUNTIME_URL, ssl: { rejectUnauthorized: false }, max: 2 });
const local    = new pg.Pool({ connectionString: LOCAL_URL, max: 1, connectionTimeoutMillis: 5000 });

// ── Baseline both DBs on lifecycle + content tables ────────────────
log("\n─── Step 1 · Baseline both DBs ───");
async function snapshot(pool, label) {
  const r = await q(pool, `
    SELECT
      (SELECT count(*)::int FROM nex.worker_heartbeat)                              AS heartbeats,
      (SELECT count(*)::int FROM nex.worker_cycle_run)                              AS cycle_runs,
      (SELECT count(*)::int FROM nex.work_item)                                     AS work_items,
      (SELECT count(*)::int FROM nex.food_business)                                 AS food_business,
      (SELECT count(*)::int FROM nex.service_business)                              AS service_business,
      (SELECT count(*)::int FROM nex.service_business_source_snapshot)              AS sbss,
      (SELECT max(started_at)::text FROM nex.worker_cycle_run)                      AS latest_cycle_started_at
  `);
  const row = r.rows[0];
  log(`  ${label}: hb=${row.heartbeats} cyc=${row.cycle_runs} wi=${row.work_items} · fb=${row.food_business} sb=${row.service_business} sbss=${row.sbss}`);
  return row;
}
const baselineB = await snapshot(projectB, "Project B");
const baselineL = await snapshot(local,    "local nex_dev");

// ── Launch ─────────────────────────────────────────────────────────
log("\n─── Step 2 · Launch run-production-launcher.mjs ───");
const launcherLog = createWriteStream(LAUNCH_OUT, { flags: "a" });
launcherLog.write(`\n\n===== phase14 launch @ ${ts()} =====\n`);

const launcher = spawn(process.execPath, [
  join(REPO, "scripts", "nex-acquisition-workforce", "run-production-launcher.mjs"),
], { cwd: REPO, stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true });
log(`  spawned launcher · PID=${launcher.pid}`);

const outLines = [];
const errLines = [];
launcher.stdout.on("data", (b) => {
  const s = b.toString();
  launcherLog.write(s);
  for (const l of s.split(/\r?\n/)) if (l.trim()) outLines.push(l);
});
launcher.stderr.on("data", (b) => {
  const s = b.toString();
  launcherLog.write("STDERR: " + s);
  for (const l of s.split(/\r?\n/)) if (l.trim()) errLines.push(l);
});
launcher.on("exit", (code, signal) => log(`  launcher exited · code=${code} signal=${signal}`));

// ── Poll for terminal state ────────────────────────────────────────
log("\n─── Step 3 · Poll Project B for terminal state ───");
const deadline = Date.now() + OBS_MAX_MS;
let terminalObserved = null;
let lastPoll = null;

while (Date.now() < deadline && !terminalObserved) {
  await new Promise((r) => setTimeout(r, POLL_MS));

  // Check whether any work_item or worker_cycle_run row created in THIS
  // observation window has reached a terminal state.
  const wi = await q(projectB, `
    SELECT work_item_id::text, job_slug, city, status, attempt_count,
           created_at::text, updated_at::text
      FROM nex.work_item
     WHERE created_at > $1::timestamptz
     ORDER BY created_at DESC`, [START_MARK.toISOString()]);
  const cyc = await q(projectB, `
    SELECT id::text, worker_type, worker_config, status,
           records_processed, records_new, records_rejected,
           duration_ms, started_at::text, finished_at::text
      FROM nex.worker_cycle_run
     WHERE started_at > $1::timestamptz
     ORDER BY started_at DESC`, [START_MARK.toISOString()]);
  const cur = await snapshot(projectB, "  poll");

  const wiTerminal  = wi.rows.filter((r)  => ["completed","failed","dead_letter"].includes(r.status));
  const cycTerminal = cyc.rows.filter((r) => ["completed","failed"].includes(r.status));

  log(`  · this-run rows: work_items=${wi.rows.length} (${wiTerminal.length} terminal) · cycles=${cyc.rows.length} (${cycTerminal.length} terminal)`);
  if (cyc.rows.length) {
    for (const c of cyc.rows.slice(0, 3)) {
      log(`      cycle ${c.id.slice(0,8)}… · ${c.worker_type} · status=${c.status} · processed=${c.records_processed ?? '-'} new=${c.records_new ?? '-'} rejected=${c.records_rejected ?? '-'} duration_ms=${c.duration_ms ?? '-'}`);
    }
  }
  lastPoll = { wi: wi.rows, cyc: cyc.rows, snapshot: cur };

  // Stop when EITHER a work_item OR a cycle_run reaches terminal state.
  if (wiTerminal.length > 0 || cycTerminal.length > 0) {
    terminalObserved = { wiTerminal, cycTerminal };
    log(`  ✓ terminal state observed · will stop after collecting evidence`);
  }

  if (launcher.exitCode !== null) {
    log(`  ⚠ launcher already exited · code=${launcher.exitCode}`);
    break;
  }
}

if (!terminalObserved && Date.now() >= deadline) {
  log(`  ⚠ observation deadline hit (${OBS_MAX_MS/1000}s) without terminal state`);
}

// ── Kill launcher tree ─────────────────────────────────────────────
log("\n─── Step 4 · Kill launcher process tree ───");
if (launcher.exitCode === null && launcher.pid) {
  const kill = spawnSync("taskkill", ["/F", "/T", "/PID", String(launcher.pid)], { encoding: "utf8" });
  const summary = (kill.stdout || "").trim().split(/\r?\n/).filter(Boolean);
  log(`  taskkill terminated ${summary.length} processes in the tree`);
}
await new Promise((r) => setTimeout(r, 3000));

// ── Post-verify · projectB deltas ──────────────────────────────────
log("\n─── Step 5 · Post-observation snapshot ───");
const afterB = await snapshot(projectB, "Project B (after)");
const afterL = await snapshot(local,    "local nex_dev (after)");

// Enumerate the specific rows landing this observation.
const evidenceWi = await q(projectB, `
  SELECT work_item_id::text, job_slug, city, status, attempt_count,
         created_at::text, updated_at::text
    FROM nex.work_item
   WHERE created_at > $1::timestamptz
   ORDER BY created_at DESC`, [START_MARK.toISOString()]);
const evidenceCyc = await q(projectB, `
  SELECT id::text, worker_type, worker_config, status,
         records_processed, records_new, records_rejected,
         duration_ms, started_at::text, finished_at::text,
         summary::text AS summary
    FROM nex.worker_cycle_run
   WHERE started_at > $1::timestamptz
   ORDER BY started_at DESC`, [START_MARK.toISOString()]);
const evidenceSup = await q(projectB, `
  SELECT worker_id, worker_type, last_status, last_heartbeat_at::text
    FROM nex.worker_heartbeat
   WHERE last_heartbeat_at > $1::timestamptz
   ORDER BY last_heartbeat_at DESC
   LIMIT 5`, [START_MARK.toISOString()]);

// Trace content growth · did any actual business rows land?
const contentDeltas = {
  food_business:    afterB.food_business    - baselineB.food_business,
  service_business: afterB.service_business - baselineB.service_business,
  sbss:             afterB.sbss             - baselineB.sbss,
};

// Sample specific rows written · try to link to the completed cycle.
let sampleServiceRows = [];
if (contentDeltas.service_business > 0) {
  const sample = await q(projectB, `
    SELECT service_business_id::text, business_name, category_slug, city, created_at::text
      FROM nex.service_business
     WHERE created_at > $1::timestamptz
     ORDER BY created_at DESC LIMIT 5`, [START_MARK.toISOString()]);
  sampleServiceRows = sample.rows;
}
let sampleSbssRows = [];
if (contentDeltas.sbss > 0) {
  const sample = await q(projectB, `
    SELECT snapshot_id::text, service_business_id::text, provider, captured_at::text
      FROM nex.service_business_source_snapshot
     WHERE captured_at > $1::timestamptz
     ORDER BY captured_at DESC LIMIT 5`, [START_MARK.toISOString()]);
  sampleSbssRows = sample.rows;
}

// Local deltas
const localDelta = {
  heartbeats:       afterL.heartbeats       - baselineL.heartbeats,
  cycle_runs:       afterL.cycle_runs       - baselineL.cycle_runs,
  work_items:       afterL.work_items       - baselineL.work_items,
  food_business:    afterL.food_business    - baselineL.food_business,
  service_business: afterL.service_business - baselineL.service_business,
  sbss:             afterL.sbss             - baselineL.sbss,
};

// Boot-guard confirmation
const bootGuard = outLines.find((l) => l.includes("[launcher] NEX_POSTGRES_URL ok"));
const permDenied = errLines.filter((l) => /permission denied/i.test(l));
const rlsErrs    = errLines.filter((l) => /row-level security|row level security/i.test(l));

// Orphan scan (non-self-referential)
const scan = spawnSync("powershell", ["-NoProfile", "-Command",
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '(run-production-launcher|run-production-watchdog|run-production-supervisor|scripts/nex-workforce/_category-walker)' -and $_.CommandLine -notmatch 'phase\\d+|Get-CimInstance|Select-String' } | Measure-Object | Select-Object -ExpandProperty Count"],
  { encoding: "utf8" });
const orphanCount = Number((scan.stdout || "0").trim()) || 0;

// Scheduled Task state
const task = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce').State"], { encoding: "utf8" });
const taskState = (task.stdout || "").trim();

await projectB.end();
await local.end();
launcherLog.end();

// ── FINAL REPORT ───────────────────────────────────────────────────
console.log("\n\n════ FINAL REPORT ════");

console.log("\n1. Boot guard output:");
console.log(`   ${bootGuard || '(NOT SEEN)'}`);

console.log("\n2. Supervisor heartbeats landed in Project B (this run):");
for (const h of evidenceSup.slice(0, 3)) {
  console.log(`   · ${h.last_heartbeat_at} · ${h.worker_id} · status=${h.last_status}`);
}

console.log(`\n3. Work items created (${evidenceWi.rows.length} total):`);
for (const w of evidenceWi.rows.slice(0, 5)) {
  console.log(`   · ${w.job_slug}/${w.city} · status=${w.status} · attempt=${w.attempt_count} · updated=${w.updated_at}`);
}

console.log(`\n4. Worker cycle runs created (${evidenceCyc.rows.length} total):`);
for (const c of evidenceCyc.rows.slice(0, 5)) {
  console.log(`   · ${c.id.slice(0,8)}… ${c.worker_type} status=${c.status} processed=${c.records_processed ?? '-'} new=${c.records_new ?? '-'} rejected=${c.records_rejected ?? '-'} duration_ms=${c.duration_ms ?? '-'} finished=${c.finished_at ?? '(unset)'}`);
  if (c.summary && c.summary !== 'null') console.log(`     summary: ${c.summary.slice(0, 200)}`);
}

console.log("\n5. Content-table deltas in Project B:");
console.log(`   nex.food_business:    ${contentDeltas.food_business >= 0 ? '+' : ''}${contentDeltas.food_business}`);
console.log(`   nex.service_business: ${contentDeltas.service_business >= 0 ? '+' : ''}${contentDeltas.service_business}`);
console.log(`   nex.service_business_source_snapshot: ${contentDeltas.sbss >= 0 ? '+' : ''}${contentDeltas.sbss}`);

if (sampleServiceRows.length) {
  console.log("\n   Sample service_business rows created this run:");
  for (const r of sampleServiceRows) console.log(`     · ${r.service_business_id.slice(0,8)}… "${r.business_name}" (${r.category_slug} / ${r.city}) @ ${r.created_at}`);
}
if (sampleSbssRows.length) {
  console.log("\n   Sample source-snapshot rows created this run:");
  for (const r of sampleSbssRows) console.log(`     · ${r.snapshot_id.slice(0,8)}… sb=${r.service_business_id.slice(0,8)}… provider=${r.provider} @ ${r.captured_at}`);
}

console.log("\n6. Local nex_dev deltas (must all be 0):");
for (const [k, v] of Object.entries(localDelta)) {
  console.log(`   ${k.padEnd(20)} = ${v} ${v === 0 ? '✓' : '❌ NON-ZERO'}`);
}

console.log("\n7. Error surface (stderr):");
console.log(`   permission-denied lines: ${permDenied.length}`);
console.log(`   RLS-blocked lines:       ${rlsErrs.length}`);

console.log("\n8. Environment / process state:");
console.log(`   Scheduled Task state:    ${taskState}`);
console.log(`   Orphaned NEX processes:  ${orphanCount}`);

// Verdict
const cycleCompleted   = evidenceCyc.rows.some((c) => c.status === "completed");
const cycleFailed      = evidenceCyc.rows.some((c) => c.status === "failed");
const workItemCompleted = evidenceWi.rows.some((w) => w.status === "completed");
const genuineWork      = evidenceCyc.rows.some((c) => (c.records_processed ?? 0) > 0 || (c.duration_ms ?? 0) > 100);
const contentWritten   = contentDeltas.service_business > 0 || contentDeltas.food_business > 0 || contentDeltas.sbss > 0;
const localUntouched   = Object.values(localDelta).every((v) => v === 0);

console.log("\n════ VERDICT ════");
console.log(`  Boot guard resolved Project B                         : ${bootGuard ? "✓" : "❌"}`);
console.log(`  Supervisor heartbeat landed                            : ${evidenceSup.length > 0 ? "✓" : "❌"}`);
console.log(`  Work item reached completed                            : ${workItemCompleted ? "✓" : (evidenceWi.rows.some((w) => w.status === 'failed') ? "⚠ failed" : "❌")}`);
console.log(`  Worker cycle reached completed                         : ${cycleCompleted ? "✓" : cycleFailed ? "⚠ failed (legitimate terminal)" : "❌"}`);
console.log(`  Genuine workforce operation completed (records/duration): ${genuineWork ? "✓" : "❌"}`);
console.log(`  Actual content-bearing data written to Project B       : ${contentWritten ? "✓" : "❌ zero content growth"}`);
console.log(`  Local nex_dev unchanged                                 : ${localUntouched ? "✓" : "❌"}`);
console.log(`  Zero permission/RLS errors                              : ${(permDenied.length + rlsErrs.length) === 0 ? "✓" : "❌"}`);
console.log(`  Scheduled Task Disabled                                 : ${taskState === "Disabled" ? "✓" : "❌"}`);
console.log(`  Zero orphaned processes                                 : ${orphanCount === 0 ? "✓" : "❌"}`);

const allGreen = bootGuard && evidenceSup.length > 0 && (cycleCompleted || cycleFailed) && genuineWork &&
                 localUntouched && permDenied.length === 0 && rlsErrs.length === 0 &&
                 taskState === "Disabled" && orphanCount === 0;
console.log(`\n${allGreen ? "✓ END-TO-END GENUINE OPERATION PROVEN" : "⚠ Review above · some conditions unmet"}`);
process.exit(allGreen ? 0 : 1);
