// NEX Workforce V2 · Supervisor · Consecutive-failure tracker
// ─────────────────────────────────────────────────────────────────────────────
// Per C8 § 14: bounded self-error threshold · 3 consecutive supervisor-loop
// failures → CRITICAL exit. Do not fabricate HEALTHY. Do not retry forever.

export const SupervisorState = Object.freeze({
  STARTING:  "STARTING",
  RUNNING:   "RUNNING",
  DEGRADED:  "DEGRADED",
  SHUTTING:  "SHUTTING",
});

export function createFailureTracker({ maxConsecutive = 3, degradeAt = 2 } = {}) {
  let consecutive = 0;
  let lastError = null;
  let lastErrorAt = null;
  let state = SupervisorState.STARTING;

  return {
    /** Called after a successful loop tick. */
    recordSuccess() {
      consecutive = 0;
      lastError = null;
      lastErrorAt = null;
      if (state === SupervisorState.STARTING) state = SupervisorState.RUNNING;
      else if (state === SupervisorState.DEGRADED) state = SupervisorState.RUNNING;
    },

    /** Called after a failed loop tick. Returns { state, shouldExit }. */
    recordFailure(err) {
      consecutive += 1;
      lastError = err?.message ?? String(err);
      lastErrorAt = new Date().toISOString();
      if (consecutive >= maxConsecutive) {
        state = SupervisorState.SHUTTING;
        return { state, shouldExit: true, consecutive, maxConsecutive, lastError };
      }
      if (consecutive >= degradeAt) {
        state = SupervisorState.DEGRADED;
      }
      return { state, shouldExit: false, consecutive, maxConsecutive, lastError };
    },

    snapshot() {
      return { state, consecutive, lastError, lastErrorAt, maxConsecutive, degradeAt };
    },

    forceState(newState) {
      if (Object.values(SupervisorState).includes(newState)) state = newState;
    },
  };
}
