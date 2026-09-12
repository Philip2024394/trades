// Phase 13 · First production observation cycle.
//
// Orchestrates a single controlled launch of the acquisition workforce
// against Supabase Project B via nex_app_runtime, with pre/post baselines
// on BOTH databases to prove:
//   · production writes land in Project B, and
//   · local nex_dev is not touched.
//
// Bounded observation: stops as soon as the meaningful chain is proven
// (supervisor heartbeat + at least one worker_cycle_run OR work_item
// row from this run appears in Project B), or at 4 minutes hard limit.
//
// Kills the entire launcher process tree via `taskkill /F /T /PID`
// after the observation completes.

import pg from "pg";
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..", "..");

const envTools = readFileSync(resolve(REPO, ".env.tools.local"), "utf8");
const RUNTIME_URL = envTools.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];
const LOCAL_URL   = "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const OBS_MAX_MS  = 4 * 60_000;              // 4 min hard cap
const POLL_MS     = 3_000;                   // 3s polling cadence
const START_MARK  = new Date();              // observation start time in JS wall clock
const LAUNCH_OUT  = resolve(REPO, "data", "nex-acquisition-workforce", `phase13-launcher-${Date.now()}.log`);

function ts() { return new Date().toISOString(); }
function redactUrl(u) { return u.replace(/:[^:@/]+@/, ":****@"); }

function log(...args) {
  console.log(`[${ts()}]`, ...args);
}

async function q(pool, sql, params) {
  const c = await pool.connect();
  try { return await c.query(sql, params); }
  finally { c.release(); }
}

// ── Sanity: confirm we're targeting Project B via nex_app_runtime ──
log("=== Phase 13 · First production observation cycle ===");
log(`Target: ${redactUrl(RUNTIME_URL)}`);
log(`Local:  ${redactUrl(LOCAL_URL)}`);
log(`Launcher log: ${LAUNCH_OUT}`);

mkdirSync(dirname(LAUNCH_OUT), { recursive: true });

// ── STEP 1 · BASELINE both databases ────────────────────────────────
const projectB = new pg.Pool({ connectionString: RUNTIME_URL, ssl: { rejectUnauthorized: false }, max: 2 });
const local    = new pg.Pool({ connectionString: LOCAL_URL, max: 1, connectionTimeoutMillis: 5000 });

log("\n─── STEP 1 · Baseline snapshots ───");
async function snapshot(pool, label) {
  const r = await q(pool, `
    SELECT
      (SELECT count(*)::int FROM nex.worker_heartbeat)                              AS heartbeats,
      (SELECT count(*)::int FROM nex.worker_cycle_run)                              AS cycle_runs,
      (SELECT count(*)::int FROM nex.work_item)                                     AS work_items,
      (SELECT count(*)::int FROM nex.worker_heartbeat WHERE worker_id = 'acquisition-supervisor') AS supervisor_hb,
      (SELECT max(last_heartbeat_at)::text FROM nex.worker_heartbeat WHERE worker_id = 'acquisition-supervisor') AS supervisor_last_hb,
      (SELECT max(started_at)::text FROM nex.worker_cycle_run)                      AS latest_cycle_started_at
  `);
  const row = r.rows[0];
  log(`  ${label}: heartbeats=${row.heartbeats} cycle_runs=${row.cycle_runs} work_items=${row.work_items} supervisor_hb=${row.supervisor_hb} latest_cycle=${row.latest_cycle_started_at ?? 'none'}`);
  return row;
}
const baselineB = await snapshot(projectB, "Project B");
const baselineL = await snapshot(local, "local nex_dev");

// ── STEP 2 · Launch the production launcher ─────────────────────────
log("\n─── STEP 2 · Launch run-production-launcher.mjs ───");
const launcherLog = createWriteStream(LAUNCH_OUT, { flags: "a" });
launcherLog.write(`\n\n===== phase13 launch @ ${ts()} =====\n`);

const launcher = spawn(process.execPath, [
  join(REPO, "scripts", "nex-acquisition-workforce", "run-production-launcher.mjs"),
], {
  cwd: REPO,
  stdio: ["ignore", "pipe", "pipe"],
  shell: false,
  windowsHide: true,
});
log(`  spawned launcher · PID=${launcher.pid}`);

// Capture output to file AND buffer first ~50 lines in memory so we can
// grep them in the report ("[launcher] NEX_POSTGRES_URL ok · ...").
const outLines = [];
const errLines = [];
launcher.stdout.on("data", (b) => {
  const s = b.toString();
  launcherLog.write(s);
  for (const line of s.split(/\r?\n/)) if (line.trim()) outLines.push(line);
});
launcher.stderr.on("data", (b) => {
  const s = b.toString();
  launcherLog.write("STDERR: " + s);
  for (const line of s.split(/\r?\n/)) if (line.trim()) errLines.push(line);
});
launcher.on("exit", (code, signal) => {
  log(`  launcher exited · code=${code} signal=${signal}`);
});

