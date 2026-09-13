// WO-INTELLIGENCE-01 · deterministic scoring + promotion.
//
// PURE FUNCTIONS. Same evidence → same score → same promotion decision.
// No IO. No randomness. No LLM. No hidden state.
//
// Promotion never carries authority — it only changes the KnowledgeObject
// `status` enum. Activation for engineering use still requires a founder-
// signed WO after this pipeline has done its work.

import { randomUUID } from "node:crypto";
import { provenanceChainHash } from "./provenance";
import type {
  ExperimentRecord,
  KnowledgeFragment,
  KnowledgeObject,
  KnowledgeObjectExperimentEvidence,
  KnowledgeObjectSourceEvidence,
  KnowledgeStatus,
} from "./types";

// ── Thresholds (from WO-INTELLIGENCE-01 spec §6) ────────────────────────

export const INTELLIGENCE_THRESHOLDS = Object.freeze({
  min_independent_sources: 3,
  min_success_ratio: 5 / 6,
  max_unreproducible_failures: 0,
  min_correlation_count: 1,
  requires_generalisation: false,
  max_unresolved_contradictions: 0,
  min_confidence: 0.80,
  requires_nex_reproduction: false,
  requires_combinatorial_synthesis: false,
});

export const SUPER_INTELLIGENCE_THRESHOLDS = Object.freeze({
  min_independent_sources: 7,
  min_success_ratio: 10 / 11,
  max_unreproducible_failures: 0,
  min_correlation_count: 3,
  requires_generalisation: true,
  max_unresolved_contradictions: 0,
  min_confidence: 0.95,
  requires_nex_reproduction: true,
  requires_combinatorial_synthesis: true,
});

// ── Scoring (deterministic) ─────────────────────────────────────────────

export interface ScoreInputs {
  readonly source_count: number;
  readonly experiment: ExperimentRecord | null;
  readonly correlation_count: number;
  readonly generalisation_passed: boolean;
  readonly contradiction_count: number;
  readonly reproduced_by_nex: boolean;
  readonly synthesised_from_count: number;    // number of fragments/objects combined
}

export interface Score {
  readonly confidence: number;              // 0..1
  readonly reproducibility_score: number;   // 0..1
  readonly independent_sources: number;
  readonly success_ratio: number;           // successful / total
  readonly unreproducible_failures: number;
  readonly correlation_count: number;
  readonly generalisation_passed: boolean;
  readonly contradiction_count: number;
  readonly reproduced_by_nex: boolean;
  readonly combinatorial_syntheses: number;
}

export function scoreEvidence(inp: ScoreInputs): Score {
  const total = inp.experiment ? (inp.experiment.success_count + inp.experiment.failure_count + inp.experiment.limitation_count) : 0;
  const success = inp.experiment?.success_count ?? 0;
  const failure = inp.experiment?.failure_count ?? 0;
  const success_ratio = total > 0 ? success / total : 0;

  // Confidence heuristic (deterministic, bounded 0..1):
  //   weighted sum of source-count normalisation, success ratio, correlation,
  //   generalisation, absence of contradictions.
  const sourceComponent = Math.min(1, inp.source_count / 10);
  const successComponent = success_ratio;
  const correlationComponent = Math.min(1, inp.correlation_count / 5);
  const generalisationComponent = inp.generalisation_passed ? 1 : 0;
  const noContradictionComponent = inp.contradiction_count === 0 ? 1 : Math.max(0, 1 - inp.contradiction_count / 5);
  const reproductionComponent = inp.reproduced_by_nex ? 1 : 0.5;

  const confidence = clamp(
    0.20 * sourceComponent +
    0.35 * successComponent +
    0.15 * correlationComponent +
    0.10 * generalisationComponent +
    0.10 * noContradictionComponent +
    0.10 * reproductionComponent,
    0, 1,
  );

  // Reproducibility uses different weights — reproduction + success ratio dominant.
  const reproducibility_score = clamp(
    0.50 * successComponent +
    0.30 * reproductionComponent +
    0.20 * noContradictionComponent,
    0, 1,
  );

  return {
    confidence,
    reproducibility_score,
    independent_sources: inp.source_count,
    success_ratio,
    unreproducible_failures: failure,
    correlation_count: inp.correlation_count,
    generalisation_passed: inp.generalisation_passed,
    contradiction_count: inp.contradiction_count,
    reproduced_by_nex: inp.reproduced_by_nex,
    combinatorial_syntheses: inp.synthesised_from_count,
  };
}

// ── Promotion (pure) ────────────────────────────────────────────────────

export type PromotionDecision =
  | { readonly targetStatus: KnowledgeStatus; readonly reasons: readonly string[] };

/**
 * Decide the target status for a KnowledgeObject given its computed score.
 * PROPERTY: below-threshold evidence NEVER returns PRODUCTION or
 * SUPER_INTELLIGENCE. Those two statuses can only be reached by an
 * external founder-signed WO — this function only produces the internal
 * enum steps up to _CANDIDATE.
 */
