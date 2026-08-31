// scripts/nex-worker/phase1a-live-monitor.mjs
//
// NEX Phase 1a · controlled live-test monitor · Philip 2026-08-27.
//
// Runs as a background process for exactly 60 minutes. During that hour it
// takes a READ-ONLY snapshot every 10 min via phase1a-live-verify.mjs and
// appends the JSON line to data/nex-run-logs/phase1a-live-test.jsonl.
//
// At the 60-min mark it: (1) kills the running scheduler, (2) restarts it
// with the FULL pause list back in place (food + accommodation re-paused),
// (3) drops a marker file at data/nex-run-logs/phase1a-test-complete.marker
// so the parent session knows the test is over.
//
// Zero DB writes from this monitor. Only orchestration control.

import { spawn, spawnSync, exec } from "node:child_process";
import { appendFileSync, writeFileSync, mkdirSync } from "node:fs";

const LOG_DIR = "data/nex-run-logs";
const JSONL = `${LOG_DIR}/phase1a-live-test.jsonl`;
const MARKER = `${LOG_DIR}/phase1a-test-complete.marker`;

mkdirSync(LOG_DIR, { recursive: true });

const TEST_START = new Date();
const TEST_DURATION_MS = 60 * 60 * 1000;   // 60 min
const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000; // 10 min → snapshots at t+10,20,30,40,50 min

// Full pause list restored at end of test.
const FULL_PAUSE_LIST = [
  "food", "accommodation", "market", "transport",
  "restaurants", "cafes", "hotels", "guesthouses",
  "retail-bakery", "retail-books", "retail-convenience", "retail-electronics",
  "retail-fashion", "retail-furniture", "retail-hardware", "retail-motorcycle",
  "retail-phones", "retail-supermarket",
].join(",");

function log(msg) {
  const line = JSON.stringify({ at: new Date().toISOString(), monitor: msg });
  console.log(line);
  appendFileSync(JSONL, line + "\n");
}

async function takeSnapshot(seq) {
  return new Promise((resolve) => {
    const child = spawn("node", ["--env-file=.env.local", "scripts/nex-worker/phase1a-live-verify.mjs"], {
      env: process.env,
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.on("exit", () => {
      const line = out.trim();
      try {
        const snap = JSON.parse(line);
        snap.snapshot_seq = seq;
        snap.test_elapsed_min = Math.round((Date.now() - TEST_START.getTime()) / 60000);
        appendFileSync(JSONL, JSON.stringify(snap) + "\n");
        console.log(`snapshot ${seq} @ t+${snap.test_elapsed_min}min · food=+${snap.deltas_vs_baseline.food} accom=+${snap.deltas_vs_baseline.accom} merge_log=${snap.merge_log.total} strong_dup_food=${snap.duplicate_excess_source_ref.food}`);
      } catch (e) {
        log(`snapshot ${seq} parse failed: ${e.message} · raw=${line.slice(0, 200)}`);
      }
      resolve();
    });
  });
}

async function killScheduler() {
  return new Promise((resolve) => {
    const ps = spawn("powershell.exe", ["-Command",
      `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'nex-dev-scheduler' -or $_.CommandLine -match 'nex-acquisition/run-live-cycle' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ]);
    ps.on("exit", () => resolve());
  });
}

async function restartScheduler() {
  // Detached spawn so the scheduler outlives this monitor.
  const env = { ...process.env, NEX_DEV_WORKERS: "1", NEX_ORCHESTRATOR_PAUSED_CATEGORIES: FULL_PAUSE_LIST };
  const child = spawn("npm", ["run", "dev:workers"], {
    env, detached: true, stdio: "ignore", shell: true,
  });
  child.unref();
  return child.pid;
}

async function main() {
  log(`monitor started · test window 60 min · snapshot every 10 min · will auto-pause at ${new Date(TEST_START.getTime() + TEST_DURATION_MS).toISOString()}`);

  await takeSnapshot(0);   // t+0 snapshot

  let seq = 1;
  while (Date.now() < TEST_START.getTime() + TEST_DURATION_MS) {
    const nextTick = TEST_START.getTime() + seq * SNAPSHOT_INTERVAL_MS;
    const wait = Math.max(0, nextTick - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (Date.now() >= TEST_START.getTime() + TEST_DURATION_MS) break;
    await takeSnapshot(seq);
    seq += 1;
  }

  // Final snapshot right before pause.
  log("test window elapsed · taking final pre-pause snapshot");
  await takeSnapshot(seq);

  log("killing scheduler + restarting with full pause list (food+accom re-paused)");
  await killScheduler();
  const newPid = await restartScheduler();
  log(`scheduler restarted · pid=${newPid} · pause list applied`);

  writeFileSync(MARKER, JSON.stringify({
    completed_at: new Date().toISOString(),
    test_start: TEST_START.toISOString(),
    scheduler_pid: newPid,
    snapshots_taken: seq + 1,
    jsonl_path: JSONL,
  }, null, 2));
  log(`marker written: ${MARKER}`);
  log("monitor complete · food + accommodation walkers RE-PAUSED · parent session may now review evidence");
  process.exit(0);
}

main().catch((e) => {
  log(`monitor CRASHED: ${e.message}`);
  process.exit(1);
});
