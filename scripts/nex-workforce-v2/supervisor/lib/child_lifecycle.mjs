// NEX Workforce V2 · Supervisor · Typed child lifecycle manager
// ─────────────────────────────────────────────────────────────────────────────
// Extends lifecycle_manager with the C9 § 17 state machine, exit classification,
// bounded restart policy, and role-aware singleton coordination.
//
// Design invariants (C9 § 27 · smallest safe · never overbuilt):
//   · autoStart=false by default (no children spawn in test-only / dev mode)
//   · only SUPERVISOR may spawn children (verified via isSpawnAllowed)
//   · legacy paths REFUSED even if autoStart=true
//   · agent replacement does NOT reclaim lease · reaper stays authoritative
//   · orchestrator restart cannot manually enqueue · uses existing enqueue path
//   · reaper restart cannot damage healthy leases · SKIP LOCKED remains authoritative
//   · bounded restart policy · no infinite loop · fail loud on ceiling

import { spawn } from "node:child_process";
import { Role, ChildState, StartupOrder, ShutdownOrder, MaxAgentCount, isSpawnAllowed } from "./lifecycle_contract.mjs";
import { classifyExit } from "./exit_classifier.mjs";
import { createRestartPolicy } from "./restart_policy.mjs";

const LEGACY_PATH_PATTERNS = [
  "nex-acquisition-workforce",
  "_category-walker",
  "run-production-launcher",
  "run-production-watchdog",
  "run-production-supervisor",
];

/**
 * @param {object} deps
 * @param {object} [deps.logger]
 * @param {object} [deps.singletonRegistry] - singleton_registry for SUPERVISOR/REAPER/ORCHESTRATOR
 * @param {object} [deps.restartPolicy] - restart_policy instance
 * @param {boolean} [deps.autoStart=false] - if false, start() throws (C8 § 18 · C9 default)
 * @param {string} [deps.parentRole=Role.SUPERVISOR] - who's spawning (for isSpawnAllowed check)
 * @param {Function} [deps.now] - clock injection for deterministic tests
 * @param {Function} [deps.spawnFn] - spawn injection · defaults to node:child_process spawn · tests can inject stub
 */
