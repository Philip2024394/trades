// NEX Workforce v2 · Observability · Health-state classifier
// ─────────────────────────────────────────────────────────────────────────────
// Given metrics (from ./metrics.mjs), returns a health state and evidence.
//
// Per C7 Section 6:
//   · Health states are OBSERVATIONS, never remediation triggers.
//   · Thresholds come from existing workforce contracts where possible.
//   · Deterministic · same input → same output.

export const HealthState = Object.freeze({
  HEALTHY:         "WORKFORCE_HEALTHY",
  IDLE:            "WORKFORCE_IDLE",
  PROGRESSING:     "WORKFORCE_PROGRESSING",
  STALLED:         "WORKFORCE_STALLED",
  DEGRADED:        "WORKFORCE_DEGRADED",
  FAILURE_SPIKE:   "WORKFORCE_FAILURE_SPIKE",
});

/**
 * @param {object} metrics - output of collectAllMetrics
 * @param {object} opts - thresholds
 * @returns {{ state: string, evidence: object[] }}
 */
export function classifyHealth(metrics, opts = {}) {
  const {
    failureSpikeThreshold = 5,     // ≥5 catastrophic failures in window
    degradedThreshold = 3,          // ≥3 dead_letter total → degraded
    heartbeatMaxSecs = 60,          // beyond 1 min = stale for HEALTHY
  } = opts;

  const evidence = [];
  const wf = metrics.workforce;
  const stuck = metrics.stuck_work;
  const failures = metrics.failures;
  const agents = metrics.agents;

  // 1. Failure spike overrides everything
  const catastrophic = failures.by_class?.catastrophic ?? 0;
  const transientExhausted = failures.by_class?.transient_exhausted ?? 0;
  const spikeTotal = catastrophic + transientExhausted;
  if (spikeTotal >= failureSpikeThreshold) {
    evidence.push({ signal: "failure_spike", catastrophic, transient_exhausted: transientExhausted, threshold: failureSpikeThreshold });
    return { state: HealthState.FAILURE_SPIKE, evidence };
  }

  // 2. Any stuck-work → STALLED
  if (stuck.length > 0) {
    evidence.push({ signal: "stuck_work", count: stuck.length, reasons: [...new Set(stuck.map(s => s.stuck_reason))] });
    return { state: HealthState.STALLED, evidence };
  }

  // 3. Degraded: dead_letter accumulation
  if (wf.dead_letter >= degradedThreshold) {
    evidence.push({ signal: "dead_letter_accumulation", count: wf.dead_letter, threshold: degradedThreshold });
    return { state: HealthState.DEGRADED, evidence };
  }

  // 4. Active + healthy heartbeat → PROGRESSING
  if (wf.leased > 0) {
    const healthyHeartbeats = agents.agents.filter(a => a.heartbeat_age_secs != null && a.heartbeat_age_secs <= heartbeatMaxSecs).length;
    if (healthyHeartbeats > 0) {
      evidence.push({ signal: "active_work_healthy_heartbeat", leased: wf.leased, healthy_agents: healthyHeartbeats });
      return { state: HealthState.PROGRESSING, evidence };
    }
    // Leased but no healthy heartbeat (heartbeat > threshold but not yet in stuck window)
    evidence.push({ signal: "active_work_no_recent_heartbeat", leased: wf.leased, agents_seen: agents.active_count });
    return { state: HealthState.STALLED, evidence };
  }

  // 5. Pending but no active → healthy waiting
  if (wf.pending > 0) {
    evidence.push({ signal: "pending_no_active", pending: wf.pending });
    return { state: HealthState.HEALTHY, evidence };
  }

  // 6. Nothing pending, nothing leased → IDLE
  evidence.push({ signal: "idle_no_active_no_pending", completed: wf.completed, active: wf.active });
  return { state: HealthState.IDLE, evidence };
}
