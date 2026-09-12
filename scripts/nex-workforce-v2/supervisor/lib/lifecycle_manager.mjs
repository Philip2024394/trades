// NEX Workforce V2 · Supervisor · Process lifecycle manager
// ─────────────────────────────────────────────────────────────────────────────
// Provides lifecycle abstractions (spawn / observe / graceful-shutdown) for
// V2 processes. Per C8 § 18: implements abstractions but does NOT auto-start
// production workers in C8. Auto-start is deferred to a future explicit
// authorization gate.
//
// Guardrails:
//   · Never spawn a process whose script path smells like the legacy path
//   · Every child is registered so graceful shutdown can SIGTERM cleanly
//   · Do NOT force-kill on shutdown unless a future contract authorizes it

import { spawn } from "node:child_process";
import { V2ProcessRole } from "./process_registry.mjs";

const LEGACY_PATH_PATTERNS = [
  "nex-acquisition-workforce",
  "_category-walker",
  "run-production-launcher",
  "run-production-watchdog",
  "run-production-supervisor",
];

export function createLifecycleManager({ logger, autoStart = false } = {}) {
  const children = new Map(); // pid → { role, script, child, startedAt }

  /**
   * Spawn a child process. In C8 default operation, `autoStart` is FALSE and
   * this method is exposed only for future authorized use (single-agent
   * controlled trials, orchestrator lifecycle wiring, etc.).
   *
   * Returns { spawned: true, pid, child } on success, or throws on refusal.
   */
  function spawnChild({ role, script, env = {}, args = [] }) {
    if (!Object.values(V2ProcessRole).includes(role)) {
      throw new Error(`lifecycle: unknown role: ${role}`);
    }
    if (LEGACY_PATH_PATTERNS.some(p => String(script).includes(p))) {
      throw new Error(`lifecycle: refusing to spawn legacy path: ${script}`);
    }
    if (!autoStart) {
      throw new Error(`lifecycle: autoStart=false · spawn refused (C8 § 18 · production must remain OFF)`);
    }

    const child = spawn(process.execPath, [script, ...args], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const startedAt = new Date().toISOString();
    children.set(child.pid, { role, script, child, startedAt });
    logger?.info?.("lifecycle.spawn", { role, pid: child.pid, script, startedAt });

    child.on("exit", (code, signal) => {
      logger?.info?.("lifecycle.exit", { role, pid: child.pid, code, signal });
      children.delete(child.pid);
    });

    return { spawned: true, pid: child.pid, child };
  }

  /**
   * Graceful shutdown of all tracked children · SIGTERM then wait.
   * Never SIGKILL in C8 (per § 17 · no force kill without explicit contract).
   */
  async function gracefulShutdownAll({ waitMs = 3000 } = {}) {
    const list = Array.from(children.values());
    for (const { role, pid, child } of list.map(v => ({ role: v.role, pid: v.child.pid, child: v.child }))) {
      try { child.kill("SIGTERM"); } catch {}
      logger?.info?.("lifecycle.shutdown.sigterm", { role, pid });
    }
    // Wait bounded for graceful exit
    const start = Date.now();
    while (children.size > 0 && Date.now() - start < waitMs) {
      await new Promise(r => setTimeout(r, 100));
    }
    // Report survivors · do NOT SIGKILL
    if (children.size > 0) {
      for (const [pid, entry] of children) {
        logger?.warn?.("lifecycle.shutdown.survivor", { role: entry.role, pid });
      }
    }
    return { shutdownAt: new Date().toISOString(), survivors: children.size, terminated: list.length - children.size };
  }

  return {
    spawnChild,
    gracefulShutdownAll,
    listChildren: () => Array.from(children.entries()).map(([pid, e]) => ({ pid, role: e.role, script: e.script, startedAt: e.startedAt })),
    childCount: () => children.size,
    /** Test helper: allow re-configuring autoStart at runtime */
    setAutoStart: (v) => { autoStart = !!v; },
  };
}
