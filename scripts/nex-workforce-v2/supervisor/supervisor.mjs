#!/usr/bin/env node
// NEX Workforce V2 · Supervisor · Main entry
// ─────────────────────────────────────────────────────────────────────────────
// Per C8: NEX-owned V2 supervisor · process-level health · never a lease
// manager · never an agent babysitter · never a retry engine.
//
// Loop:
//   1. Acquire OS singleton (exit cleanly if second instance)
//   2. Install SIGINT / SIGTERM shutdown handlers
//   3. Every tick (default 30s):
//      · run bounded health probe (via C7 lib · READ-ONLY)
//      · record success/failure in failure_tracker
//      · emit structured log line with SupervisorHealth + WorkforceHealth
//   4. On 3 consecutive failures → CRITICAL log + exit non-zero
//   5. On SIGTERM/SIGINT → graceful shutdown → release lock → exit 0
//
// C8 default: NO child processes spawned. lifecycle_manager exists for future
// authorized single-agent trials but autoStart=false in production.
//
// Configuration (all with defaults · no new required env vars per C8 § 19):
//   NEX_SUPERVISOR_TICK_MS                 (default 30_000)
//   NEX_SUPERVISOR_PROBE_TIMEOUT_MS        (default 5_000)
//   NEX_SUPERVISOR_MAX_CONSECUTIVE_FAILURES (default 3)
//   NEX_SUPERVISOR_LOCK_PATH               (default data/nex-workforce-v2/supervisor.lock)
//   NEX_SUPERVISOR_WINDOW_HOURS            (default 1)
//   NEX_WORKFORCE_URL                      (optional · if absent supervisor runs in observability-only mode via mgmt API)

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createLogger } from "./lib/supervisor_logger.mjs";
import { acquireSingleton, releaseSingleton } from "./lib/singleton.mjs";
import { createFailureTracker, SupervisorState } from "./lib/failure_tracker.mjs";
import { createProcessRegistry } from "./lib/process_registry.mjs";
import { runHealthProbe } from "./lib/health_probe.mjs";
// C10 · Wire C9 lifecycle contract into the C8 supervisor. child_lifecycle is
// the AUTHORITATIVE process lifecycle manager. Do not re-introduce
// lifecycle_manager here; it remains only as a compatibility surface for the
// standalone C8 regression tests.
import { createChildLifecycle } from "./lib/child_lifecycle.mjs";
import { createSingletonRegistry } from "./lib/singleton_registry.mjs";
import { createRestartPolicy } from "./lib/restart_policy.mjs";
import { Role, StartupOrder, ShutdownOrder, MaxAgentCount } from "./lib/lifecycle_contract.mjs";
import { createShutdownHandler } from "./lib/shutdown_handler.mjs";

// Default entry-point paths for V2 child processes. Resolved absolute so
// child_lifecycle's LEGACY_PATH_PATTERNS guard sees an unambiguous path.
const __supervisorDir = dirname(fileURLToPath(import.meta.url));
const V2_ROOT = resolve(__supervisorDir, "..");
const DEFAULT_CHILD_SCRIPTS = Object.freeze({
  [Role.REAPER]:       resolve(V2_ROOT, "reaper.mjs"),
  [Role.ORCHESTRATOR]: resolve(V2_ROOT, "orchestrator.mjs"),
  [Role.AGENT]:        resolve(V2_ROOT, "agent.mjs"),
});

const CONFIG = Object.freeze({
  tickMs:          Number(process.env.NEX_SUPERVISOR_TICK_MS ?? 30_000),
  probeTimeoutMs:  Number(process.env.NEX_SUPERVISOR_PROBE_TIMEOUT_MS ?? 5_000),
  maxConsecutive:  Number(process.env.NEX_SUPERVISOR_MAX_CONSECUTIVE_FAILURES ?? 3),
  lockPath:        process.env.NEX_SUPERVISOR_LOCK_PATH ?? "data/nex-workforce-v2/supervisor.lock",
  lockBaseDir:     process.env.NEX_SUPERVISOR_LOCK_BASE_DIR ?? "data/nex-workforce-v2/locks",
  windowHours:     Number(process.env.NEX_SUPERVISOR_WINDOW_HOURS ?? 1),
  // C10 · autoStart must remain false in production. A future authorized
  // trial slice will set this to true explicitly via opts override.
  autoStart:       false,
});

