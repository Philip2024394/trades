// src/lib/nex/master-ai/failure-trajectory.ts
//
// NEX Master AI · Failure Trajectory Clustering (F-Wave §6)
// Philip 2026-09-07 · AUTHORIZE
//
// Master AI must not treat failures as simple errors. It must learn
// from them by tracking trajectories, clustering recurring failures,
// and detecting newly-emerging patterns.
//
// This module builds ON TOP OF failure-intelligence.ts · it does not
// replace it. It reads the aggregated failure patterns and produces
// trajectory records that describe how each pattern is evolving over
// time (increasing · decreasing · stable · emerging · resolved).

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { failureTrajectoriesPath } from "./paths";
import { listCurrentPatterns } from "./failure-intelligence";

export type TrajectoryDirection =
  | "EMERGING"        // first observed in this window · no prior history
  | "INCREASING"      // occurrence_count higher than in prior snapshot
  | "STABLE"          // occurrence_count roughly unchanged
  | "DECREASING"      // occurrence_count lower than in prior snapshot
  | "RESOLVED"        // previously observed · not in current snapshot
  | "UNKNOWN";        // insufficient history

export type FailureTrajectoryRecord = {
  trajectory_id: string;
  recorded_at_iso: string;
  pattern_key: string;
  representative_reason: string;
  affected_agents: readonly string[];
  current_occurrence_count: number;
  prior_occurrence_count: number | null;
  direction: TrajectoryDirection;
  severity_hint: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  cluster_id: string | null;                       // if this pattern belongs to a cluster of related failures
  rationale: string;                                // required ≥ 10 chars
  suggested_next_action: string;
};

export class InvalidTrajectoryError extends Error {
  constructor(reason: string) { super(`invalid_trajectory:${reason}`); }
}

/** Severity heuristic based on occurrence count + affected-agent breadth. */
function severityHint(occurrenceCount: number, affectedAgents: number): FailureTrajectoryRecord["severity_hint"] {
  if (occurrenceCount >= 10 || affectedAgents >= 3) return "CRITICAL";
  if (occurrenceCount >= 5 || affectedAgents >= 2) return "HIGH";
  if (occurrenceCount >= 2) return "MEDIUM";
  return "LOW";
}

/** Cluster related failure patterns by lightweight textual similarity
 *  of the representative_reason. Deterministic. Not perfect · groups
 *  strings sharing ≥ 3 tokens (length ≥ 4) into the same cluster. */
export function clusterPatterns(patterns: ReturnType<typeof listCurrentPatterns>): Map<string, string> {
  const clusterOf = new Map<string, string>();     // pattern_key → cluster_id
  const clusterTokens = new Map<string, Set<string>>();

  const tokenize = (s: string): Set<string> => {
    const toks = new Set<string>();
    for (const w of s.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 4) toks.add(w);
    }
    return toks;
  };

  for (const p of patterns) {
    const toks = tokenize(p.representative_reason);
    let matchedCluster: string | null = null;
    for (const [clusterId, existingToks] of clusterTokens) {
      let overlap = 0;
      for (const t of toks) if (existingToks.has(t)) overlap++;
      if (overlap >= 3) { matchedCluster = clusterId; break; }
    }
    const clusterId = matchedCluster ?? `cluster_${clusterOf.size + 1}`;
    if (!matchedCluster) clusterTokens.set(clusterId, toks);
    else for (const t of toks) clusterTokens.get(clusterId)!.add(t);
    clusterOf.set(p.pattern_key, clusterId);
  }
  return clusterOf;
}

/** Compose trajectory records for every current failure pattern.
 *  Compares against the most recent prior snapshot in the ledger.
 *  Returns the new trajectory records (also persisted). */
