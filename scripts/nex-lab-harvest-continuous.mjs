#!/usr/bin/env node
// scripts/nex-lab-harvest-continuous.mjs
//
// Founder 2026-09-10 · B1 · Non-stop harvester daemon · honest counters.
//
// Interprets child exit codes:
//   0 → rows_in            (real work · counted as productive cycle)
//   2 → endpoints_down     (all Overpass endpoints unreachable)
//   3 → empty_response     (fetched, but zero named+geocoded elements)
//   4 → persist_zero       (fetched OK but Postgres persist wrote nothing)
//   *  → crash/other
//
// If N consecutive cycles land NO rows, extend the pause between rotations
// so we do not spam broken sources. Heartbeat exposes per-outcome counters
// so the dashboard can no longer show green while Postgres stays flat.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "harvest-continuous.log");
const HEARTBEAT_PATH = join(LAB_DIR, "harvest-continuous.heartbeat");
const PID_PATH = join(LAB_DIR, "harvest-continuous.pid");

const NODE_EXE = process.execPath;
const HARVEST_SCRIPT = join(REPO_ROOT, "scripts", "nex-lab-harvest.mjs");
const WIKIDATA_SCRIPT = join(REPO_ROOT, "scripts", "nex-lab-harvest-wikidata.mjs");

const ROOMS = ["accommodation", "food", "transport", "business", "activities"];
const CITIES = ["yogyakarta", "bali", "jakarta", "bandung", "surabaya"];
const DELAY_BETWEEN_HARVESTS_MS = 3000; // polite between successful cycles
const WIKIDATA_EVERY_N_CYCLES = 5;     // one Wikidata cycle per 5 OSM cycles
const HEARTBEAT_INTERVAL_MS = 60_000;
const OUTAGE_BACKOFF_START_MS = 30_000;
const OUTAGE_BACKOFF_MAX_MS = 15 * 60_000;
const CHILD_MAX_WALLCLOCK_MS = 3 * 60_000; // kill child if it hangs past 3 min

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  // Only mirror to log file when stdout is a terminal · when stdout is
  // already redirected to LOG_PATH by the outer detached spawn, the
  // write above already reaches the file (fix for B3b double-log bug).
  if (process.stdout.isTTY) {
    try { if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true }); appendFileSync(LOG_PATH, msg); } catch { /* silent */ }
  }
}

function writeHeartbeat(state) {
  try {
    writeFileSync(HEARTBEAT_PATH, JSON.stringify({
      pid: process.pid,
      updated_at: new Date().toISOString(),
      ...state,
    }, null, 2));
  } catch { /* silent */ }
}

function writePid() { try { writeFileSync(PID_PATH, String(process.pid), "utf8"); } catch { /* ignore */ } }

function classifyExit(code) {
  if (code === 0) return "rows_in";
  if (code === 2) return "endpoints_down";
  if (code === 3) return "empty_response";
  if (code === 4) return "persist_zero";
  return "crash_or_other";
}

// Run one harvest child process (OSM or Wikidata).
// Returns { outcome, code, ms, stderr } — never throws.
function runHarvest(scriptPath, argv) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(NODE_EXE, [scriptPath, ...argv], {
      cwd: REPO_ROOT, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let settled = false;
    const settle = (result) => { if (!settled) { settled = true; resolve(result); } };
    child.stderr.on("data", (d) => { stderr += String(d); });
    child.stdout.on("data", () => { /* discard · already logged by child */ });
    const killTimer = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
      settle({ outcome: "hang_killed", code: -2, ms: Date.now() - t0, stderr: `killed_after_${CHILD_MAX_WALLCLOCK_MS}ms` });
    }, CHILD_MAX_WALLCLOCK_MS);
    child.on("exit", (code) => {
      clearTimeout(killTimer);
      settle({ outcome: classifyExit(code), code, ms: Date.now() - t0, stderr: stderr.slice(0, 300) });
    });
    child.on("error", (err) => {
      clearTimeout(killTimer);
      settle({ outcome: "spawn_error", code: -1, ms: Date.now() - t0, stderr: String(err).slice(0, 300) });
    });
  });
}

function* osmRotationGenerator() {
  let idx = 0;
  while (true) {
    const room = ROOMS[idx % ROOMS.length];
    const city = CITIES[Math.floor(idx / ROOMS.length) % CITIES.length];
    yield { room, city, cycle: idx };
    idx++;
  }
}
function* wikidataRotationGenerator() {
  let idx = 0;
  while (true) {
    const room = ROOMS[idx % ROOMS.length];
    yield { room, cycle: idx };
    idx++;
  }
}

