// src/lib/nex/product-lifecycle/opportunity-to-candidate-bridge.ts
//
// UWI · Wave 8.C · Bridge from Wave 5 Opportunity → NEX Product Candidate
// Founder-authorised programme (Rule 5o.T §7 · productisation is REQUIRED
// destination when evidence supports it).
//
// Given an Opportunity (from Wave 5) plus the originating EcosystemFinding
// (from Wave 8.A/B) plus caller-supplied §18 gates + §19 measurability
// triad, this bridge composes a Product Candidate via the store.
//
// If §18 gates are insufficient · the bridge returns
// `gates_insufficient` and the Opportunity remains at Opportunity stage
// (per §18 last sentence · "remain FINDING/OPPORTUNITY. Do not manufacture
// a product.").

import type { NexProductCandidate, ProductCandidateGates } from "./types";
import type { ProductCandidateStore } from "./candidate-store";
import type { Opportunity, EntityRef, FalsifiabilityCheck } from "../research-memory/types";
import type { EcosystemFinding } from "../ecosystem/types";
import { findVacuousGates } from "./candidate-validator";

export interface OpportunityToCandidateInput {
  readonly opportunity: Opportunity;
  readonly finding: EcosystemFinding;
  readonly product_name: string;
  readonly product_category: string;
  readonly problem_solved: string;
  readonly target_user: string;
  readonly nex_interpretation: string;
  readonly proposed_nex_experience: string;
  readonly proposed_inputs: ReadonlyArray<string>;
  readonly proposed_outputs: ReadonlyArray<string>;
  readonly validation_gates: ProductCandidateGates;
  readonly measurable_success: FalsifiabilityCheck;
  readonly actor: string;
}

export interface BridgeOptions {
  readonly candidate_store: ProductCandidateStore;
}

export type OpportunityToCandidateOutcome =
  | { kind: "candidate_created"; candidate: NexProductCandidate; opportunity_id: string }
  | { kind: "gates_insufficient"; missing_or_vacuous: ReadonlyArray<keyof ProductCandidateGates>; opportunity_id: string; reason: string }
  | { kind: "disposition_blocked"; disposition: EcosystemFinding["disposition"]; opportunity_id: string; reason: string };

/** Bridge a Wave 5 Opportunity + Wave 8 EcosystemFinding into a NEX Product Candidate.
 *  Refuses gracefully if §18 gates insufficient. */
export function bridgeOpportunityToProductCandidate(
  input: OpportunityToCandidateInput,
  opts: BridgeOptions,
): OpportunityToCandidateOutcome {
  // Hard-blocked dispositions never become Product Candidates.
  if (input.finding.disposition === "REJECT") {
    return {
      kind: "disposition_blocked",
      disposition: input.finding.disposition,
      opportunity_id: input.opportunity.opportunity_id,
      reason: `disposition=REJECT · ${input.finding.verdict.direct_reuse_verdict.reason}`,
    };
  }
  if (input.finding.disposition === "LEGAL-REVIEW") {
    return {
      kind: "disposition_blocked",
      disposition: input.finding.disposition,
      opportunity_id: input.opportunity.opportunity_id,
      reason: `disposition=LEGAL-REVIEW · legal decision required before Product Candidate creation`,
    };
  }
  if (input.finding.disposition === "DEFER") {
    return {
      kind: "disposition_blocked",
      disposition: input.finding.disposition,
      opportunity_id: input.opportunity.opportunity_id,
      reason: `disposition=DEFER · not currently justified for productisation`,
    };
  }

  // §18 selectivity check · discovery remains Opportunity if gates insufficient
  const missing = findVacuousGates(input.validation_gates);
  if (missing.length > 0) {
    return {
      kind: "gates_insufficient",
      missing_or_vacuous: missing,
      opportunity_id: input.opportunity.opportunity_id,
      reason: `Rule 5o.T §18 gates insufficient · ${missing.length} of 10 unanswered · candidate NOT created · remains at Opportunity stage`,
    };
  }

  // Typed edges preserved (M18)
  const capability_origin: EntityRef[] = [
    { kind: "OPPORTUNITY", id: input.opportunity.opportunity_id },
    { kind: "FINDING", id: input.finding.finding_id },
  ];

  const candidate = opts.candidate_store.create({
    product_name: input.product_name,
    product_category: input.product_category,
    problem_solved: input.problem_solved,
    target_user: input.target_user,
    capability_origin,
    source_provenance: [{
      ecosystem: input.finding.resource.ecosystem,
      source_url: input.finding.resource.source_url,
      resource_id: input.finding.resource.id,
    }],
    evidence: [
      { kind: "opportunity_supporting_signals", detail: input.opportunity.supporting_signals.join(" · ") },
      { kind: "opportunity_contradicting_signals", detail: input.opportunity.contradicting_signals.join(" · ") },
      { kind: "audit_disposition", detail: input.finding.disposition },
    ],
    useful_underlying_technique: input.finding.verdict.useful_technique.underlying_technique,
    nex_interpretation: input.nex_interpretation,
    proposed_nex_experience: input.proposed_nex_experience,
    proposed_inputs: input.proposed_inputs,
    proposed_outputs: input.proposed_outputs,
    dependencies_summary: {
      notable: input.finding.verdict.dependencies_summary.notable,
      total_direct: input.finding.verdict.dependencies_summary.direct_count,
      total_transitive: input.finding.verdict.dependencies_summary.transitive_count,
    },
    licence: {
      spdx_identifier: input.finding.verdict.licence.spdx_identifier,
      copyleft_class: input.finding.verdict.licence.copyleft_class,
      nex_compatible: input.finding.verdict.licence.nex_compatible,
      requires_legal_review: input.finding.verdict.licence.requires_legal_review,
    },
    security: {
      risk_level: "low",   // Wave 8.C metadata-only default · full supply-chain risk carried in provenance
      notes: input.finding.provenance_chain.map(p => `${p.stage}:${p.detail ?? ""}`),
    },
    runtime_purity: {
      is_pure_for_nex_runtime: input.finding.verdict.runtime_purity.is_pure_for_nex_runtime,
      notable_external_deps: [
        ...input.finding.verdict.runtime_purity.external_llm_dependencies,
        ...input.finding.verdict.runtime_purity.hosted_ai_services,
        ...input.finding.verdict.runtime_purity.cloud_service_dependencies,
      ],
    },
    direct_reuse_verdict: input.finding.verdict.direct_reuse_verdict,
    clean_rebuild_verdict: input.finding.verdict.clean_rebuild_verdict,
    novelty_assessment: {
      novelty_score: input.finding.novelty_score,
      rationale: `derived from Wave 4 dedup cascade novelty score for ${input.finding.resource.ecosystem}:${input.finding.resource.id}`,
    },
    user_relevance: input.opportunity.user_relevance,   // M22 · SEPARATE
    nex_relevance: input.opportunity.nex_relevance,     // M22 · SEPARATE
    validation_gates: input.validation_gates,
    measurable_success: input.measurable_success,
    provenance: {
      opportunity_id: input.opportunity.opportunity_id,
      ecosystem_finding_id: input.finding.finding_id,
      disposition_at_bridge: input.finding.disposition,
    },
    actor: input.actor,
  });

  return { kind: "candidate_created", candidate, opportunity_id: input.opportunity.opportunity_id };
}
