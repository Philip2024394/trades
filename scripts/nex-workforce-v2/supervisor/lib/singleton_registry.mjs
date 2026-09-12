// NEX Workforce V2 · Supervisor · Multi-role singleton registry
// ─────────────────────────────────────────────────────────────────────────────
// Extends singleton.mjs semantics to support multiple named singleton roles
// (SUPERVISOR / REAPER / ORCHESTRATOR). Each role gets its own lock file path.
// Agents are intentionally NOT registered here (they're not singleton).

import { acquireSingleton, releaseSingleton } from "./singleton.mjs";
import { Role, SingletonRoles } from "./lifecycle_contract.mjs";
import { join, dirname } from "node:path";

const DEFAULT_BASE_DIR = "data/nex-workforce-v2/locks";

export function createSingletonRegistry({ baseDir = DEFAULT_BASE_DIR } = {}) {
  const held = new Map(); // role → lockInfo

  function pathFor(role) {
    if (!SingletonRoles.has(role)) {
      throw new Error(`singleton_registry: role ${role} is NOT a singleton role · agents are per-instance`);
    }
    return join(baseDir, `${role.toLowerCase()}.lock`);
  }

  function acquire(role) {
    if (!SingletonRoles.has(role)) {
      return { acquired: false, reason: "not_singleton_role", role };
    }
    if (held.has(role)) {
      return { acquired: true, reason: "already_held_by_this_process", role, lock: held.get(role) };
    }
    const r = acquireSingleton({ path: pathFor(role) });
    if (r.acquired) {
      held.set(role, r);
    }
    return { ...r, role };
  }

  function release(role) {
    if (!SingletonRoles.has(role)) return { released: false, reason: "not_singleton_role", role };
    if (!held.has(role)) return { released: false, reason: "not_held", role };
    const r = releaseSingleton({ path: pathFor(role) });
    held.delete(role);
    return { ...r, role };
  }

  function releaseAll() {
    const results = [];
    for (const role of Array.from(held.keys())) {
      results.push(release(role));
    }
    return results;
  }

  return {
    acquire,
    release,
    releaseAll,
    pathFor,
    isHeld: (role) => held.has(role),
    heldRoles: () => Array.from(held.keys()),
  };
}
