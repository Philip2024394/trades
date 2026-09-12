#!/usr/bin/env node
// scripts/nex-lab-harvest-watchdog.mjs
//
// Founder 2026-09-10 · B7 · Continuous-harvester liveness watchdog.
//
// Runs at Windows Task Scheduler cadence (every 2 min). Reads the daemon
// heartbeat at data/nex-lab/harvest-continuous.heartbeat. If the file is
// missing OR its updated_at is older than STALE_THRESHOLD_MS, the watchdog
// respawns nex-lab-harvest-continuous.mjs detached (same spawn pattern as
// src/lib/nex/agent-runtime/control-plane.ts:184-191).
//
// Never crashes · never lies · logs every decision to
// data/nex-lab/watchdog.log with an ISO timestamp.
//
// Idempotent: if a healthy daemon is already running, this script exits 0
// without doing anything. Safe to run 100×/hour.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, openSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const HEARTBEAT_PATH = join(LAB_DIR, "harvest-continuous.heartbeat");
const PID_PATH = join(LAB_DIR, "harvest-continuous.pid");
const LOG_PATH = join(LAB_DIR, "watchdog.log");
const DAEMON_SCRIPT = join(REPO_ROOT, "scripts", "nex-lab-harvest-continuous.mjs");
const DAEMON_LOG = join(LAB_DIR, "harvest-continuous.log");

// A healthy daemon writes heartbeat at HEARTBEAT_INTERVAL_MS = 60_000 (60s).
// We give 2× that budget before declaring stale.
const STALE_THRESHOLD_MS = 150_000;

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    appendFileSync(LOG_PATH, msg);
  } catch { /* silent */ }
}

function isPidAlive(pid) {
  if (typeof pid !== "number" || !Number.isFinite(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code !== "ESRCH"; }
}

function readHeartbeat() {
  try {
    if (!existsSync(HEARTBEAT_PATH)) return { present: false };
    const raw = readFileSync(HEARTBEAT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const t = Date.parse(parsed.updated_at);
    return {
      present: true,
      pid: Number(parsed.pid) || null,
      updated_at_ms: Number.isFinite(t) ? t : null,
      raw: parsed,
    };
  } catch (err) {
    return { present: false, error: String(err.message).slice(0, 160) };
  }
}

function spawnDaemon() {
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    const out = openSync(DAEMON_LOG, "a");
    const err = openSync(DAEMON_LOG, "a");
    const child = spawn(process.execPath, [DAEMON_SCRIPT], {
      detached: true,
      stdio: ["ignore", out, err],
      windowsHide: true,
      cwd: REPO_ROOT,
    });
    child.unref();
    if (!child.pid) return { ok: false, reason: "spawn_no_pid" };
    return { ok: true, pid: child.pid };
  } catch (e) {
    return { ok: false, reason: e.message.slice(0, 200) };
  }
}

function main() {
  const hb = readHeartbeat();
  const now = Date.now();

  if (!hb.present) {
    log(`watchdog · heartbeat_missing (${hb.error ?? "no_file"}) · spawning fresh daemon`);
    const res = spawnDaemon();
    if (res.ok) { log(`watchdog · spawned pid=${res.pid}`); writeFileSync(PID_PATH, String(res.pid)); process.exit(0); }
    log(`watchdog · SPAWN FAILED · ${res.reason}`);
    process.exit(2);
  }

  const ageMs = hb.updated_at_ms ? (now - hb.updated_at_ms) : Infinity;
  const pidAlive = isPidAlive(hb.pid);

  if (ageMs > STALE_THRESHOLD_MS || !pidAlive) {
    log(`watchdog · daemon_stale age_ms=${ageMs} pid=${hb.pid} pid_alive=${pidAlive} · respawning`);
    const res = spawnDaemon();
    if (res.ok) { log(`watchdog · respawned pid=${res.pid} (prev heartbeat pid=${hb.pid})`); writeFileSync(PID_PATH, String(res.pid)); process.exit(0); }
    log(`watchdog · RESPAWN FAILED · ${res.reason}`);
    process.exit(2);
  }

  // Healthy · silent success (log every 15 min or so via cadence · logged nothing here)
  // But we DO record it in the log to prove the watchdog is firing.
  log(`watchdog · daemon_healthy pid=${hb.pid} age_ms=${ageMs} consecutive_no_rows=${hb.raw?.consecutive_no_rows ?? "?"} uptime_sec=${hb.raw?.uptime_sec ?? "?"}`);
  process.exit(0);
}

main();
