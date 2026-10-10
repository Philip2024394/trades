// src/lib/nex-agent/code-engine/capability-constraint-extraction.ts
//
// NEX · Phase 6 · DG · Constraint Extraction · 2026-09-21.
// Founder-authorised.
//
// PURPOSE
//
//   Deterministic extractor that turns natural constraint expressions
//   into structural `MeaningConstraint[]` rows. Composes with the
//   accumulator inside capability-meaning-construction.
//
//   Every constraint kind has a specific vocabulary anchor. The anchor
//   is bounded (auditable) but the matching allows compositional
//   modifiers ("not too far", "kind of quiet", "somewhere warmer").
//
// ANTI-CHEATING
//
//   · Every constraint kind is enumerated in capability-meaning-object.
//     Adding a kind is a governance change.
//   · Negation ("not too far") flips distance_far → distance_near.
//   · Pure regex + a small lookup table · no synonym-inflation.

import type { ConstraintKind, MeaningConstraint } from "./capability-meaning-object";

export interface ConstraintExtractionInputs {
  readonly message: string;
  readonly turn_id: number;
}

// Ordered patterns · each fires with a specific ConstraintKind.
// Order matters ONLY where two patterns might match the same surface;
// each entry lists its own bounded phrasing.
const CONSTRAINT_PATTERNS: readonly {
  readonly re: RegExp;
  readonly kind: ConstraintKind;
}[] = [
  // Distance
  { re: /\bnot\s+too\s+far\b/i,          kind: "distance_near" },
  { re: /\bnearby\b|\bnear\b|\bclose\s+by\b|\bnot\s+far\b/i, kind: "distance_near" },
  { re: /\bfar\s+(?:away|off)\b|\bfurther\s+afield\b/i, kind: "distance_far" },
  // Temperature
  { re: /\bwarmer\b|\bhotter\b|\bwarm\b|\bhot\b/i,      kind: "temperature_warmer" },
  { re: /\bcooler\b|\bcolder\b|\bcool\b|\bchilly\b/i,   kind: "temperature_cooler" },
  // Atmosphere
  { re: /\bquiet(?:er)?\b|\bpeaceful\b|\brelax(?:ing|ed)?\b|\bcalm\b/i, kind: "atmosphere_quiet" },
  { re: /\bbusy\b|\blively\b|\bbuzzing\b|\bexciting\b/i, kind: "atmosphere_busy" },
  // Budget
  { re: /\bcheap(?:er)?\b|\baffordable\b|\bon\s+a\s+budget\b|\bnot\s+(?:too\s+)?expensive\b|\bnot\s+crazy\s+expensive\b/i, kind: "budget_cheap" },
  { re: /\bluxur(?:y|ious)\b|\bhigh-end\b|\bpremium\b|\bfancy\b/i, kind: "budget_luxury" },
  // With / who
  { re: /\bwith\s+(?:the\s+)?family\b|\bwith\s+the\s+kids\b|\btake\s+(?:the\s+)?family\b/i, kind: "with_family" },
  { re: /\bwith\s+kids\b|\bwith\s+children\b|\btook\s+the\s+kids\b|\bfor\s+the\s+kids\b/i, kind: "with_kids" },
  { re: /\bwith\s+(?:my\s+)?(?:partner|spouse|wife|husband)\b/i, kind: "with_partner" },
  { re: /\bsolo\b|\bon\s+my\s+own\b|\bby\s+myself\b/i, kind: "solo" },
  // Duration
  { re: /\b(?:a\s+)?few\s+days\b|\bshort\s+(?:trip|break|getaway|holiday|vacation)\b|\bquick\s+(?:trip|break|getaway|holiday|vacation)\b|\b(?:weekend|day)\s+(?:trip|getaway)\b/i, kind: "duration_short" },
  { re: /\b(?:a\s+)?(?:few\s+)?weeks?\b|\blong\s+(?:trip|holiday|vacation)\b/i, kind: "duration_long" },
  // Conditions (weather-adjacent constraint kinds — travel-facing)
  { re: /\bdry\b|\bdrier\b|\bno\s+rain\b/i,             kind: "condition_dry" },
  { re: /\brainy\b|\brain\b|\bwet\b|\bshowers\b/i,      kind: "condition_rainy" },
];

export function extractConstraints(inputs: ConstraintExtractionInputs): readonly MeaningConstraint[] {
  const msg = inputs.message;
  const out: MeaningConstraint[] = [];
  const seen = new Set<ConstraintKind>();
  for (const p of CONSTRAINT_PATTERNS) {
    const m = p.re.exec(msg);
    if (m && !seen.has(p.kind)) {
      seen.add(p.kind);
      out.push({ kind: p.kind, surface: m[0], introduced_turn: inputs.turn_id });
    }
  }
  return out;
}

export function emitConstraintsTrace(constraints: readonly MeaningConstraint[]): string {
  if (constraints.length === 0) return `constraints · none`;
  return `constraints · ${constraints.map((c) => `${c.kind}(${c.surface})`).join(",")}`;
}