export function composeFailureTrajectories(): FailureTrajectoryRecord[] {
  const current = listCurrentPatterns();
  const clusters = clusterPatterns(current);

  // Read prior trajectory snapshot (latest per pattern_key)
  const prior = new Map<string, FailureTrajectoryRecord>();
  for (const t of readAllTrajectories()) prior.set(t.pattern_key, t);

  const out: FailureTrajectoryRecord[] = [];
  const currentKeys = new Set(current.map((p) => p.pattern_key));

  for (const p of current) {
    const priorRec = prior.get(p.pattern_key);
    let direction: TrajectoryDirection;
    let rationale: string;
    if (!priorRec) {
      direction = "EMERGING";
      rationale = `First observation of this pattern · no prior trajectory record`;
    } else if (p.occurrence_count > priorRec.current_occurrence_count * 1.2) {
      direction = "INCREASING";
      rationale = `Occurrence rose from ${priorRec.current_occurrence_count} to ${p.occurrence_count} (>20% increase)`;
    } else if (p.occurrence_count < priorRec.current_occurrence_count * 0.8) {
      direction = "DECREASING";
      rationale = `Occurrence fell from ${priorRec.current_occurrence_count} to ${p.occurrence_count} (>20% decrease)`;
    } else {
      direction = "STABLE";
      rationale = `Occurrence roughly unchanged (${priorRec.current_occurrence_count} → ${p.occurrence_count})`;
    }
    const rec: FailureTrajectoryRecord = {
      trajectory_id: randomUUID(),
      recorded_at_iso: new Date().toISOString(),
      pattern_key: p.pattern_key,
      representative_reason: p.representative_reason,
      affected_agents: p.affected_agents,
      current_occurrence_count: p.occurrence_count,
      prior_occurrence_count: priorRec ? priorRec.current_occurrence_count : null,
      direction,
      severity_hint: severityHint(p.occurrence_count, p.affected_agents.length),
      cluster_id: clusters.get(p.pattern_key) ?? null,
      rationale,
      suggested_next_action:
        direction === "EMERGING" ? "Register research query to understand root cause" :
        direction === "INCREASING" ? "Elevate priority · dedicate research or engineering attention" :
        direction === "DECREASING" ? "Continue monitoring · document what changed" :
        "Continue passive observation",
    };
    if (rec.rationale.length < 10) throw new InvalidTrajectoryError("rationale_length");
    appendJsonLine(failureTrajectoriesPath(), rec);
    out.push(rec);
  }

  // Detect RESOLVED patterns (in prior but not in current)
  for (const [key, priorRec] of prior) {
    if (currentKeys.has(key)) continue;
    if (priorRec.direction === "RESOLVED") continue;   // already marked
    const rec: FailureTrajectoryRecord = {
      trajectory_id: randomUUID(),
      recorded_at_iso: new Date().toISOString(),
      pattern_key: key,
      representative_reason: priorRec.representative_reason,
      affected_agents: priorRec.affected_agents,
      current_occurrence_count: 0,
      prior_occurrence_count: priorRec.current_occurrence_count,
      direction: "RESOLVED",
      severity_hint: "LOW",
      cluster_id: priorRec.cluster_id,
      rationale: `Pattern no longer observed · prior count was ${priorRec.current_occurrence_count}`,
      suggested_next_action: "Verify resolution is durable · promote learning to knowledge ledger",
    };
    appendJsonLine(failureTrajectoriesPath(), rec);
    out.push(rec);
  }

  return out;
}

export function readAllTrajectories(): FailureTrajectoryRecord[] {
  return readJsonlAll<FailureTrajectoryRecord>(failureTrajectoriesPath());
}

/** Return current-state summary keyed by direction. */
export function summariseTrajectories(): Record<TrajectoryDirection, number> {
  const out: Record<TrajectoryDirection, number> = { EMERGING: 0, INCREASING: 0, STABLE: 0, DECREASING: 0, RESOLVED: 0, UNKNOWN: 0 };
  const latestPerPattern = new Map<string, FailureTrajectoryRecord>();
  for (const t of readAllTrajectories()) latestPerPattern.set(t.pattern_key, t);
  for (const t of latestPerPattern.values()) out[t.direction]++;
  return out;
}

export function _resetFailureTrajectoryForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(failureTrajectoriesPath())) fs.unlinkSync(failureTrajectoriesPath()); } catch { /* ignore */ }
}
