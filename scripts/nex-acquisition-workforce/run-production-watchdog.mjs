#!/usr/bin/env node
// NEX Acquisition Workforce · PRODUCTION WATCHDOG.
//
// Philip 2026-09-02 · Phase 1A · Layer B for the acquisition workforce.
// Same pattern as scripts/walkers/run-outer-watchdog.mjs but supervises the
// business-acquisition supervisor (not the taxonomy one). Fully independent.
//
// RESPONSIBILITIES:
//   · Spawn run-production-supervisor.mjs as child
//   · Restart on exit with exponential backoff (2s → 5min cap)
//   · Detect STALLED via deriveHealthState (per Philip's corrected model):
//       ONLY kill+restart on STALLED or FAILED · never on WAITING_FOR_* · never on PROCESSING
//   · Log every incident to data/nex-acquisition-workforce/watchdog-incidents.jsonl
//   · Never touch anything outside its own process/child

import pg from "pg";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { deriveHealthState, watchdogShouldRestart } from "./lib/health-state.mjs";
import { requirePostgresUrl, redactUrl } from "../../src/lib/nex/config/production-guard.mjs";

// ═══════════════════════════════════════════════════════════════════════
// LEGACY WORKFORCE QUARANTINE · 2026-09-04 · fail-closed at boot
// ═══════════════════════════════════════════════════════════════════════
// Legacy Phase 1B watchdog. Superseded by workforce v2 (Gate 5A #4 proven).
// Defense-in-depth: even if someone spawns this file directly (bypassing
// the launcher's quarantine), execution is refused before any pg.Pool()
// call or spawn(). No environment-variable bypass. Edit source to revive.
// See scripts/nex-acquisition-workforce/run-production-launcher.mjs for
// the primary quarantine block and full context.
// ═══════════════════════════════════════════════════════════════════════
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.stderr.write(" NEX LEGACY WORKFORCE · QUARANTINED · run-production-watchdog.mjs\n");
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.stderr.write(" Legacy watchdog quarantined (2026-09-04). No DB connection, no child\n");
process.stderr.write(" process. Exiting code 2. Superseded by scripts/nex-workforce-v2/.\n");
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.exit(2);

// ═══════════════════════════════════════════════════════════════════════
// ORIGINAL FILE LOGIC PRESERVED BELOW (UNREACHABLE)
// ═══════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = join(__dirname, "..", "..");