/**
 * Build the query executor. Uses NEX_WORKFORCE_URL if set (pg pool), else
 * falls back to Supabase Management API using .env.tools.local. Both are
 * READ-ONLY paths (health_probe wraps them with C7's SELECT-only queries).
 */
export async function buildQueryExecutor() {
  if (process.env.NEX_WORKFORCE_URL) {
    const pg = (await import("pg")).default;
    const pool = new pg.Pool({ connectionString: process.env.NEX_WORKFORCE_URL, max: 2, query_timeout: 8000, statement_timeout: 8000 });
    return {
      query: async (sql) => (await pool.query(sql)).rows,
      close: async () => { await pool.end(); },
    };
  }
  // Fallback: Supabase Management API from .env.tools.local
  const envTools = readFileSync(".env.tools.local", "utf8");
  const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
  const REF = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)?.[1];
  if (!TOKEN || !REF) throw new Error("supervisor: neither NEX_WORKFORCE_URL nor .env.tools.local mgmt-api credentials available");
  return {
    query: async (sql) => {
      const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
        method: "POST",
        headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
      });
      const t = await r.text();
      if (r.status >= 400) throw new Error(`mgmt ${r.status}: ${t}`);
      return t ? JSON.parse(t) : [];
    },
    close: async () => {},
  };
}

/**
 * Create a supervisor instance (used both by main() and by tests).
 * @param {object} deps
 * @param {Function} deps.query - READ-ONLY SQL executor
 * @param {object} [deps.logger]
 * @param {object} [deps.opts] - config overrides
 */