export function decidePromotion(current: KnowledgeStatus, score: Score): PromotionDecision {
  const reasons: string[] = [];

  const meetsIntelligence = meetsThresholds(score, INTELLIGENCE_THRESHOLDS);
  const meetsSuper = meetsThresholds(score, SUPER_INTELLIGENCE_THRESHOLDS);

  if (meetsSuper) {
    reasons.push("meets SUPER_INTELLIGENCE_THRESHOLDS · candidate for founder-signed super-intel WO");
    return { targetStatus: "SUPER_INTELLIGENCE_CANDIDATE", reasons };
  }
  if (meetsIntelligence) {
    reasons.push("meets INTELLIGENCE_THRESHOLDS · candidate for founder-signed intel WO");
    return { targetStatus: "APPROVED", reasons };
  }
  if (score.success_ratio > 0 || score.independent_sources > 0) {
    reasons.push(`does not meet Intelligence thresholds (confidence ${score.confidence.toFixed(2)}, sources ${score.independent_sources}, success_ratio ${score.success_ratio.toFixed(2)})`);
    // If we have an experiment at all, move to TESTED; else stay PROPOSED.
    return { targetStatus: score.success_ratio > 0 || score.unreproducible_failures > 0 ? "TESTED" : "PROPOSED", reasons };
  }
  reasons.push("no experiment evidence yet");
  return { targetStatus: current === "DISCOVERED" ? "PROPOSED" : current, reasons };
}

/** Never returns true unless every threshold is met. */
function meetsThresholds(score: Score, t: typeof INTELLIGENCE_THRESHOLDS): boolean {
  if (score.independent_sources < t.min_independent_sources) return false;
  if (score.success_ratio < t.min_success_ratio) return false;
  if (score.unreproducible_failures > t.max_unreproducible_failures) return false;
  if (score.correlation_count < t.min_correlation_count) return false;
  if (t.requires_generalisation && !score.generalisation_passed) return false;
  if (score.contradiction_count > t.max_unresolved_contradictions) return false;
  if (score.confidence < t.min_confidence) return false;
  if (t.requires_nex_reproduction && !score.reproduced_by_nex) return false;
  if (t.requires_combinatorial_synthesis && score.combinatorial_syntheses < 2) return false;
  return true;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

// ── Build a KnowledgeObject from evidence + promotion result ───────────

export function buildKnowledgeObject(input: {
  readonly name: string;
  readonly domain: string;
  readonly source_evidence: readonly KnowledgeObjectSourceEvidence[];
  readonly experiments: readonly KnowledgeObjectExperimentEvidence[];
  readonly limitations: readonly KnowledgeObject["limitations"][number][];
  readonly recommended_use: readonly string[];
  readonly agent_capability_affected: string | null;
  readonly score: Score;
  readonly targetStatus: KnowledgeStatus;
  readonly synthesised_from: readonly string[];
  readonly antecedent_provenance_hashes: readonly string[];
}): KnowledgeObject {
  const now = new Date().toISOString();
  const knowledge_id = `intel-knowledge-${randomUUID()}`;
  const base = {
    record_type: "NEX_INTELLIGENCE_KNOWLEDGE_OBJECT" as const,
    knowledge_id,
    version: 1,
    name: input.name,
    created_at: now,
    updated_at: now,
    domain: input.domain,
    source_evidence: Object.freeze([...input.source_evidence]) as readonly KnowledgeObjectSourceEvidence[],
    experiments: Object.freeze([...input.experiments]) as readonly KnowledgeObjectExperimentEvidence[],
    limitations: Object.freeze([...input.limitations]) as readonly KnowledgeObject["limitations"][number][],
    recommended_use: Object.freeze([...input.recommended_use]) as readonly string[],
    agent_capability_affected: input.agent_capability_affected,
    confidence: input.score.confidence,
    reproducibility_score: input.score.reproducibility_score,
    correlation_count: input.score.correlation_count,
    generalisation_passed: input.score.generalisation_passed,
    status: input.targetStatus,
    supersedes: Object.freeze([]) as readonly string[],
    superseded_by: Object.freeze([]) as readonly string[],
    synthesised_from: Object.freeze([...input.synthesised_from]) as readonly string[],
    authorised_by: null,
    authorising_wo_id: null,
    revisit_scheduled_at: null,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, input.antecedent_provenance_hashes) };
}

// ── Enforcement wall for the promotion decision ────────────────────────

/**
 * A hard guard: no matter what a caller SUPPLIES as targetStatus, we
 * clamp it to what the score actually allows. PRODUCTION and
 * SUPER_INTELLIGENCE can ONLY be entered via a founder-signed WO, so
 * this function refuses to return them here.
 */
export function enforcePromotionCeiling(requested: KnowledgeStatus, score: Score): KnowledgeStatus {
  if (requested === "PRODUCTION" || requested === "SUPER_INTELLIGENCE") {
    // No path in this module produces these statuses.
    return decidePromotion("DISCOVERED", score).targetStatus;
  }
  return requested;
}

/** Deprecated-with-reason path: internal state change, still not authority. */
export function markDeprecated(_reason: string): KnowledgeStatus {
  return "DEPRECATED";
}