// ── STEP 3 · Poll Project B for meaningful writes ───────────────────
log("\n─── STEP 3 · Poll Project B for meaningful writes ───");
const deadline = Date.now() + OBS_MAX_MS;
let observed = null;

while (Date.now() < deadline && !observed) {
  await new Promise((r) => setTimeout(r, POLL_MS));

  const cur = await snapshot(projectB, "  poll");
  const newHeartbeats = cur.heartbeats  - baselineB.heartbeats;
  const newCycleRuns  = cur.cycle_runs  - baselineB.cycle_runs;
  const newWorkItems  = cur.work_items  - baselineB.work_items;
  const newSupHb      = cur.supervisor_hb > 0 && (
    !baselineB.supervisor_last_hb ||
    (cur.supervisor_last_hb && cur.supervisor_last_hb > baselineB.supervisor_last_hb)
  );

  log(`  · new: heartbeats=+${newHeartbeats} cycle_runs=+${newCycleRuns} work_items=+${newWorkItems} · supervisor_hb_advanced=${newSupHb}`);

  // Meaningful chain: supervisor heartbeat advanced AND at least one cycle_run OR work_item created since start.
  if (newSupHb && (newCycleRuns > 0 || newWorkItems > 0)) {
    observed = { cur, newHeartbeats, newCycleRuns, newWorkItems };
    log(`  ✓ meaningful chain observed · will stop after collecting evidence`);
  }

  // Guardrails: if launcher already exited (crash), stop early.
  if (launcher.exitCode !== null) {
    log(`  ⚠ launcher already exited · code=${launcher.exitCode} · stopping observation`);
    break;
  }
}

if (!observed && Date.now() >= deadline) {
  log(`  ⚠ observation deadline hit (${OBS_MAX_MS/1000}s) · stopping without full chain proof`);
}

// ── STEP 4 · Collect evidence rows BEFORE killing ───────────────────
log("\n─── STEP 4 · Collect evidence rows from Project B ───");
const evidence = {
  supervisorHeartbeats: [],
  cycleRuns:            [],
  workItems:            [],
};

try {
  const sup = await q(projectB, `
    SELECT worker_id, worker_type, last_status, last_heartbeat_at::text,
           worker_config::text AS worker_config
      FROM nex.worker_heartbeat
     WHERE worker_id = 'acquisition-supervisor'
       AND last_heartbeat_at > $1::timestamptz
     ORDER BY last_heartbeat_at DESC
     LIMIT 5`, [START_MARK.toISOString()]);
  evidence.supervisorHeartbeats = sup.rows;

  const cyc = await q(projectB, `
    SELECT id::text, worker_id::text, worker_type, worker_config,
           started_at::text, ended_at::text, status,
           records_processed, records_new
      FROM nex.worker_cycle_run
     WHERE started_at > $1::timestamptz
     ORDER BY started_at DESC
     LIMIT 10`, [START_MARK.toISOString()]);
  evidence.cycleRuns = cyc.rows;

  const wi = await q(projectB, `
    SELECT work_item_id::text, job_slug, city, status, attempt_count,
           created_at::text, updated_at::text
      FROM nex.work_item
     WHERE created_at > $1::timestamptz
     ORDER BY created_at DESC
     LIMIT 10`, [START_MARK.toISOString()]);
  evidence.workItems = wi.rows;

  log(`  supervisor_heartbeats: ${evidence.supervisorHeartbeats.length}`);
  log(`  worker_cycle_runs:     ${evidence.cycleRuns.length}`);
  log(`  work_items:            ${evidence.workItems.length}`);
} catch (e) {
  log(`  evidence query error: ${e.message}`);
}

// ── STEP 5 · Kill the launcher process tree ─────────────────────────
log("\n─── STEP 5 · Kill launcher process tree (taskkill /F /T /PID) ───");
if (launcher.exitCode === null && launcher.pid) {
  const kill = spawnSync("taskkill", ["/F", "/T", "/PID", String(launcher.pid)], { encoding: "utf8" });
  log(`  taskkill: ${(kill.stdout || "").trim() || (kill.stderr || "").trim()}`);
} else {
  log(`  launcher already exited · no kill needed`);
}
// Give the process tree a moment to fully exit.
await new Promise((r) => setTimeout(r, 3_000));

// ── STEP 6 · Verify no orphaned processes ───────────────────────────
log("\n─── STEP 6 · Verify no orphaned NEX worker processes ───");
const scan = spawnSync("powershell", ["-NoProfile", "-Command",
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '(run-production-launcher|run-production-watchdog|run-production-supervisor|_category-walker)' -and $_.CommandLine -notmatch 'phase\\d' } | ForEach-Object { $_.ProcessId.ToString() + ' ' + $_.CommandLine.Substring(0, [Math]::Min(160, $_.CommandLine.Length)) }"],
  { encoding: "utf8" });