export function createSupervisor({ query, logger, opts = {}, childScripts = DEFAULT_CHILD_SCRIPTS } = {}) {
  const config = { ...CONFIG, ...opts };
  const log = logger ?? createLogger({ component: "supervisor" });
  const tracker = createFailureTracker({ maxConsecutive: config.maxConsecutive });
  const registry = createProcessRegistry();

  // C10 · Construct the C9 child lifecycle contract stack. autoStart is
  // forced false unless the caller explicitly opts in (never true by default
  // in production). singleton_registry enforces per-role locks for REAPER +
  // ORCHESTRATOR. restart_policy enforces the C9 bounded restart contract.
  const singletonRegistry = createSingletonRegistry({ baseDir: config.lockBaseDir });
  const restartPolicy = createRestartPolicy();
  const lifecycle = createChildLifecycle({
    logger: log,
    singletonRegistry,
    restartPolicy,
    autoStart: config.autoStart === true,
    parentRole: Role.SUPERVISOR,
  });

  // Register the V2 child specs (REAPER + ORCHESTRATOR + AGENT). Registration
  // is inert under autoStart=false · specs describe the tree, no processes
  // are spawned. Registration proves the graph in tests without touching the
  // filesystem beyond the source directory.
  function registerV2ChildSpecs() {
    const specs = [
      { role: Role.REAPER,       identifier: "reaper-1",       script: childScripts[Role.REAPER] },
      { role: Role.ORCHESTRATOR, identifier: "orchestrator-1", script: childScripts[Role.ORCHESTRATOR] },
      { role: Role.AGENT,        identifier: "agent-1",        script: childScripts[Role.AGENT] },
    ];
    for (const spec of specs) {
      try { lifecycle.register(spec); }
      catch (e) { log.warn?.("supervisor.register_child.failed", { role: spec.role, identifier: spec.identifier, err: e.message }); }
    }
    return lifecycle.list();
  }
  registerV2ChildSpecs();

  let stopping = false;
  let lockInfo = null;
  let currentTimer = null;

  async function tick() {
    if (stopping) return { skipped: true };
    const t0 = Date.now();
    const probe = await runHealthProbe({ query, timeoutMs: config.probeTimeoutMs, windowHours: config.windowHours });
    const durationMs = Date.now() - t0;

    if (probe.ok) {
      tracker.recordSuccess();
      log.info("supervisor.tick", {
        state: tracker.snapshot().state,
        workforce_health: probe.workforce_health,
        agent_count: probe.agent_count,
        stuck_count: probe.stuck_count,
        alerts_critical: probe.alerts_critical,
        alerts_warning: probe.alerts_warning,
        duration_ms: durationMs,
      });
    } else {
      const outcome = tracker.recordFailure(new Error(probe.error));
      log.warn("supervisor.tick.probe_failed", {
        state: outcome.state,
        consecutive: outcome.consecutive,
        max_consecutive: outcome.maxConsecutive,
        error: probe.error,
        duration_ms: durationMs,
      });
      if (outcome.shouldExit) {
        log.critical("supervisor.exit.max_consecutive_failures", {
          consecutive: outcome.consecutive,
          max_consecutive: outcome.maxConsecutive,
          last_error: outcome.lastError,
        });
        return { exit: true, code: 2 };
      }
    }
    return { skipped: false };
  }

  async function shutdown(reason) {
    stopping = true;
    if (currentTimer) { clearTimeout(currentTimer); currentTimer = null; }
    tracker.forceState(SupervisorState.SHUTTING);
    log.info("supervisor.shutdown", { reason });
    // C10 · C9 child_lifecycle.shutdownAll iterates ShutdownOrder
    // (ORCHESTRATOR → AGENT → REAPER) and releases per-role singleton locks
    // at the end. Supervisor's own external lock is released separately.
    try { await lifecycle.shutdownAll({ waitMs: 2000 }); } catch (e) { log.warn("supervisor.shutdown.lifecycle_error", { err: e.message }); }
    releaseSingleton({ path: config.lockPath });
  }

  async function runLoop() {
    // First tick immediately, then schedule
    while (!stopping) {
      const outcome = await tick();
      if (outcome.exit) return { exit: true, code: outcome.code };
      if (stopping) break;
      // Bounded sleep · interruptible when stopping
      await new Promise((res) => {
        currentTimer = setTimeout(() => { currentTimer = null; res(); }, config.tickMs);
      });
    }
    return { exit: false };
  }

  return {
    config,
    tracker,
    registry,
    lifecycle,
    singletonRegistry,
    restartPolicy,
    // C10 · Expose C9 contract surfaces so tests + operators can verify
    // the graph without reaching into private state.
    contract: Object.freeze({ Role, StartupOrder, ShutdownOrder, MaxAgentCount }),
    childScripts: Object.freeze({ ...childScripts }),
    registerV2ChildSpecs,
    tick,
    runLoop,
    shutdown,
    setLock: (info) => { lockInfo = info; },
    getLock: () => lockInfo,
    isStopping: () => stopping,
  };
}

/**
 * Main entry · runs the supervisor process lifecycle.
 */
async function main() {
  const log = createLogger({ component: "supervisor" });
  log.info("supervisor.boot", { config: CONFIG, pid: process.pid });

  // Singleton acquisition first
  const lock = acquireSingleton({ path: CONFIG.lockPath });
  if (!lock.acquired) {
    log.info("supervisor.singleton.declined", { reason: lock.reason, existing_pid: lock.existingPid, existing_started_at: lock.existingStartedAt });
    // Clean exit code 0 · not an error · another supervisor is authoritative
    process.exit(0);
  }
  log.info("supervisor.singleton.acquired", { path: lock.path, pid: lock.pid, started_at: lock.startedAt });

  const executor = await buildQueryExecutor();
  const supervisor = createSupervisor({ query: executor.query, logger: log, opts: {} });
  supervisor.setLock(lock);

  const shutdownHandler = createShutdownHandler({
    logger: log,
    onShutdown: async (reason) => {
      await supervisor.shutdown(reason);
      try { await executor.close(); } catch {}
    },
  });
  shutdownHandler.install();

  const result = await supervisor.runLoop();
  if (result.exit) process.exit(result.code);
  process.exit(0);
}

// Windows-safe main-guard
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: "critical", component: "supervisor", msg: "supervisor.main.fatal", err: err.message, stack: err.stack }) + "\n");
    releaseSingleton({ path: CONFIG.lockPath });
    process.exit(1);
  });
}
