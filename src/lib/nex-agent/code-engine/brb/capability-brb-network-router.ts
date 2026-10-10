// src/lib/nex-agent/code-engine/brb/capability-brb-network-router.ts
//
// NEX1 · Brain Recovery & Builder Network · Cortex integration (Section 17).
//
// Registers a network of specialists and exposes routing/aggregation APIs
// that reuse the existing Cortex vocabulary. Does NOT create a parallel
// routing system — it extends the existing agent-registry with a
// specialist-network catalog and broadcast helpers.
//
// Aggregation vocabulary matches the existing Cortex enum:
//   UNANIMOUS · MAJORITY · DISAGREEMENT · SINGLE_RESPONDER · NO_RESPONSE.
//
// Recommendations remain PROPOSAL_ONLY (Section 6).  This module never
// executes any specialist recommendation.

import type { Analysis, Hypothesis, Observation, Recommendation, NEXSpecialistBrain, Heartbeat } from "./capability-specialist-brain";
import { registerAgent, recordHeartbeat } from "../capability-agent-registry";

registerAgent({
  id: "brb_network_router",
  name: "Brain Recovery Network · Cortex Router extension",
  cognitive_layer: "infrastructure_orchestrator",
  description: "Registers BRB specialists · routes observation/analysis/recommendation broadcasts · aggregates with the existing Cortex consensus vocabulary. Recommend-only; never executes.",
});

// ── Registry (in-memory, seeded by each specialist file at import time) ─

const REGISTRY = new Map<string, NEXSpecialistBrain>();

export function registerSpecialist(brain: NEXSpecialistBrain): void {
  REGISTRY.set(brain.meta.specialist_id, brain);
  recordHeartbeat({
    agent_id: "brb_network_router",
    event_type: "register_specialist",
    event_data: { specialist_id: brain.meta.specialist_id, capabilities: brain.meta.capabilities.length },
  });
}

export function unregisterSpecialist(specialist_id: string): void {
  REGISTRY.delete(specialist_id);
}

export function listSpecialists(): readonly string[] {
  return [...REGISTRY.keys()];
}

export function getSpecialist(specialist_id: string): NEXSpecialistBrain | undefined {
  return REGISTRY.get(specialist_id);
}

// ── Routing (Section 17) ──────────────────────────────────────────────

export type ConsensusLabel =
  | "UNANIMOUS"
  | "MAJORITY"
  | "DISAGREEMENT"
  | "SINGLE_RESPONDER"
  | "NO_RESPONSE";

export interface BroadcastAnalysisResult {
  readonly requested_specialists: readonly string[];
  readonly responders: readonly string[];
  readonly analyses: readonly Analysis[];
  readonly non_null_count: number;
  readonly consensus: ConsensusLabel;
  readonly majority_kind: string | null;
  readonly disagreement_count: number;
}

export interface BroadcastRecommendationResult {
  readonly requested_specialists: readonly string[];
  readonly responders: readonly string[];
  readonly recommendations: readonly Recommendation[];
  readonly non_null_count: number;
  readonly consensus: ConsensusLabel;
  readonly majority_kind: string | null;
  readonly disagreement_count: number;
}

/**
 * Ask every specialist (or a subset) for its analysis of the same input.
 * Preserves disagreement · aggregates via consensus vocabulary.
 */
export function broadcastAnalysis(input: unknown, only?: readonly string[]): BroadcastAnalysisResult {
  const targets = only ?? [...REGISTRY.keys()];
  const analyses: Analysis[] = [];
  const responders: string[] = [];
  for (const sid of targets) {
    const brain = REGISTRY.get(sid);
    if (!brain) continue;
    try {
      const a = brain.analyse(input);
      analyses.push(a);
      responders.push(sid);
    } catch {
      // Silent per specialist · caller sees NO_RESPONSE via consensus
    }
  }
  const non_null = analyses.filter((a) => a.kind !== "no_op" && a.kind !== "no_response");
  const tally = new Map<string, number>();
  for (const a of non_null) tally.set(a.kind, (tally.get(a.kind) ?? 0) + 1);
  const consensus = deriveConsensus(targets.length, responders.length, non_null.length, tally);
  const majorityEntry = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    requested_specialists: targets,
    responders,
    analyses,
    non_null_count: non_null.length,
    consensus,
    majority_kind: majorityEntry?.[0] ?? null,
    disagreement_count: tally.size,
  };
}

export function broadcastRecommendation(input: unknown, only?: readonly string[]): BroadcastRecommendationResult {
  const targets = only ?? [...REGISTRY.keys()];
  const recs: Recommendation[] = [];
  const responders: string[] = [];
  for (const sid of targets) {
    const brain = REGISTRY.get(sid);
    if (!brain) continue;
    try {
      const r = brain.recommend(input);
      recs.push(r);
      responders.push(sid);
    } catch { /* silent · caller sees via consensus */ }
  }
  const non_null = recs.filter((r) => r.kind !== "no_op");
  const tally = new Map<string, number>();
  for (const r of non_null) tally.set(r.kind, (tally.get(r.kind) ?? 0) + 1);
  const consensus = deriveConsensus(targets.length, responders.length, non_null.length, tally);
  const majorityEntry = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    requested_specialists: targets,
    responders,
    recommendations: recs,
    non_null_count: non_null.length,
    consensus,
    majority_kind: majorityEntry?.[0] ?? null,
    disagreement_count: tally.size,
  };
}

export function broadcastObservation(observation: Observation, only?: readonly string[]): { observed_by: readonly string[] } {
  const targets = only ?? [...REGISTRY.keys()];
  const observed_by: string[] = [];
  for (const sid of targets) {
    const brain = REGISTRY.get(sid);
    if (!brain) continue;
    try {
      brain.observe(observation);
      observed_by.push(sid);
    } catch { /* silent */ }
  }
  return { observed_by };
}

export function collectHeartbeats(): readonly Heartbeat[] {
  const out: Heartbeat[] = [];
  for (const b of REGISTRY.values()) {
    try { out.push(b.heartbeat()); } catch { /* skip broken specialists */ }
  }
  return out;
}

function deriveConsensus(
  target_count: number,
  responder_count: number,
  non_null_count: number,
  tally: Map<string, number>,
): ConsensusLabel {
  if (responder_count === 0) return "NO_RESPONSE";
  if (non_null_count === 0) return "NO_RESPONSE";
  if (non_null_count === 1) return "SINGLE_RESPONDER";
  if (tally.size === 1) return "UNANIMOUS";
  const top = Math.max(...tally.values());
  if (top > non_null_count / 2) return "MAJORITY";
  return "DISAGREEMENT";
}

export const BRB_NETWORK_ROUTER_VERSION = "brb-network-router.v1";
