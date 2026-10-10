// src/lib/nex-agent/code-engine/brb/capability-dimension-selector.ts
//
// NEX1 · Dimension Selector · Ledger B γ mechanism.
//
// PURPOSE
//   Given a labelled corpus (experiences with known outcomes) and the
//   full menu of candidate dimensions, rank each dimension by its
//   ability to predict outcome. Return the top-K.
//
// METRIC · deterministic · information-theoretic
//   For each dimension D:
//     · Group the corpus by outcome (success / failure / unknown)
//     · For each value of D observed in the corpus, count how it
//       distributes across outcomes
//     · Compute normalised discriminative score: the higher the
//       imbalance of a dimension's values across outcomes, the more
//       predictive it is.
//     · Uses conditional entropy of outcome given dimension value.
//
// DISCLOSURE (Ledger B)
//   · The scoring metric (conditional entropy) is Claude-authored.
//   · The MENU is Claude-authored (see capability-dimension-menu.ts).
//   · The SPECIFIC SELECTION on a given corpus is data-derived · which
//     dimensions score highest depends only on the labelled data.
//   · No dimension is boosted by the metric. All are ranked identically.

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { DIMENSION_MENU, type DimensionDefinition } from "./capability-dimension-menu";
import type { Experience } from "./capability-brain-similarities";

registerAgent({
  id: "dimension_selector",
  name: "Dimension Selector · γ candidate mechanism",
  cognitive_layer: "brain_recovery_specialist",
  description: "Ranks the dimension menu by outcome-predictive power on a labelled corpus. Returns top-K. Deterministic. Menu is Ledger B; selection is data-derived.",
});

export interface DimensionScore {
  readonly dimension_id: string;
  readonly description: string;
  readonly conditional_entropy: number;   // lower = more predictive
  readonly information_gain: number;      // higher = more predictive
  readonly discriminative_rank: number;   // 1-based · 1 = most discriminative
  readonly value_distribution: Readonly<Record<string, Readonly<Record<string, number>>>>; // value → outcome → count
}

export interface DimensionSelectionResult {
  readonly corpus_size: number;
  readonly baseline_entropy: number;      // entropy of outcome distribution
  readonly all_scores: readonly DimensionScore[];
  readonly top_k: number;
  readonly top_k_selected: readonly DimensionScore[];
  readonly evidence_kind: "OBSERVED";
  readonly r11b_marker: "DIMENSION_SELECTION_INFORMATION_THEORETIC";
}

// ── Public API ────────────────────────────────────────────────────────

export function selectDimensions(
  corpus: readonly Experience[],
  k: number = 5,
): DimensionSelectionResult {
  if (corpus.length === 0) throw new Error("selectDimensions: empty corpus");

  // Baseline: entropy of the outcome distribution
  const baselineEntropy = entropyOfOutcomes(corpus);

  const scores: DimensionScore[] = DIMENSION_MENU.map((dim) => scoreDimension(dim, corpus, baselineEntropy));

  // Rank by information gain descending (equivalent to conditional entropy ascending)
  const ranked = scores.slice().sort((a, b) => b.information_gain - a.information_gain);
  const withRank = ranked.map((s, i) => ({ ...s, discriminative_rank: i + 1 }));

  recordHeartbeat({
    agent_id: "dimension_selector",
    event_type: "select",
    event_data: { corpus_size: corpus.length, k, baseline_entropy: baselineEntropy.toFixed(3) },
  });

  return {
    corpus_size: corpus.length,
    baseline_entropy: baselineEntropy,
    all_scores: withRank,
    top_k: k,
    top_k_selected: withRank.slice(0, k),
    evidence_kind: "OBSERVED",
    r11b_marker: "DIMENSION_SELECTION_INFORMATION_THEORETIC",
  };
}

// ── Helpers · deterministic information theory ────────────────────────

function entropyOfOutcomes(corpus: readonly Experience[]): number {
  const counts = new Map<string, number>();
  for (const e of corpus) counts.set(e.outcome, (counts.get(e.outcome) ?? 0) + 1);
  let H = 0;
  const n = corpus.length;
  for (const c of counts.values()) {
    const p = c / n;
    if (p > 0) H -= p * Math.log2(p);
  }
  return H;
}

function scoreDimension(dim: DimensionDefinition, corpus: readonly Experience[], baselineEntropy: number): DimensionScore {
  // For each value of D, compute the outcome distribution.
  const dist: Record<string, Record<string, number>> = {};
  for (const e of corpus) {
    const v = String(dim.extract(e));
    if (!dist[v]) dist[v] = {};
    dist[v][e.outcome] = (dist[v][e.outcome] ?? 0) + 1;
  }

  // Conditional entropy H(outcome | dimension)
  let conditionalEntropy = 0;
  const N = corpus.length;
  for (const [, outcomeCounts] of Object.entries(dist)) {
    const totalForValue = Object.values(outcomeCounts).reduce((s, x) => s + x, 0);
    let H_v = 0;
    for (const c of Object.values(outcomeCounts)) {
      const p = c / totalForValue;
      if (p > 0) H_v -= p * Math.log2(p);
    }
    conditionalEntropy += (totalForValue / N) * H_v;
  }

  const informationGain = baselineEntropy - conditionalEntropy;

  return {
    dimension_id: dim.id,
    description: dim.description,
    conditional_entropy: conditionalEntropy,
    information_gain: informationGain,
    discriminative_rank: -1, // filled in later
    value_distribution: dist,
  };
}

export const DIMENSION_SELECTOR_VERSION = "dimension-selector.v1";
