// src/lib/nex-agent/code-engine/brb/capability-brain-similarities.ts
//
// NEX1 · Brain Similarities · Ledger B multi-experience consumer.
//
// PURPOSE
//   Takes N experiences (each with its own natural schema) and emits
//   pairwise structural-similarity statistics. Generic metrics only:
//     · field-name Jaccard
//     · value-type overlap
//     · numeric zero co-occurrence
//     · numeric nonzero co-occurrence
//     · string-token Jaccard
//     · outcome match
//     · composite similarity (equal weights · no tuning)
//
// DELIBERATELY GENERIC
//   No metric is calibrated to a specific relationship pattern.
//   Every metric would fire on any evidence exhibiting the underlying
//   structural property, regardless of domain vocabulary.
//
// ANTI-CHEATING
//   · zero target-relationship strings in this file
//   · zero domain-specific field-name checks
//   · zero cluster-label vocabulary encoded
//   · zero equivalence-class taxonomy
//   · weights are equal · no fit-to-benchmark tuning
//
// This capability is the structural addition NEX previously lacked:
// something that can consume multiple experiences as one input and
// compute cross-experience overlap. It is Ledger B by construction.
// Whether NEX USES it for autonomous judgment is what downstream tests
// measure.

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";

registerAgent({
  id: "brain_similarities",
  name: "Brain Similarities · pairwise structural comparison",
  cognitive_layer: "brain_recovery_specialist",
  description: "Consumes multiple experiences (each in its own natural schema). Emits pairwise generic structural-similarity statistics. Recommend-only · no authority to modify anything.",
});

// ── Types ─────────────────────────────────────────────────────────────

export interface Experience {
  readonly id: string;
  readonly facts: Readonly<Record<string, unknown>>;
  readonly outcome: "success" | "failure" | "unknown";
}

export interface PairwiseSimilarity {
  readonly a_id: string;
  readonly b_id: string;
  readonly field_name_jaccard: number;
  readonly value_type_overlap: number;
  readonly numeric_zero_co_occurrence: number;      // count of fields where both are numeric-and-zero
  readonly numeric_nonzero_co_occurrence: number;   // count of fields where both are numeric-and-nonzero
  readonly string_token_jaccard: number;
  readonly outcome_match: boolean;
  readonly composite_similarity: number;            // equal-weighted average of above (booleans as 0/1)
  readonly shared_structural_properties: readonly string[]; // human-readable descriptors of what was observed
}

export interface SimilaritiesResult {
  readonly experiences_consumed: number;
  readonly pairs_computed: number;
  readonly pairwise: readonly PairwiseSimilarity[];
  readonly evidence_kind: "OBSERVED";
  readonly r11b_marker: "SIMILARITIES_STRUCTURAL_ONLY";
}

// ── Public API ────────────────────────────────────────────────────────

export function computeSimilarities(experiences: readonly Experience[]): SimilaritiesResult {
  const pairs: PairwiseSimilarity[] = [];
  for (let i = 0; i < experiences.length; i++) {
    for (let j = i + 1; j < experiences.length; j++) {
      pairs.push(pairwise(experiences[i], experiences[j]));
    }
  }
  recordHeartbeat({
    agent_id: "brain_similarities",
    event_type: "compute",
    event_data: { n: experiences.length, pairs: pairs.length },
  });
  return {
    experiences_consumed: experiences.length,
    pairs_computed: pairs.length,
    pairwise: pairs,
    evidence_kind: "OBSERVED",
    r11b_marker: "SIMILARITIES_STRUCTURAL_ONLY",
  };
}

// ── Metric implementations ────────────────────────────────────────────

