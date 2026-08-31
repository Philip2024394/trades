// Conflict resolution · pick the best value from multiple sources.
//
// When two walkers publish contradictory facts (Source A: "opens
// 10:00", Source B: "opens 11:00"), we DO NOT randomly overwrite one
// with the other. We keep BOTH, mark the conflict, and pick the
// "best current value" using a weighted score:
//
//   score = tierWeight × freshnessWeight × corroborationWeight
//
// Values are re-ranked on every merge. The other candidates stay on
// the entity so future evidence can flip the winner without losing
// history.

import type { ProvenanceRef, SourceTier } from "./types";

const TIER_WEIGHT: Record<SourceTier, number> = { A: 1.0, B: 0.75, C: 0.5, D: 0.25 };

export type ConflictCandidate<T> = {
  value: T;
  provenance: ProvenanceRef;
  /** Count of independent sources reporting this same value. */
  corroboration: number;
  score: number;
};

export type ConflictResolution<T> = {
  /** The winning value chosen by the resolver. */
  winner: T;
  /** Winner's provenance ref. */
  winnerSource: ProvenanceRef;
  /** All candidates ranked · winner is index 0. */
  candidates: ConflictCandidate<T>[];
  /** True when at least one non-winning candidate has a value the
   *  winner disagrees with — the entity should surface "sources
   *  disagree" to the user for high-stakes fields. */
  hasConflict: boolean;
};

/** Compute the freshness weight for a source observation · newer
 *  observations weigh more. Half-life defaults to 30 days. */
function freshnessWeight(iso: string, now: Date, halfLifeMs: number = 30 * 24 * 60 * 60_000): number {
  const age = now.getTime() - new Date(iso).getTime();
  if (age <= 0) return 1;
  return Math.pow(0.5, age / halfLifeMs);
}

/** Resolve competing values for the same field. */
export function resolveConflict<T>(observations: Array<{ value: T; provenance: ProvenanceRef }>, now: Date = new Date()): ConflictResolution<T> | null {
  if (observations.length === 0) return null;

  // Group by value equality (JSON-normalised for objects).
  const groups = new Map<string, { value: T; provs: ProvenanceRef[] }>();
  for (const obs of observations) {
    const key = typeof obs.value === "object" ? JSON.stringify(obs.value) : String(obs.value);
    const g = groups.get(key) ?? { value: obs.value, provs: [] };
    g.provs.push(obs.provenance);
    groups.set(key, g);
  }

  const candidates: ConflictCandidate<T>[] = [];
  for (const g of groups.values()) {
    // Score by the strongest provenance in the group, weighted by corroboration.
    let bestProv = g.provs[0];
    let bestProvScore = 0;
    for (const p of g.provs) {
      const s = (TIER_WEIGHT[p.sourceTier] ?? 0.25) * freshnessWeight(p.lastCheckedAt, now);
      if (s > bestProvScore) { bestProvScore = s; bestProv = p; }
    }
    const corroboration = g.provs.length;
    // Corroboration bonus. 2 independent sources agreeing on a value
    // is a strong signal · beats a single higher-tier source on its
    // own. Empirical weight: 1→1.0, 2→1.6, 3+→2.0.
    const corrBoost = corroboration === 1 ? 1 : corroboration === 2 ? 1.6 : 2.0;
    candidates.push({
      value: g.value,
      provenance: bestProv,
      corroboration,
      score: Number((bestProvScore * corrBoost).toFixed(3)),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];
  const hasConflict = candidates.length > 1;

  return {
    winner: winner.value,
    winnerSource: winner.provenance,
    candidates,
    hasConflict,
  };
}
