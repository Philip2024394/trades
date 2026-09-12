// NEX Workforce V2 · Supervisor · Bounded health probe
// ─────────────────────────────────────────────────────────────────────────────
// Wraps C7's observability layer with:
//   · per-probe timeout (never block indefinitely · C8 § 15)
//   · read-only guarantee (only C7 SELECT-only queries)
//   · deterministic result shape
//
// Returns a SupervisorHealth object combining WORKFORCE health (from C7's
// classifyHealth) with PROCESS-level health derived from observed processes.

import { collectAllMetrics } from "../../observability/lib/metrics.mjs";
import { classifyHealth } from "../../observability/lib/health.mjs";
import { evaluateAlerts } from "../../observability/lib/alerts.mjs";

/**
 * Run a bounded health probe.
 * @param {object} opts
 * @param {Function} opts.query - async SQL executor (READ-ONLY)
 * @param {number} [opts.timeoutMs=5000] - per-probe timeout
 * @param {number} [opts.windowHours=1] - C7 metric window
 */
export async function runHealthProbe({ query, timeoutMs = 5000, windowHours = 1 } = {}) {
  if (typeof query !== "function") throw new Error("health_probe: query executor required");

  const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error(`health_probe_timeout_${timeoutMs}ms`)), timeoutMs));

  try {
    const metrics = await Promise.race([
      collectAllMetrics(query, { windowHours }),
      timeoutPromise,
    ]);
    const workforce = classifyHealth(metrics);
    const alerts = evaluateAlerts(metrics);

    return {
      ok: true,
      at: new Date().toISOString(),
      workforce_health: workforce.state,
      workforce_evidence: workforce.evidence,
      workforce_counts: {
        pending: metrics.workforce.pending,
        leased: metrics.workforce.leased,
        soft_fail: metrics.workforce.soft_fail,
        completed: metrics.workforce.completed,
        dead_letter: metrics.workforce.dead_letter,
        total: metrics.workforce.total,
      },
      agent_count: metrics.agents.active_count,
      stuck_count: metrics.stuck_work.length,
      alerts_active: alerts.length,
      alerts_critical: alerts.filter(a => a.severity === "CRITICAL").length,
      alerts_warning: alerts.filter(a => a.severity === "WARNING").length,
    };
  } catch (err) {
    return {
      ok: false,
      at: new Date().toISOString(),
      error: err?.message ?? String(err),
      // Do NOT fabricate a HEALTHY state on failure · leave workforce_health null
      workforce_health: null,
    };
  }
}
