// src/lib/nex-agent/code-engine/independent-score.ts
//
// Amendment 1.D: NEX1's Capability Ladder must expose Composite Score AND
// Independent Score. Independent = what remains if every non-template adapter
// is removed.

import type { Nex1AttemptProvenance } from "./provenance-recorder";
import { TEMPLATE_ONLY_ID } from "./adapters/template-only";

export interface IndependenceStats {
  readonly total_attempts: number;
  readonly template_only_attempts: number;
  readonly adapter_assisted_attempts: number;
  readonly independent_pct: number;    // % of NEX1's evidence that survives the adapter-removal test
}

/**
 * @summary Compute Independent Score from a set of NEX1-attributed attempt provenances.
 */
export function computeIndependenceStats(provenances: readonly Nex1AttemptProvenance[]): IndependenceStats {
  const total = provenances.length;
  const templateOnly = provenances.filter((p) => p.adapter_id === TEMPLATE_ONLY_ID).length;
  const assisted = total - templateOnly;
  const pct = total === 0 ? 100 : Math.round((templateOnly / total) * 100);
  return {
    total_attempts: total,
    template_only_attempts: templateOnly,
    adapter_assisted_attempts: assisted,
    independent_pct: pct,
  };
}