async function main() {
  writePid();
  log(`daemon start · pid=${process.pid} · rotation=${ROOMS.length * CITIES.length} pairs · delay=${DELAY_BETWEEN_HARVESTS_MS}ms`);
  writeHeartbeat({ status: "starting", cycle: 0 });

  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.on(sig, () => {
      log(`caught ${sig} · flushing state and exiting`);
      writeHeartbeat({ status: "stopped", stopped_at: new Date().toISOString() });
      process.exit(0);
    });
  }

  const counts = {
    osm:      { rows_in: 0, endpoints_down: 0, empty_response: 0, persist_zero: 0, crash_or_other: 0, hang_killed: 0, spawn_error: 0 },
    wikidata: { rows_in: 0, endpoints_down: 0, empty_response: 0, persist_zero: 0, crash_or_other: 0, hang_killed: 0, spawn_error: 0 },
  };
  let consecutiveNoRows = 0;
  let outageBackoffMs = OUTAGE_BACKOFF_START_MS;
  let lastHeartbeat = 0;
  const osmGen = osmRotationGenerator();
  const wdGen = wikidataRotationGenerator();
  const started = Date.now();

  async function runAndAccount(source, badge, resultLabel, r) {
    counts[source][r.outcome] = (counts[source][r.outcome] ?? 0) + 1;
    if (r.outcome === "rows_in") {
      consecutiveNoRows = 0;
      outageBackoffMs = OUTAGE_BACKOFF_START_MS;
      log(`✓ ${source}·${resultLabel} rows_in · ${r.ms}ms · osm[rows=${counts.osm.rows_in} empty=${counts.osm.empty_response} down=${counts.osm.endpoints_down}] wd[rows=${counts.wikidata.rows_in} empty=${counts.wikidata.empty_response} down=${counts.wikidata.endpoints_down}]`);
    } else {
      consecutiveNoRows++;
      log(`${badge} ${source}·${resultLabel} exit=${r.code} ${r.ms}ms · consecutive_no_rows=${consecutiveNoRows} osm[rows=${counts.osm.rows_in}] wd[rows=${counts.wikidata.rows_in}]${r.stderr ? " · " + r.stderr.slice(0,150) : ""}`);
    }
  }

  while (true) {
    const osmNext = osmGen.next().value;
    const now = Date.now();

    if (now - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
      writeHeartbeat({
        status: consecutiveNoRows === 0 ? "running_productive" : `running_no_rows_for_${consecutiveNoRows}_cycles`,
        cycle: osmNext.cycle,
        current: osmNext,
        counts,
        consecutive_no_rows: consecutiveNoRows,
        outage_backoff_ms: outageBackoffMs,
        uptime_sec: Math.round((now - started) / 1000),
      });
      lastHeartbeat = now;
    }

    // ── OSM cycle ────────────────────────────────────────────────
    const rOsm = await runHarvest(HARVEST_SCRIPT, ["--room", osmNext.room, "--city", osmNext.city]);
    const osmBadge =
      rOsm.outcome === "endpoints_down" ? "▲ endpoints_down" :
      rOsm.outcome === "empty_response" ? "◦ empty" :
      rOsm.outcome === "persist_zero"   ? "◇ persist_zero" :
      rOsm.outcome === "hang_killed"    ? "☠ hang_killed" :
      rOsm.outcome === "spawn_error"    ? "☠ spawn_error" :
      rOsm.outcome === "rows_in"        ? "✓" :
                                          "✗ crash_or_other";
    await runAndAccount("osm", osmBadge, `${osmNext.room}/${osmNext.city}`, rOsm);
    if (rOsm.outcome === "endpoints_down") {
      log(`sleeping ${Math.round(outageBackoffMs/1000)}s before next attempt (osm endpoints_down backoff)`);
      await sleep(outageBackoffMs);
      outageBackoffMs = Math.min(OUTAGE_BACKOFF_MAX_MS, Math.round(outageBackoffMs * 1.5));
    } else {
      await sleep(DELAY_BETWEEN_HARVESTS_MS);
    }

    // ── Wikidata cycle every N-th OSM cycle ─────────────────────
    if (osmNext.cycle % WIKIDATA_EVERY_N_CYCLES === 0) {
      const wdNext = wdGen.next().value;
      const rWd = await runHarvest(WIKIDATA_SCRIPT, ["--room", wdNext.room]);
      const wdBadge =
        rWd.outcome === "endpoints_down" ? "▲ wd_endpoints_down" :
        rWd.outcome === "empty_response" ? "◦ wd_empty" :
        rWd.outcome === "persist_zero"   ? "◇ wd_persist_zero" :
        rWd.outcome === "hang_killed"    ? "☠ wd_hang_killed" :
        rWd.outcome === "spawn_error"    ? "☠ wd_spawn_error" :
        rWd.outcome === "rows_in"        ? "✓" :
                                            "✗ wd_crash_or_other";
      await runAndAccount("wikidata", wdBadge, wdNext.room, rWd);
      await sleep(DELAY_BETWEEN_HARVESTS_MS);
    }
  }
}

main().catch((err) => {
  log("fatal daemon crash: " + String(err).slice(0, 300));
  writeHeartbeat({ status: "crashed", crashed_at: new Date().toISOString(), error: String(err).slice(0, 300) });
  process.exit(1);
});
