// Reporter · turns the workforce snapshot into an HQ-view report.
//
// Consumed by:
//   · npm run workforce:status (CLI)
//   · Guardian's Workforce suite
//   · Future HQ dashboard (server-side rendering can call this)

import type { WorkforceRegistry } from "./registry";
import type { WorkforceReport, WorkerState } from "./types";
import { listAllWalkerSpecs } from "../walkers/taxonomy";

export function buildReport(registry: WorkforceRegistry, opts: { degradedThresholdMinutes?: number } = {}): WorkforceReport {
  const snap = registry.getSnapshot();
  const degradedThresholdMs = (opts.degradedThresholdMinutes ?? 10) * 60_000;
  const now = new Date();

  const byState: Record<WorkerState, number> = {
    STARTING: 0, RUNNING: 0, WAITING: 0, RETRYING: 0,
    BACKOFF: 0, STUCK: 0, DEAD: 0, DRAINING: 0, COMPLETED: 0,
  };
  for (const w of snap.workers) byState[w.state] = (byState[w.state] ?? 0) + 1;

  // Group by branch (from the taxonomy).
  const specs = listAllWalkerSpecs();
  const walkerToBranch = new Map(specs.map((s) => [s.id, s.branch]));
  const branchStats = new Map<string, { workers: number; healthy: number; degraded: number; dead: number }>();
  for (const w of snap.workers) {
    const branch = walkerToBranch.get(w.walkerId) ?? "other";
    const b = branchStats.get(branch) ?? { workers: 0, healthy: 0, degraded: 0, dead: 0 };
    b.workers++;
    const isDead = w.state === "DEAD" || w.state === "STUCK";
    const lastEvent = w.lastPublishAt ?? w.stateChangedAt;
    const stale = now.getTime() - new Date(lastEvent).getTime() > degradedThresholdMs;
    if (isDead) b.dead++;
    else if (stale || w.consecutiveFailures > 0) b.degraded++;
    else b.healthy++;
    branchStats.set(branch, b);
  }
  const byBranch = [...branchStats.entries()]
    .map(([branch, s]) => ({ branch, ...s }))
    .sort((a, b) => a.branch.localeCompare(b.branch));

  // Recent incidents — anything not-healthy sorted by most-recent
  // state change.
  const recentIncidents = snap.workers
    .filter((w) => w.state !== "RUNNING" && w.state !== "WAITING" && w.state !== "COMPLETED")
    .sort((a, b) => (b.stateChangedAt || "").localeCompare(a.stateChangedAt || ""))
    .slice(0, 10)
    .map((w) => ({
      workerId: w.id,
      state: w.state,
      since: w.stateChangedAt,
      reason: w.lastError,
    }));

  const openBreakers = snap.breakers.filter((b) => b.state !== "closed");

  return {
    takenAt: snap.takenAt,
    totals: {
      workers: snap.workers.length,
      byState,
      recordsToday: snap.metrics.recordsToday,
      lastPublishAt: snap.metrics.lastPublishAt,
    },
    byBranch,
    recentIncidents,
    openBreakers,
    deadLetterCount: snap.deadLetter.length,
  };
}