function pairwise(a: Experience, b: Experience): PairwiseSimilarity {
  const aFields = new Set(Object.keys(a.facts));
  const bFields = new Set(Object.keys(b.facts));
  const sharedFields = [...aFields].filter((f) => bFields.has(f));

  // 1 · field-name Jaccard (structural overlap of schema)
  const fnJaccard = jaccard(aFields, bFields);

  // 2 · value-type overlap (of shared fields, how many have matching value-types?)
  let valueTypeMatches = 0;
  for (const f of sharedFields) {
    if (typeof a.facts[f] === typeof b.facts[f]) valueTypeMatches++;
  }
  const valueTypeOverlap = sharedFields.length > 0 ? valueTypeMatches / sharedFields.length : 0;

  // 3 · numeric zero co-occurrence · across ALL fields (not just shared)
  //    Count fields in each experience whose value is a number === 0.
  //    Co-occurrence = min of the two counts (generic structural).
  const zeroCountA = Object.values(a.facts).filter(isNumericZero).length;
  const zeroCountB = Object.values(b.facts).filter(isNumericZero).length;
  const numericZeroCoOccurrence = Math.min(zeroCountA, zeroCountB);

  // 4 · numeric nonzero co-occurrence
  const nzCountA = Object.values(a.facts).filter((v) => isFiniteNumber(v) && v !== 0).length;
  const nzCountB = Object.values(b.facts).filter((v) => isFiniteNumber(v) && v !== 0).length;
  const numericNonzeroCoOccurrence = Math.min(nzCountA, nzCountB);

  // 5 · string token Jaccard (across all string values, tokenised on whitespace + basic delimiters)
  const stringTokensA = extractStringTokens(a.facts);
  const stringTokensB = extractStringTokens(b.facts);
  const stringTokenJaccard = jaccard(stringTokensA, stringTokensB);

  // 6 · outcome match
  const outcomeMatch = a.outcome === b.outcome;

  // 7 · composite similarity · equal-weighted average
  //     Normalise numeric co-occurrences by max plausible count (use max of the two counts for that class).
  const nzNormA = Math.max(zeroCountA, zeroCountB, 1);
  const nzNormB = Math.max(nzCountA, nzCountB, 1);
  const normalisedZero = numericZeroCoOccurrence / nzNormA;
  const normalisedNonzero = numericNonzeroCoOccurrence / nzNormB;
  const components = [
    fnJaccard,
    valueTypeOverlap,
    normalisedZero,
    normalisedNonzero,
    stringTokenJaccard,
    outcomeMatch ? 1 : 0,
  ];
  const composite = components.reduce((s, x) => s + x, 0) / components.length;

  // Shared structural properties · describe observable facts (never interpret)
  const shared: string[] = [];
  if (fnJaccard > 0.5) shared.push("field_name_jaccard_" + fnJaccard.toFixed(2));
  if (numericZeroCoOccurrence >= 1) shared.push("numeric_zero_co_occurrence_" + numericZeroCoOccurrence);
  if (numericNonzeroCoOccurrence >= 1) shared.push("numeric_nonzero_co_occurrence_" + numericNonzeroCoOccurrence);
  if (stringTokenJaccard > 0.1) shared.push("string_token_jaccard_" + stringTokenJaccard.toFixed(2));
  if (outcomeMatch) shared.push("outcome_match_" + a.outcome);

  return {
    a_id: a.id,
    b_id: b.id,
    field_name_jaccard: fnJaccard,
    value_type_overlap: valueTypeOverlap,
    numeric_zero_co_occurrence: numericZeroCoOccurrence,
    numeric_nonzero_co_occurrence: numericNonzeroCoOccurrence,
    string_token_jaccard: stringTokenJaccard,
    outcome_match: outcomeMatch,
    composite_similarity: composite,
    shared_structural_properties: shared,
  };
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni > 0 ? inter / uni : 0;
}

function isNumericZero(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && v === 0;
}
function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function extractStringTokens(facts: Readonly<Record<string, unknown>>): Set<string> {
  const tokens = new Set<string>();
  for (const v of Object.values(facts)) {
    if (typeof v === "string") {
      for (const t of v.toLowerCase().split(/[\s._\-\/@:]+/)) {
        if (t.length > 0) tokens.add(t);
      }
    }
  }
  return tokens;
}

export const BRAIN_SIMILARITIES_VERSION = "brain-similarities.v1";