const running = (scan.stdout || "").trim().split(/\r?\n/).filter(Boolean);
log(`  orphaned processes: ${running.length === 0 ? "none · clean" : running.join("; ")}`);

// ── STEP 7 · Verify local nex_dev untouched ─────────────────────────
log("\n─── STEP 7 · Verify local nex_dev unchanged since baseline ───");
const localAfter = await snapshot(local, "local nex_dev (after)");
const localDelta = {
  heartbeats: localAfter.heartbeats - baselineL.heartbeats,
  cycle_runs: localAfter.cycle_runs - baselineL.cycle_runs,
  work_items: localAfter.work_items - baselineL.work_items,
};
log(`  local delta: heartbeats=${localDelta.heartbeats} cycle_runs=${localDelta.cycle_runs} work_items=${localDelta.work_items}`);

// ── STEP 8 · Boot-guard output check ───────────────────────────────
log("\n─── STEP 8 · Boot-guard output verification ───");
const bootGuardLine = outLines.find((l) => l.includes("[launcher] NEX_POSTGRES_URL ok"));
if (bootGuardLine) {
  log(`  boot guard reported: ${bootGuardLine}`);
} else {
  log(`  ⚠ no "[launcher] NEX_POSTGRES_URL ok" line found in stdout · check ${LAUNCH_OUT}`);
}
const failClosed = outLines.concat(errLines).find((l) => /FAIL-CLOSED/.test(l));
if (failClosed) log(`  ⚠ FAIL-CLOSED line detected: ${failClosed}`);

const permDenied = errLines.filter((l) => /permission denied/i.test(l));
const rlsErrs    = errLines.filter((l) => /row-level security|row level security/i.test(l));
log(`  permission-denied lines in stderr: ${permDenied.length}`);
log(`  RLS-blocked lines in stderr:       ${rlsErrs.length}`);
if (permDenied.length) log(`    first: ${permDenied[0]}`);

// ── STEP 9 · Cleanup pools ─────────────────────────────────────────
await projectB.end();
await local.end();
launcherLog.end();

// ── FINAL REPORT ───────────────────────────────────────────────────
log("\n\n════ FINAL REPORT ════");

console.log("\nProject B (post-observation) evidence:");
if (evidence.supervisorHeartbeats.length) {
  console.log("  Supervisor heartbeats (this run):");
  for (const h of evidence.supervisorHeartbeats.slice(0, 3)) {
    console.log(`    · ${h.last_heartbeat_at} · worker_id=${h.worker_id} · status=${h.last_status}`);
  }
}
if (evidence.cycleRuns.length) {
  console.log(`  Worker cycle runs (this run · ${evidence.cycleRuns.length} total, showing 3):`);
  for (const c of evidence.cycleRuns.slice(0, 3)) {
    console.log(`    · id=${c.id.slice(0,8)}… worker_type=${c.worker_type} status=${c.status} started=${c.started_at} records_new=${c.records_new ?? '-'}`);
  }
}
if (evidence.workItems.length) {
  console.log(`  Work items (this run · ${evidence.workItems.length} total, showing 3):`);
  for (const w of evidence.workItems.slice(0, 3)) {
    console.log(`    · ${w.job_slug} · ${w.city} · status=${w.status} attempts=${w.attempt_count} created=${w.created_at}`);
  }
}

console.log("\nLocal nex_dev (proving untouched):");
console.log(`  heartbeats delta = ${localDelta.heartbeats} (expected 0)`);
console.log(`  cycle_runs delta = ${localDelta.cycle_runs} (expected 0)`);
console.log(`  work_items delta = ${localDelta.work_items} (expected 0)`);

const localUntouched = localDelta.heartbeats === 0 && localDelta.cycle_runs === 0 && localDelta.work_items === 0;
const productionWroteToB = evidence.supervisorHeartbeats.length > 0 &&
  (evidence.cycleRuns.length > 0 || evidence.workItems.length > 0);

console.log("\nVerdict:");
console.log(`  Project B received production writes:   ${productionWroteToB ? "✓ YES" : "❌ NO"}`);
console.log(`  Local nex_dev remained untouched:       ${localUntouched   ? "✓ YES" : "❌ NO — LOCAL WAS WRITTEN"}`);
console.log(`  Boot guard reported correct target:     ${bootGuardLine ? "✓ YES" : "⚠ NOT SEEN IN STDOUT"}`);
console.log(`  Permission-denied errors in stderr:     ${permDenied.length === 0 ? "✓ ZERO" : "❌ " + permDenied.length}`);
console.log(`  Orphaned NEX processes after kill:      ${running.length === 0 ? "✓ ZERO" : "❌ " + running.length}`);

if (productionWroteToB && localUntouched && permDenied.length === 0 && running.length === 0) {
  console.log("\n✓ Observation cycle chain proven end-to-end. HARD STOP.");
  process.exit(0);
} else {
  console.log("\n⚠ At least one condition unmet. Detailed evidence above. HARD STOP for review.");
  process.exit(1);
}
