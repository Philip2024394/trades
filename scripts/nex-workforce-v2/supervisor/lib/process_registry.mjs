// NEX Workforce V2 · Supervisor · Process registry
// ─────────────────────────────────────────────────────────────────────────────
// Tracks the three V2 process roles the supervisor is authorized to recognise
// (per C8 § 7). Records only · does not start · does not restart.
// Legacy roles (nex-acquisition-workforce/*) are explicitly excluded.

export const V2ProcessRole = Object.freeze({
  AGENT:        "AGENT",
  ORCHESTRATOR: "ORCHESTRATOR",
  REAPER:       "REAPER",
});

export const ProcessHealth = Object.freeze({
  ALIVE:      "PROCESS_ALIVE",
  UNHEALTHY:  "PROCESS_UNHEALTHY",
  MISSING:    "PROCESS_MISSING",
  UNKNOWN:    "PROCESS_UNKNOWN",
});

/**
 * A record of a known V2 process. In C8, entries are created on observation
 * (from DB heartbeat / caller-provided) but the supervisor does not launch
 * them.
 */
export function createProcessRegistry() {
  const rows = new Map(); // key = `${role}:${identifier}` → row

  return {
    /** Register a process observation. */
    observe({ role, identifier, pid = null, host = null, lastSeen = null, meta = {} }) {
      if (!Object.values(V2ProcessRole).includes(role)) {
        throw new Error(`unknown v2 process role: ${role}`);
      }
      const key = `${role}:${identifier}`;
      rows.set(key, {
        role,
        identifier,
        pid,
        host,
        lastSeen: lastSeen ?? new Date().toISOString(),
        firstSeen: rows.get(key)?.firstSeen ?? new Date().toISOString(),
        health: ProcessHealth.UNKNOWN,
        meta,
      });
    },

    /** Mark a process observation with a health status. */
    setHealth(role, identifier, health, ctx = {}) {
      const key = `${role}:${identifier}`;
      const row = rows.get(key);
      if (!row) return;
      row.health = health;
      row.healthCtx = ctx;
      row.healthAt = new Date().toISOString();
    },

    /** Remove a process from the registry (e.g., agent exited cleanly). */
    forget(role, identifier) {
      rows.delete(`${role}:${identifier}`);
    },

    list() {
      return Array.from(rows.values());
    },

    byRole(role) {
      return this.list().filter(r => r.role === role);
    },

    clear() { rows.clear(); },

    // Legacy-role guard · called by supervisor code to sanity-check
    // any external input. Any of these strings appearing anywhere is a
    // signal the caller is trying to smuggle a legacy role in · fail-fast.
    isLegacyRole(candidate) {
      const s = String(candidate || "").toLowerCase();
      return s.includes("nex-acquisition-workforce")
          || s.includes("_category-walker")
          || s.includes("run-production-launcher")
          || s.includes("run-production-watchdog")
          || s.includes("run-production-supervisor");
    },
  };
}
