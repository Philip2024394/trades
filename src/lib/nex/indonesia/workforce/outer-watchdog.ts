// NEX Walker · OUTER PROCESS WATCHDOG.
//
// Layer B (Philip 2026-08-30):
//   The supervisor itself is a process that can die. The watchdog is
//   a smaller, dumber process whose only job is to keep the
//   supervisor alive. It:
//     · spawns the supervisor as a child_process
//     · restarts on exit with exponential backoff
//     · detects "alive but no progress" via supervisor heartbeat file
//     · caps restart-per-hour to avoid crash loops
//     · logs every incident to data/indonesia/watchdog-incidents.jsonl
//
// This module is import-friendly (used by tests) AND runnable via
// scripts/walkers/run-outer-watchdog.mjs (which is what an OS
// service / Scheduled Task actually invokes).
//
// Design tenets:
//   · The watchdog process is single-purpose · no other work · no
//     complexity that could itself crash.
//   · Restart decisions are conservative · a supervisor that crashes
//     10 times in 5 minutes is a code bug we do not paper over ·
//     the watchdog SLEEPS instead of hot-looping.
//   · Progress detection is read-only · watchdog does not touch the
//     workforce state · it only reads supervisorHeartbeat.

import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";

export type WatchdogOptions = {
  /** Command to spawn (e.g. "node"). */
  command: string;
  /** Args (e.g. ["scripts/walkers/run-supervisor.mjs"]). */
  args: string[];
  /** cwd for the child. */
  cwd: string;
  /** How often to check heartbeat (ms). Default 15_000. */
  checkIntervalMs?: number;
  /** How stale is "no progress"? Default 120_000 (2 min). */
  progressStaleMs?: number;
  /** How stale is "supervisor process itself hung"? Default 60_000. */
  heartbeatStaleMs?: number;
  /** Base restart backoff (ms) · doubles per consecutive failure up
   *  to maxRestartBackoffMs. Default 2000. */
  restartBackoffMs?: number;
  /** Cap on restart backoff. Default 5 min. */
  maxRestartBackoffMs?: number;
  /** If the supervisor crashes more than this in restartWindowMs,
   *  the watchdog pauses for coolDownMs. Prevents crash loops. */
  restartBudget?: number;
  restartWindowMs?: number;
  coolDownMs?: number;
  /** Path to the workforce state file (for heartbeat inspection). */
  stateFile?: string;
  /** Path to the incident log. */
  incidentLog?: string;
  /** Abort signal · watchdog stops on abort. */
  signal?: AbortSignal;
  /** Injectable child spawner (tests). */
  __spawn?: typeof spawn;
  /** Injectable clock. */
  now?: () => Date;
};

export type WatchdogIncident = {
  at: string;
  kind: "spawn" | "exit" | "stale_heartbeat" | "no_progress" | "budget_exhausted" | "shutdown" | "state_corrupt";
  detail: string;
  restartCount: number;
};

export type WatchdogRunResult = {
  incidents: WatchdogIncident[];
  restarts: number;
  running: boolean;
};

const DEFAULT_STATE_FILE = "data/indonesia/workforce-state.json";
const DEFAULT_INCIDENT_LOG = "data/indonesia/watchdog-incidents.jsonl";

