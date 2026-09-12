// NEX Workforce V2 · Supervisor · Bounded restart policy
// ─────────────────────────────────────────────────────────────────────────────
// Enforces C9 § 9 · max 3 restarts in 15 minutes per (role, identifier).
// Exponential backoff (1s → 2s → 4s → 8s). After threshold: DEGRADED · stop
// attempting.
//
// Time source is INJECTED so tests can run deterministically. Default: Date.now.

import { RestartPolicy as DEFAULT_POLICY, RestartableExitClasses, NonRestartableExitClasses } from "./lifecycle_contract.mjs";

/**
 * Create a restart policy state machine.
 * @param {object} opts
 * @param {number} [opts.maxRestarts]
 * @param {number} [opts.windowMs]
 * @param {number[]} [opts.backoffMs] - array of backoff durations per attempt
 * @param {Function} [opts.now] - clock injection · defaults to Date.now
 */
export function createRestartPolicy({
  maxRestarts = DEFAULT_POLICY.maxRestartsInWindow,
  windowMs    = DEFAULT_POLICY.windowMs,
  backoffMs   = DEFAULT_POLICY.backoffMs,
  now         = () => Date.now(),
} = {}) {
  const history = new Map(); // `${role}:${identifier}` → [{ at, exitClass }]

  function key(role, identifier) { return `${role}:${identifier}`; }

  function prune(k) {
    const list = history.get(k);
    if (!list) return;
    const cutoff = now() - windowMs;
    const filtered = list.filter((r) => r.at >= cutoff);
    if (filtered.length !== list.length) history.set(k, filtered);
  }

  function record(role, identifier, exitClass) {
    const k = key(role, identifier);
    const list = history.get(k) || [];
    list.push({ at: now(), exitClass });
    history.set(k, list);
    prune(k);
  }

  function restartsInWindow(role, identifier) {
    const k = key(role, identifier);
    prune(k);
    return (history.get(k) || []).length;
  }

  /**
   * Should the supervisor attempt a restart for this exit?
   * @returns {{ allowed, reason, delayMs, restartCount }}
   */
  function allow(role, identifier, exitClass) {
    // Non-restartable classes: NEVER auto-restart · fail loud
    if (NonRestartableExitClasses.has(exitClass)) {
      return {
        allowed: false,
        reason: `non_restartable_class:${exitClass}`,
        delayMs: 0,
        restartCount: restartsInWindow(role, identifier),
      };
    }
    // Clean shutdown / expected exit: no restart needed
    if (!RestartableExitClasses.has(exitClass)) {
      return {
        allowed: false,
        reason: `no_restart_needed:${exitClass}`,
        delayMs: 0,
        restartCount: restartsInWindow(role, identifier),
      };
    }
    // Ceiling check
    const count = restartsInWindow(role, identifier);
    if (count >= maxRestarts) {
      return {
        allowed: false,
        reason: `restart_ceiling_reached:${count}/${maxRestarts}_in_${windowMs}ms`,
        delayMs: 0,
        restartCount: count,
      };
    }
    // Backoff · index by prior-count (0 → first restart uses backoffMs[0])
    const idx = Math.min(count, backoffMs.length - 1);
    return {
      allowed: true,
      reason: `restart_allowed:${count + 1}/${maxRestarts}`,
      delayMs: backoffMs[idx],
      restartCount: count,
    };
  }

  function snapshot(role, identifier) {
    const k = key(role, identifier);
    prune(k);
    return {
      role,
      identifier,
      restartCount: (history.get(k) || []).length,
      maxRestarts,
      windowMs,
      history: [...(history.get(k) || [])],
    };
  }

  function reset(role, identifier) {
    history.delete(key(role, identifier));
  }

  function resetAll() { history.clear(); }

  return { allow, record, restartsInWindow, snapshot, reset, resetAll };
}
