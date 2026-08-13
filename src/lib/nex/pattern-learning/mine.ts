// Pattern Learning Engine · observe + mine + query.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import type { PatternObservation, Pairing } from "./types";

const OBSERVATIONS: PatternObservation[] = [];

export function observe(obs: PatternObservation): PatternObservation {
  OBSERVATIONS.push(obs);
  return obs;
}

export function count(): number { return OBSERVATIONS.length; }

export function clear(): void { OBSERVATIONS.length = 0; }

/** Mine all antecedent → consequent pairs across every observation. Returns
 *  pairings with support · antecedent_count · confidence · sorted by confidence. */
export function mine(min_support: number = 2, min_confidence: number = 0.5): readonly Pairing[] {
  const featureIndex = new Map<string, Map<string, PatternObservation[]>>();
  for (const obs of OBSERVATIONS) {
    for (const [feature, value] of Object.entries(obs.features)) {
      let inner = featureIndex.get(feature);
      if (!inner) { inner = new Map(); featureIndex.set(feature, inner); }
      const bucket = inner.get(value) ?? [];
      bucket.push(obs);
      inner.set(value, bucket);
    }
  }

  const pairings: Pairing[] = [];
  const features = Array.from(featureIndex.entries());
  for (let i = 0; i < features.length; i++) {
    const [f1, v1Map] = features[i];
    for (let j = 0; j < features.length; j++) {
      if (i === j) continue;
      const [f2, v2Map] = features[j];
      for (const [v1, obs1List] of v1Map) {
        for (const [v2, obs2List] of v2Map) {
          const support = obs1List.filter((o) => obs2List.includes(o)).length;
          if (support < min_support) continue;
          const conf = support / obs1List.length;
          if (conf < min_confidence) continue;
          pairings.push({
            antecedent: { feature: f1, value: v1 },
            consequent: { feature: f2, value: v2 },
            support,
            antecedent_count: obs1List.length,
            confidence: Math.round(conf * 100) / 100,
          });
        }
      }
    }
  }
  return pairings.sort((a, b) => (b.confidence - a.confidence) || (b.support - a.support));
}

/** Which consequents commonly co-occur with the given antecedent · ranked by confidence. */
export function what_pairs_with(antecedent_feature: string, antecedent_value: string, min_support: number = 2, min_confidence: number = 0.5): readonly Pairing[] {
  return mine(min_support, min_confidence).filter(
    (p) => p.antecedent.feature === antecedent_feature && p.antecedent.value === antecedent_value
  );
}