export function createChildLifecycle({
  logger,
  singletonRegistry,
  restartPolicy = createRestartPolicy(),
  autoStart = false,
  parentRole = Role.SUPERVISOR,
  now = () => Date.now(),
  spawnFn = spawn,
} = {}) {
  // Map: `${role}:${identifier}` → registered spec + runtime state
  const children = new Map();

  function key(role, identifier) { return `${role}:${identifier}`; }

  /** Register a child spec (does NOT start · deterministic pre-registration). */
  function register({ role, identifier, script, env = {}, args = [] }) {
    if (!Object.values(Role).includes(role)) {
      throw new Error(`child_lifecycle: unknown role ${role}`);
    }
    if (role === Role.SUPERVISOR) {
      throw new Error(`child_lifecycle: SUPERVISOR is the parent · cannot be a managed child`);
    }
    if (!isSpawnAllowed(parentRole, role)) {
      throw new Error(`child_lifecycle: parent ${parentRole} may not spawn ${role} (C9 § 18)`);
    }
    if (LEGACY_PATH_PATTERNS.some((p) => String(script).includes(p))) {
      throw new Error(`child_lifecycle: refusing to register legacy path: ${script}`);
    }
    // C9 § 25 · agent count hard limit
    if (role === Role.AGENT) {
      const agentCount = list().filter((c) => c.role === Role.AGENT && c.state !== ChildState.EXITED).length;
      if (agentCount >= MaxAgentCount) {
        throw new Error(`child_lifecycle: AGENT count ceiling ${MaxAgentCount} reached (C9 § 25)`);
      }
    }
    const k = key(role, identifier);
    if (children.has(k)) {
      throw new Error(`child_lifecycle: (${role}:${identifier}) already registered`);
    }
    children.set(k, {
      role, identifier, script, env, args,
      state: ChildState.STARTING,
      pid: null,
      startedAt: null,
      lastExit: null,
      restartCount: 0,
      handle: null,
    });
    logger?.info?.("lifecycle.register", { role, identifier, script });
  }

  /** Start a registered child (subject to autoStart + singleton). */
  async function start(role, identifier) {
    if (!autoStart) {
      throw new Error(`child_lifecycle: autoStart=false · start refused (C9 default · no production activation)`);
    }
    const k = key(role, identifier);
    const child = children.get(k);
    if (!child) throw new Error(`child_lifecycle: (${role}:${identifier}) not registered`);
    if (child.handle && child.state === ChildState.RUNNING) {
      return { started: false, reason: "already_running", pid: child.pid };
    }
    // Singleton acquisition for singleton roles
    if (singletonRegistry && [Role.REAPER, Role.ORCHESTRATOR].includes(role)) {
      const s = singletonRegistry.acquire(role);
      if (!s.acquired) {
        return { started: false, reason: s.reason, existingPid: s.existingPid };
      }
    }
    child.state = ChildState.STARTING;
    child.startedAt = new Date().toISOString();
    const handle = spawnFn(process.execPath, [child.script, ...child.args], {
      env: { ...process.env, ...child.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.handle = handle;
    child.pid = handle.pid;
    child.state = ChildState.RUNNING;
    logger?.info?.("lifecycle.start", { role, identifier, pid: handle.pid, script: child.script });

    let stderrTail = "";
    handle.stderr?.on("data", (chunk) => {
      stderrTail = (stderrTail + String(chunk)).slice(-2000);
    });

    handle.on("exit", (code, signal) => {
      const exitAt = new Date().toISOString();
      const classification = classifyExit({
        code,
        signal,
        restartCount: child.restartCount,
        stderrTail,
      });
      child.lastExit = { code, signal, at: exitAt, class: classification.class, reason: classification.reason };
      child.state = ChildState.EXITED;
      child.handle = null;
      logger?.info?.("lifecycle.exit", { role, identifier, pid: child.pid, code, signal, class: classification.class, reason: classification.reason });
      restartPolicy.record(role, identifier, classification.class);
      const decision = restartPolicy.allow(role, identifier, classification.class);
      if (!decision.allowed) {
        // Release singleton if held
        if (singletonRegistry && [Role.REAPER, Role.ORCHESTRATOR].includes(role)) {
          singletonRegistry.release(role);
        }
        // Degrade if restart would have been eligible but ceiling was reached
        if (decision.reason.startsWith("restart_ceiling_reached")) {
          child.state = ChildState.DEGRADED;
          logger?.warn?.("lifecycle.degraded", { role, identifier, reason: decision.reason });
        } else if (decision.reason.startsWith("non_restartable_class")) {
          logger?.critical?.("lifecycle.non_restartable_exit", { role, identifier, class: classification.class, reason: decision.reason });
        }
        return;
      }
      // Restart eligible · release singleton before restart · re-acquire in start()
      if (singletonRegistry && [Role.REAPER, Role.ORCHESTRATOR].includes(role)) {
        singletonRegistry.release(role);
      }
      child.restartCount += 1;
      logger?.info?.("lifecycle.restart.scheduled", { role, identifier, delay_ms: decision.delayMs, restart_count: child.restartCount });
      setTimeout(() => { start(role, identifier).catch((err) => logger?.error?.("lifecycle.restart.failed", { role, identifier, err: err.message })); }, decision.delayMs);
    });
    return { started: true, pid: handle.pid };
  }

  /** Graceful stop via SIGTERM. Never SIGKILL in C9. */
  async function stop(role, identifier, { waitMs = 2000 } = {}) {
    const k = key(role, identifier);
    const child = children.get(k);
    if (!child || !child.handle) return { stopped: true, reason: "not_running" };
    child.state = ChildState.STOPPING;
    try { child.handle.kill("SIGTERM"); } catch (e) { logger?.warn?.("lifecycle.stop.sigterm_error", { role, identifier, err: e.message }); }
    const start = now();
    while (child.handle && now() - start < waitMs) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (child.handle) {
      logger?.warn?.("lifecycle.stop.survivor", { role, identifier, pid: child.pid });
      return { stopped: false, reason: "survivor_after_sigterm" };
    }
    return { stopped: true };
  }

  /** Graceful shutdown of all registered children in C9 § 6 order. */
  async function shutdownAll({ waitMs = 2000 } = {}) {
    for (const role of ShutdownOrder) {
      if (role === Role.SUPERVISOR) continue; // supervisor exits externally
      const roleChildren = list().filter((c) => c.role === role);
      for (const c of roleChildren) {
        await stop(c.role, c.identifier, { waitMs });
      }
    }
    // Release all singletons at end
    if (singletonRegistry) singletonRegistry.releaseAll();
  }

  function list() {
    return Array.from(children.values()).map((c) => ({
      role: c.role,
      identifier: c.identifier,
      script: c.script,
      state: c.state,
      pid: c.pid,
      startedAt: c.startedAt,
      lastExit: c.lastExit,
      restartCount: c.restartCount,
    }));
  }

  function get(role, identifier) {
    const c = children.get(key(role, identifier));
    if (!c) return null;
    return {
      role: c.role, identifier: c.identifier, state: c.state, pid: c.pid,
      startedAt: c.startedAt, lastExit: c.lastExit, restartCount: c.restartCount,
    };
  }

  function unregister(role, identifier) {
    const k = key(role, identifier);
    const c = children.get(k);
    if (c?.handle) {
      try { c.handle.kill("SIGTERM"); } catch {}
    }
    children.delete(k);
  }

  function setAutoStart(v) { autoStart = !!v; }
  function isAutoStart() { return autoStart; }

  return { register, start, stop, shutdownAll, list, get, unregister, setAutoStart, isAutoStart };
}