if (existsSync(join(repoRoot, ".env.local"))) {
  for (const line of readFileSync(join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// Fail closed on missing/malformed/dev-URL-in-prod · no silent fallback
// to the local dev DB. requirePostgresUrl throws with a stable .code the
// launcher/CI can grep for.
let NEX_POSTGRES_URL;
try {
  NEX_POSTGRES_URL = requirePostgresUrl();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(`[watchdog] FAIL-CLOSED · code=${err.code ?? "unknown"} · ${err.message}`);
  process.exit(2);
}

const SUPERVISOR_SCRIPT = join(repoRoot, "scripts", "nex-acquisition-workforce", "run-production-supervisor.mjs");
const INCIDENT_LOG      = join(repoRoot, "data", "nex-acquisition-workforce", "watchdog-incidents.jsonl");

const CHECK_INTERVAL_MS  = Number(process.env.NEX_ACQ_WD_CHECK_INTERVAL_MS  ?? 15_000);   // 15s
const BASE_BACKOFF_MS    = Number(process.env.NEX_ACQ_WD_BASE_BACKOFF_MS    ?? 2_000);
const MAX_BACKOFF_MS     = Number(process.env.NEX_ACQ_WD_MAX_BACKOFF_MS     ?? 5 * 60_000);
const RESTART_BUDGET     = Number(process.env.NEX_ACQ_WD_RESTART_BUDGET     ?? 10);
const RESTART_WINDOW_MS  = Number(process.env.NEX_ACQ_WD_RESTART_WINDOW_MS  ?? 5 * 60_000);
const COOL_DOWN_MS       = Number(process.env.NEX_ACQ_WD_COOLDOWN_MS        ?? 5 * 60_000);

function logIncident(kind, detail, restartCount) {
  try {
    mkdirSync(dirname(INCIDENT_LOG), { recursive: true });
    const inc = { at: new Date().toISOString(), kind, detail, restartCount };
    appendFileSync(INCIDENT_LOG, JSON.stringify(inc) + "\n");
  } catch { /* incident logging must never crash the watchdog */ }
}

let signalAborted = false;
process.once("SIGINT",  () => { signalAborted = true; });
process.once("SIGTERM", () => { signalAborted = true; });

(async () => {
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(` NEX ACQUISITION WORKFORCE · PRODUCTION WATCHDOG · pid ${process.pid}`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(` supervising: node ${SUPERVISOR_SCRIPT}`);
  console.log(` postgres:    ${redactUrl(NEX_POSTGRES_URL)}`);
  console.log(` incident log: ${INCIDENT_LOG}`);
  console.log(` check interval: ${CHECK_INTERVAL_MS}ms · restart budget: ${RESTART_BUDGET}/${RESTART_WINDOW_MS}ms\n`);

  const pool = new pg.Pool({ connectionString: NEX_POSTGRES_URL, max: 2 });

  let child = null;
  let restarts = 0;
  const restartTimestamps = [];

  const spawnChild = () => {
    logIncident("spawn", `${process.execPath} ${SUPERVISOR_SCRIPT}`, restarts);
    console.log(`[${new Date().toISOString()}] [watchdog] spawning supervisor`);
    child = spawn(process.execPath, [SUPERVISOR_SCRIPT], {
      cwd: repoRoot, stdio: "inherit",
      env: { ...process.env, __ACQ_WATCHDOG_SUPERVISED__: "1" },
    });
    child.on("exit", (code, signal) => {
      logIncident("exit", `code=${code} signal=${signal}`, restarts);
      console.log(`[${new Date().toISOString()}] [watchdog] supervisor exited · code=${code} signal=${signal}`);
      child = null;
    });
    child.on("error", (e) => {
      logIncident("spawn_error", e.message, restarts);
      child = null;
    });
  };

  const killChild = (reason) => {
    if (!child) return;
    logIncident("kill", reason, restarts);
    console.log(`[${new Date().toISOString()}] [watchdog] killing supervisor · reason=${reason}`);
    try { child.kill("SIGTERM"); }
    catch { /* ignore */ }
    setTimeout(() => { try { if (child && !child.killed) child.kill("SIGKILL"); } catch {} }, 5_000);
  };

  spawnChild();

  while (!signalAborted) {
    await sleep(CHECK_INTERVAL_MS);
    if (signalAborted) break;

    // 1. If child is dead → restart with backoff (with budget)
    if (!child) {
      const nowMs = Date.now();
      const windowRestarts = restartTimestamps.filter((t) => nowMs - t < RESTART_WINDOW_MS);
      if (windowRestarts.length >= RESTART_BUDGET) {
        logIncident("budget_exhausted", `${windowRestarts.length} restarts in ${RESTART_WINDOW_MS}ms · cooling ${COOL_DOWN_MS}ms`, restarts);
        console.log(`[${new Date().toISOString()}] [watchdog] restart budget exhausted · cooling down ${COOL_DOWN_MS}ms`);
        await sleep(COOL_DOWN_MS);
        restartTimestamps.length = 0;
        if (signalAborted) break;
      }
      const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, Math.min(windowRestarts.length, 8)), MAX_BACKOFF_MS);
      console.log(`[${new Date().toISOString()}] [watchdog] restarting supervisor after ${backoff}ms backoff (attempt #${restarts + 1})`);
      await sleep(backoff);
      if (signalAborted) break;
      restarts++;
      restartTimestamps.push(Date.now());
      spawnChild();
      continue;
    }

    // 2. Health-state check (only kill on STALLED / FAILED)
    let health;
    try {
      health = await deriveHealthState(pool, { childProcessPresent: !!child, watchdogInBackoff: false });
    } catch (e) {
      logIncident("health_check_error", e.message, restarts);
      continue;   // don't kill on health-check failure · postgres may be temporarily down
    }

    if (watchdogShouldRestart(health)) {
      logIncident("state_triggers_restart", {
        state: health.state, reasons: health.reasons,
        cycles_15m: health.cycles.completed_15m, running_now: health.cycles.running_now,
      }, restarts);
      console.log(`[${new Date().toISOString()}] [watchdog] STATE=${health.state} · killing supervisor for restart`);
      console.log(`  reasons: ${health.reasons.join(" · ")}`);
      killChild(`state_${health.state.toLowerCase()}`);
      child = null;
      continue;
    }

    // Otherwise: log observation on transitions from PRODUCTIVE to non-PRODUCTIVE, or ALIVE → still OK
    // (no periodic logging to avoid noisy output; state is queryable via health-check.mjs)
  }

  // Graceful shutdown
  logIncident("watchdog_shutdown", "signalAborted", restarts);
  if (child) killChild("watchdog_shutdown");
  await pool.end();
  console.log(`\n[watchdog] exited · restarts=${restarts}`);
  process.exit(0);
})();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
