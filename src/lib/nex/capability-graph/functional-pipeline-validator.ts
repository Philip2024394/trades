// src/lib/nex/capability-graph/functional-pipeline-validator.ts
//
// UWI · Wave 8.G.1 · Functional-pipeline evidence validator
// Founder-authorised programme (Rule 5o.T §15-§16 · founder-explicit definition of
// functional_pipeline evidence).
//
// Enforces the founder rule: functional_pipeline evidence must prove that
// output/capability/interface/data/transformation produced by capability A
// can functionally feed or enable capability B. It must NOT be inferred
// from semantic similarity · co-occurrence · category similarity ·
// repository proximity · "sound useful together".

import type { FunctionalPipelineEvidence } from "./types";
import { VACUOUS_EVIDENCE_STRINGS, CompositionEdgeInsufficientEvidenceError } from "./types";

const MIN_EVIDENCE_STRING_LENGTH = 8;

export interface EvidenceValidationVerdict {
  readonly is_admissible: boolean;
  readonly missing_or_vacuous: ReadonlyArray<string>;
}

export function validateFunctionalPipelineEvidence(evidence: FunctionalPipelineEvidence): EvidenceValidationVerdict {
  const missing: string[] = [];

  // Field 1 · source_capability_output
  const src = (evidence.source_capability_output ?? "").trim().toLowerCase();
  if (src.length < MIN_EVIDENCE_STRING_LENGTH) missing.push("source_capability_output");
  else if (VACUOUS_EVIDENCE_STRINGS.includes(src)) missing.push("source_capability_output");

  // Field 2 · consumer_capability_input
  const cons = (evidence.consumer_capability_input ?? "").trim().toLowerCase();
  if (cons.length < MIN_EVIDENCE_STRING_LENGTH) missing.push("consumer_capability_input");
  else if (VACUOUS_EVIDENCE_STRINGS.includes(cons)) missing.push("consumer_capability_input");

  // Field 3 · pipeline_medium
  const med = (evidence.pipeline_medium ?? "").trim().toLowerCase();
  if (med.length < MIN_EVIDENCE_STRING_LENGTH) missing.push("pipeline_medium");
  else if (VACUOUS_EVIDENCE_STRINGS.includes(med)) missing.push("pipeline_medium");

  // Field 4 · source_evidence_ref must be a typed reference to a RAW_EVIDENCE record
  const ref = evidence.source_evidence_ref;
  if (!ref || typeof ref !== "object" || typeof ref.id !== "string" || ref.id.length < 3) {
    missing.push("source_evidence_ref");
  } else if (ref.kind !== "RAW_EVIDENCE" && ref.kind !== "SOURCE_RECORD" && ref.kind !== "RESEARCH_EVENT") {
    // Only these three EntityKinds can carry pipeline evidence · claims/derivatives are NOT evidence
    missing.push("source_evidence_ref.kind");
  }

  return {
    is_admissible: missing.length === 0,
    missing_or_vacuous: missing,
  };
}

export function assertFunctionalPipelineEvidence(evidence: FunctionalPipelineEvidence, caller: string): void {
  const verdict = validateFunctionalPipelineEvidence(evidence);
  if (!verdict.is_admissible) {
    throw new CompositionEdgeInsufficientEvidenceError(verdict.missing_or_vacuous, caller);
  }
}

/** Deterministic dedup signature for a functional_pipeline edge.
 *  Directional (A → B ≠ B → A) because the founder-defined evidence is
 *  directional (output → input). */
export function computeFunctionalPipelineDedupSignature(
  left_node_id: string,
  right_node_id: string,
): string {
  return `functional_pipeline:${left_node_id}→${right_node_id}`;
}
