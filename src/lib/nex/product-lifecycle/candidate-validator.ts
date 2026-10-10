// src/lib/nex/product-lifecycle/candidate-validator.ts
//
// UWI · Wave 8.C · Product Candidate validator
// Founder-authorised programme (Rule 5o.T §18 + §19).
//
// Enforces the founder-locked 10-question selectivity gates + reuses
// Wave 5 falsifiability primitive for the §19 measurability triad
// (predicted_effect + measurable_outcome + refutation_condition).
//
// Insertion-time refusal: if any gate is missing/vacuous, candidate
// creation is REFUSED — the discovery remains at Opportunity level
// per §18 last sentence ("If these cannot be answered: remain
// FINDING / OPPORTUNITY. Do not manufacture a product.").
//
// Deterministic · pure validation · no external service.

import type { ProductCandidateGates } from "./types";
import { VACUOUS_GATE_ANSWERS, ProductCandidateGatesInsufficientError } from "./types";
import { assertFalsifiable } from "../research-memory/falsifiability";
import type { FalsifiabilityCheck } from "../research-memory/types";

const GATE_KEYS: ReadonlyArray<keyof ProductCandidateGates> = [
  "what_user_problem",
  "why_nex_needs_it",
  "what_is_genuinely_new",
  "evidence_supporting_opportunity",
  "capability_creating_value",
  "nex_can_build_technically",
  "nex_can_build_legally",
  "nex_can_keep_runtime_clean",
  "proof_product_works",
  "proof_idea_is_wrong",
];

const MIN_GATE_LENGTH = 8;   // characters · anything shorter cannot possibly answer the question meaningfully

export function findVacuousGates(gates: ProductCandidateGates): ReadonlyArray<keyof ProductCandidateGates> {
  const missing: (keyof ProductCandidateGates)[] = [];
  for (const key of GATE_KEYS) {
    const value = gates[key];
    if (typeof value !== "string") { missing.push(key); continue; }
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length < MIN_GATE_LENGTH) { missing.push(key); continue; }
    if (VACUOUS_GATE_ANSWERS.includes(trimmed)) { missing.push(key); continue; }
  }
  return missing;
}

/** Assert §18 gates fully answered. Throws ProductCandidateGatesInsufficientError otherwise. */
export function assertProductCandidateGates(gates: ProductCandidateGates, caller: string): void {
  const missing = findVacuousGates(gates);
  if (missing.length > 0) {
    throw new ProductCandidateGatesInsufficientError(missing, caller);
  }
}

/** Assert §18 gates + §19 measurability triad. Throws on any failure. */
export function assertProductCandidateReadiness(
  gates: ProductCandidateGates,
  measurability: FalsifiabilityCheck,
  caller: string,
): void {
  assertProductCandidateGates(gates, caller);
  assertFalsifiable(measurability, caller);

  // §18.9 / §19 alignment check · proof_product_works must be reflected in predicted_effect + measurable_outcome
  const p_works_norm = gates.proof_product_works.trim().toLowerCase();
  const predicted_norm = measurability.predicted_effect.trim().toLowerCase();
  const measurable_norm = measurability.measurable_outcome.trim().toLowerCase();
  if (predicted_norm.length === 0 || measurable_norm.length === 0 || p_works_norm.length === 0) {
    throw new Error(`Rule 5o.T §19 alignment check failed in '${caller}': §18.9 (proof_product_works) and §19 (predicted_effect/measurable_outcome) must all be non-empty`);
  }

  // §18.10 / §19 alignment · proof_idea_is_wrong must be reflected in refutation_condition
  const p_wrong_norm = gates.proof_idea_is_wrong.trim().toLowerCase();
  const refutation_norm = measurability.refutation_condition.trim().toLowerCase();
  if (refutation_norm.length === 0 || p_wrong_norm.length === 0) {
    throw new Error(`Rule 5o.T §19 alignment check failed in '${caller}': §18.10 (proof_idea_is_wrong) and §19 (refutation_condition) must both be non-empty`);
  }
}
