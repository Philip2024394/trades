// NEX Workforce v2 · Observability · Alert conditions
// ─────────────────────────────────────────────────────────────────────────────
// Alert CONDITIONS only · not delivery mechanisms. Per C7 Section 12:
//   "Do not implement autonomous alert remediation."
//   "If notification infrastructure is absent: report 'alert conditions
//    defined, delivery not yet implemented.'"
//
// Each rule returns { severity, condition, ... } objects; caller decides delivery.

export const AlertSeverity = Object.freeze({
  CRITICAL: "CRITICAL",
  WARNING:  "WARNING",
  INFO:     "INFO",
});

/**
 * Evaluate all alert conditions against a metrics snapshot.
 * Returns array of alert objects with severity, condition, and context.
 * @param {object} metrics - output of collectAllMetrics
 * @param {object} opts - thresholds
 */
export function evaluateAlerts(metrics, opts = {}) {
  const {
    heartbeatStaleSecs = 120,       // Alert A · heartbeat stale > 2 min
    leaseNearExpirySecs = 60,       // Alert B · < 60s remaining
    catastrophicSpikeThreshold = 3, // Alert D · ≥3 catastrophic per window
    dbTimeoutSpikeThreshold = 3,    // Alert E · ≥3 DB timeouts per window
    failureRateSpikeThreshold = 5,  // Alert F · ≥5 total failures per window
    unexpectedWorkGrowthThreshold = 1000, // Alert I · > 1000 pending is unexpected right now
  } = opts;

  const alerts = [];
  const now = new Date().toISOString();

  // Alert A · stale heartbeat
  for (const agent of metrics.agents.agents) {
    if (agent.heartbeat_age_secs != null && agent.heartbeat_age_secs > heartbeatStaleSecs) {
      alerts.push({
        id: `A-heartbeat-stale-${agent.agent_id}`,
        severity: AlertSeverity.WARNING,
        condition: "stale_heartbeat",
        agent_id: agent.agent_id,
        work_item_id: agent.current_work_item_id,
        heartbeat_age_secs: agent.heartbeat_age_secs,
        threshold_secs: heartbeatStaleSecs,
        first_seen: agent.last_beat_at,
        last_seen: now,
      });
    }
  }

  // Alert B · lease approaching expiry
  for (const agent of metrics.agents.agents) {
    if (agent.lease_remaining_secs != null && agent.lease_remaining_secs > 0 && agent.lease_remaining_secs < leaseNearExpirySecs) {
      alerts.push({
        id: `B-lease-near-expiry-${agent.current_work_item_id}`,
        severity: AlertSeverity.WARNING,
        condition: "lease_near_expiry",
        agent_id: agent.agent_id,
        work_item_id: agent.current_work_item_id,
        lease_deadline: agent.lease_deadline,
        lease_remaining_secs: agent.lease_remaining_secs,
        threshold_secs: leaseNearExpirySecs,
        last_seen: now,
      });
    }
  }

  // Alert C · expired lease
  for (const stuck of metrics.stuck_work) {
    if (stuck.stuck_reason === "lease_expired") {
      alerts.push({
        id: `C-lease-expired-${stuck.work_item_id}`,
        severity: AlertSeverity.CRITICAL,
        condition: "lease_expired",
        work_item_id: stuck.work_item_id,
        agent_id: stuck.agent_id,
        city: stuck.city_slug,
        category: stuck.category_slug,
        source: stuck.source_slug,
        lease_deadline: stuck.lease_deadline,
        last_seen: now,
      });
    }
  }

  // Alert D · catastrophic failure spike
  const catCount = metrics.failures.by_class?.catastrophic ?? 0;
  if (catCount >= catastrophicSpikeThreshold) {
    alerts.push({
      id: "D-catastrophic-spike",
      severity: AlertSeverity.CRITICAL,
      condition: "catastrophic_failure_spike",
      count: catCount,
      threshold: catastrophicSpikeThreshold,
      window_hours: metrics.window_hours,
      last_seen: now,
    });
  }

  // Alert E · DB timeout spike (from failure class · workforce uses TRANSIENT for DB timeout)
  const transientCount = metrics.failures.by_class?.transient ?? 0;
  if (transientCount >= dbTimeoutSpikeThreshold) {
    alerts.push({
      id: "E-transient-spike",
      severity: AlertSeverity.WARNING,
      condition: "transient_failure_spike",
      count: transientCount,
      threshold: dbTimeoutSpikeThreshold,
      window_hours: metrics.window_hours,
      last_seen: now,
    });
  }

  // Alert F · overall failure rate spike
  if (metrics.failures.total >= failureRateSpikeThreshold) {
    alerts.push({
      id: "F-failure-rate-spike",
      severity: AlertSeverity.WARNING,
      condition: "failure_rate_spike",
      total: metrics.failures.total,
      threshold: failureRateSpikeThreshold,
      window_hours: metrics.window_hours,
      by_class: metrics.failures.by_class,
      last_seen: now,
    });
  }

  // Alert G · no progress despite active work
  for (const stuck of metrics.stuck_work) {
    if (stuck.stuck_reason === "stale_heartbeat" || stuck.stuck_reason === "no_heartbeat_record") {
      alerts.push({
        id: `G-no-progress-${stuck.work_item_id}`,
        severity: AlertSeverity.CRITICAL,
        condition: "no_progress_despite_active_work",
        work_item_id: stuck.work_item_id,
        agent_id: stuck.agent_id,
        city: stuck.city_slug,
        category: stuck.category_slug,
        source: stuck.source_slug,
        elapsed_secs: stuck.elapsed_secs,
        heartbeat_age_secs: stuck.heartbeat_age_secs,
        last_error_class: stuck.last_error_class,
        last_seen: now,
      });
    }
  }

  // Alert H · unexpected worker/process absence (leased work but 0 agents)
  if (metrics.workforce.leased > 0 && metrics.agents.active_count === 0) {
    alerts.push({
      id: "H-worker-absent-despite-leased",
      severity: AlertSeverity.CRITICAL,
      condition: "no_agents_but_leased_work_exists",
      leased_count: metrics.workforce.leased,
      last_seen: now,
    });
  }

  // Alert I · unexpected work_item growth
  if (metrics.workforce.pending > unexpectedWorkGrowthThreshold) {
    alerts.push({
      id: "I-pending-growth",
      severity: AlertSeverity.WARNING,
      condition: "unexpected_pending_growth",
      pending_count: metrics.workforce.pending,
      threshold: unexpectedWorkGrowthThreshold,
      last_seen: now,
    });
  }

  // Alert J · unexpected multi-city/category activity (during controlled trials)
  // Currently expected combination: yogyakarta × restaurants × overpass.
  // Any active work_item outside that is worth flagging in the current phase.
  const unexpectedTuples = metrics.source_matrix
    .filter(m => (m.pending + m.leased) > 0)
    .filter(m => !(m.city_slug === "yogyakarta" && m.category_slug === "restaurants" && m.source_slug === "overpass"));
  if (unexpectedTuples.length > 0) {
    alerts.push({
      id: "J-unexpected-activity",
      severity: AlertSeverity.WARNING,
      condition: "unexpected_multi_city_or_category_activity",
      unexpected: unexpectedTuples.map(t => ({
        city: t.city_slug, category: t.category_slug, source: t.source_slug,
        pending: t.pending, leased: t.leased,
      })),
      note: "During current controlled phase only yogyakarta×restaurants×overpass is expected active",
      last_seen: now,
    });
  }

  return alerts;
}