export async function runOuterWatchdog(opts: WatchdogOptions): Promise<WatchdogRunResult> {
  const now = opts.now ?? (() => new Date());
  const spawnFn = opts.__spawn ?? spawn;
  const checkIntervalMs = opts.checkIntervalMs ?? 15_000;
  const progressStaleMs = opts.progressStaleMs ?? 120_000;
  const heartbeatStaleMs = opts.heartbeatStaleMs ?? 60_000;
  const baseBackoff = opts.restartBackoffMs ?? 2_000;
  const maxBackoff = opts.maxRestartBackoffMs ?? 5 * 60_000;
  const restartBudget = opts.restartBudget ?? 10;
  const restartWindowMs = opts.restartWindowMs ?? 5 * 60_000;
  const coolDownMs = opts.coolDownMs ?? 5 * 60_000;
  const stateFile = opts.stateFile ?? path.resolve(opts.cwd, DEFAULT_STATE_FILE);
  const incidentLog = opts.incidentLog ?? path.resolve(opts.cwd, DEFAULT_INCIDENT_LOG);

  const incidents: WatchdogIncident[] = [];
  const record = (kind: WatchdogIncident["kind"], detail: string, restartCount: number) => {
    const inc: WatchdogIncident = { at: now().toISOString(), kind, detail, restartCount };
    incidents.push(inc);
    writeIncident(incidentLog, inc);
  };

  let child: ChildProcess | null = null;
  let restarts = 0;
  const restartTimestamps: number[] = [];

  const spawnChild = () => {
    record("spawn", `${opts.command} ${opts.args.join(" ")}`, restarts);
    child = spawnFn(opts.command, opts.args, {
      cwd: opts.cwd, stdio: "inherit", shell: true,
      env: { ...process.env, __WATCHDOG_SUPERVISED__: "1" },
    });
    child.on("exit", (code, signal) => {
      record("exit", `code=${code} signal=${signal}`, restarts);
      child = null;
    });
  };

  spawnChild();

  while (!opts.signal?.aborted) {
    await sleepAbortable(checkIntervalMs, opts.signal);
    if (opts.signal?.aborted) break;

    // 1. If child is dead → restart with backoff.
    if (!child) {
      // Budget check.
      const nowMs = now().getTime();
      const windowRestarts = restartTimestamps.filter((t) => nowMs - t < restartWindowMs);
      if (windowRestarts.length >= restartBudget) {
        record("budget_exhausted", `${windowRestarts.length} restarts in ${restartWindowMs}ms · cooling ${coolDownMs}ms`, restarts);
        await sleepAbortable(coolDownMs, opts.signal);
        restartTimestamps.length = 0;
        if (opts.signal?.aborted) break;
      }
      const backoff = Math.min(baseBackoff * Math.pow(2, Math.min(windowRestarts.length, 8)), maxBackoff);
      await sleepAbortable(backoff, opts.signal);
      if (opts.signal?.aborted) break;
      restarts++;
      restartTimestamps.push(now().getTime());
      spawnChild();
      continue;
    }

    // 2. Alive-but-no-progress detection · read supervisor heartbeat.
    const stale = readSupervisorStaleness(stateFile, now);
    if (stale === "corrupt") {
      record("state_corrupt", `unreadable state file: ${stateFile}`, restarts);
      killChild(child);
      child = null;
      continue;
    }
    if (stale === "missing_heartbeat") {
      // Supervisor started but hasn't ticked yet · give it time.
      continue;
    }
    if (typeof stale === "number") {
      if (stale > heartbeatStaleMs) {
        record("stale_heartbeat", `no heartbeat for ${stale}ms · killing child for restart`, restarts);
        killChild(child);
        child = null;
        continue;
      }
    }
    const progress = readProgressStaleness(stateFile, now);
    if (typeof progress === "number" && progress > progressStaleMs) {
      record("no_progress", `no successful tick for ${progress}ms · killing child for restart`, restarts);
      killChild(child);
      child = null;
      continue;
    }
  }

  // Graceful shutdown.
  record("shutdown", "watchdog aborted", restarts);
  if (child) killChild(child);
  return { incidents, restarts, running: child !== null };
}

function killChild(child: ChildProcess): void {
  try { child.kill(); }
  catch { /* ignore */ }
  // Give a moment for graceful shutdown.
  setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* */ } }, 3_000);
}

function readSupervisorStaleness(stateFile: string, now: () => Date): number | "missing_heartbeat" | "corrupt" {
  if (!existsSync(stateFile)) return "missing_heartbeat";
  try {
    const raw = readFileSync(stateFile, "utf8");
    const snap = JSON.parse(raw);
    const hb = snap.supervisorHeartbeat;
    if (!hb || !hb.lastTickAt) return "missing_heartbeat";
    return now().getTime() - new Date(hb.lastTickAt).getTime();
  } catch { return "corrupt"; }
}

function readProgressStaleness(stateFile: string, now: () => Date): number | null {
  if (!existsSync(stateFile)) return null;
  try {
    const raw = readFileSync(stateFile, "utf8");
    const snap = JSON.parse(raw);
    const hb = snap.supervisorHeartbeat;
    if (!hb?.lastSuccessfulTickAt) return null;
    return now().getTime() - new Date(hb.lastSuccessfulTickAt).getTime();
  } catch { return null; }
}

function writeIncident(logPath: string, inc: WatchdogIncident): void {
  try {
    mkdirSync(path.dirname(logPath), { recursive: true });
    appendFileSync(logPath, JSON.stringify(inc) + "\n");
  } catch { /* ignore */ }
}

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}