/**
 * Return the shape of every alert this module can emit. Useful for
 * dashboards to document what's watched.
 */
export function alertCatalogue() {
  return [
    { id: "A", severity: "WARNING",  condition: "stale_heartbeat",                       description: "Agent heartbeat has not fired within threshold." },
    { id: "B", severity: "WARNING",  condition: "lease_near_expiry",                     description: "Active lease has <60s remaining." },
    { id: "C", severity: "CRITICAL", condition: "lease_expired",                         description: "Leased work_item's lease_deadline has passed." },
    { id: "D", severity: "CRITICAL", condition: "catastrophic_failure_spike",            description: "≥ threshold catastrophic failures in window." },
    { id: "E", severity: "WARNING",  condition: "transient_failure_spike",               description: "≥ threshold transient failures in window (possible DB flake)." },
    { id: "F", severity: "WARNING",  condition: "failure_rate_spike",                    description: "Total failures ≥ threshold in window." },
    { id: "G", severity: "CRITICAL", condition: "no_progress_despite_active_work",       description: "Leased item with stale/missing heartbeat." },
    { id: "H", severity: "CRITICAL", condition: "no_agents_but_leased_work_exists",      description: "Work is leased but no live agent heartbeat exists." },
    { id: "I", severity: "WARNING",  condition: "unexpected_pending_growth",             description: "Pending count > threshold (queue backing up)." },
    { id: "J", severity: "WARNING",  condition: "unexpected_multi_city_or_category_activity", description: "During controlled phase, work outside yogyakarta×restaurants×overpass observed." },
  ];
}
