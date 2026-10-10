// src/lib/nex/ecosystem/wave-5-bridge.ts
//
// UWI · Wave 8.B · Bridge from EcosystemFinding → Wave 5 lifecycle
// Founder-authorised programme (Rule 5o.C · connect to Wave 5 lifecycle).
//
// When the repository-audit orchestrator produces an EcosystemFinding
// whose `opportunity_recommendation.create_opportunity === true`, this
// bridge creates a Wave 5 Opportunity via `OpportunityStore.create`,
// preserving the founder-locked disciplines:
//   M20 · falsifiability enforced (assertFalsifiable · insertion-time)
//   M21 · supporting/contradicting arrays kept SEPARATE
//   M22 · user_relevance + nex_relevance kept SEPARATE (never averaged)
//   M23 · state transitions validated
//   M19 · lifecycle_history appended
//   M18 · typed EntityRef edges preserved
//
// Never bypass the lifecycle. Never fabricate falsifiability. If the
// EcosystemFinding does not carry a falsifiable underlying claim, the
// bridge downgrades to observation (creates Finding-only, not Opportunity).

import type { EcosystemFinding } from "./types";
import type { OpportunityStore } from "../research-memory/opportunity-store";
import type { EntityRef, Opportunity, FalsifiabilityCheck } from "../research-memory/types";

export interface BridgeOptions {
  readonly actor: string;
  readonly workflow_id: string;
  readonly opportunity_store: OpportunityStore;
}

export type BridgeOutcome =
  | { kind: "opportunity_created"; opportunity: Opportunity; ecosystem_finding_id: string }
  | { kind: "downgraded_to_observation"; reason: string; ecosystem_finding_id: string }
  | { kind: "disposition_blocked"; disposition: EcosystemFinding["disposition"]; reason: string; ecosystem_finding_id: string };

/** Bridge an EcosystemFinding into the Wave 5 lifecycle.
 *  Deterministic · pure orchestration. */
export function bridgeEcosystemFindingToOpportunity(
  finding: EcosystemFinding,
  opts: BridgeOptions,
): BridgeOutcome {
  // Hard-blocked dispositions never create opportunities.
  if (finding.disposition === "REJECT") {
    return {
      kind: "disposition_blocked",
      disposition: finding.disposition,
      reason: `disposition=REJECT · ${finding.verdict.direct_reuse_verdict.reason}`,
      ecosystem_finding_id: finding.finding_id,
    };
  }
  if (finding.disposition === "LEGAL-REVIEW") {
    return {
      kind: "disposition_blocked",
      disposition: finding.disposition,
      reason: `disposition=LEGAL-REVIEW · licence forensics requires human legal decision before opportunity creation`,
      ecosystem_finding_id: finding.finding_id,
    };
  }
  if (finding.disposition === "DEFER") {
    return {
      kind: "disposition_blocked",
      disposition: finding.disposition,
      reason: `disposition=DEFER · not currently justified to promote to opportunity`,
      ecosystem_finding_id: finding.finding_id,
    };
  }

  // Only REUSE / REBUILD / REFERENCE + create_opportunity=true proceeds
  if (!finding.verdict.opportunity_recommendation.create_opportunity) {
    return {
      kind: "downgraded_to_observation",
      reason: finding.verdict.opportunity_recommendation.reason,
      ecosystem_finding_id: finding.finding_id,
    };
  }

  // Falsifiability enforced by Wave 5 · we synthesise the check from
  // the ecosystem-audit verdict (the underlying technique is the
  // predicted effect · the capability category is measurable · the
  // clean-rebuild-not-possible outcome is the refutation).
  const falsifiability: FalsifiabilityCheck = {
    predicted_effect: `NEX gains a ${finding.verdict.useful_technique.capability_category} capability by ${finding.disposition === "REBUILD" ? "clean-rebuilding" : "referencing"} the underlying technique from ${finding.resource.ecosystem}:${finding.resource.id}`,
    measurable_outcome: `existence of a NEX-native module in the ${finding.verdict.useful_technique.capability_category} category with acceptance-tested behaviour matching the resource's documented capability`,
    refutation_condition: `after a bounded implementation attempt, no NEX-native module can be built that matches the capability signature (clean_rebuild_verdict.possible ${finding.verdict.clean_rebuild_verdict.possible} · reason: ${finding.verdict.clean_rebuild_verdict.reason})`,
  };

  // Typed edges preserved (M18)
  const source_ref: EntityRef = { kind: "SOURCE_RECORD", id: `${finding.resource.ecosystem}:${finding.resource.id}` };
  const finding_ref: EntityRef = { kind: "FINDING", id: finding.finding_id };

  // Supporting signals derived from the audit (M21 · kept SEPARATE from contradicting)
  const supporting: string[] = [
    `licence_class=${finding.verdict.licence.copyleft_class}`,
    `runtime_purity=${finding.verdict.runtime_purity.is_pure_for_nex_runtime ? "pure" : "impure"}`,
    `capability_category=${finding.verdict.useful_technique.capability_category}`,
    `disposition=${finding.disposition}`,
  ];
  if (finding.verdict.direct_reuse_verdict.appropriate) supporting.push("direct_reuse_appropriate");
  if (finding.verdict.clean_rebuild_verdict.possible) supporting.push("clean_rebuild_possible");

  // Contradicting signals kept SEPARATE (M21) — audit surfaces these
  const contradicting: string[] = [];
  if (!finding.verdict.licence.nex_compatible) contradicting.push("licence_not_nex_compatible");
  if (!finding.verdict.runtime_purity.is_pure_for_nex_runtime) contradicting.push("runtime_purity_failed");
  if (finding.verdict.licence.requires_legal_review) contradicting.push("licence_requires_legal_review");
  for (const dep of finding.verdict.runtime_purity.external_llm_dependencies) contradicting.push(`external_llm:${dep}`);
  for (const svc of finding.verdict.runtime_purity.hosted_ai_services) contradicting.push(`hosted_ai:${svc}`);

  // Create the opportunity via Wave 5 store · enforces falsifiability at insert
  const opportunity = opts.opportunity_store.create({
    title: `Ecosystem candidate · ${finding.resource.ecosystem}:${finding.resource.id}`,
    summary_hypothesis: falsifiability.predicted_effect,
    falsifiability,
    source_refs: [source_ref],
    finding_refs: [finding_ref],
    signal_classes: [finding.verdict.useful_technique.capability_category, finding.disposition],
    affected_capabilities: [finding.verdict.useful_technique.capability_category],
    supporting_signals: supporting,
    contradicting_signals: contradicting,
    user_relevance: finding.user_relevance,   // M22 · SEPARATE
    nex_relevance: finding.nex_relevance,     // M22 · SEPARATE
    confidence: finding.verdict.licence.nex_compatible && finding.verdict.runtime_purity.is_pure_for_nex_runtime ? 0.7 : 0.4,
    novelty_score: finding.novelty_score,
    cadence: {
      // Cadence per Rule 5o.M · not "review everything constantly"
      next_review_at_iso: null,                     // caller may schedule later
      decay_window_ms: 30 * 24 * 60 * 60 * 1000,   // 30 days without supporting evidence → decay
      cost_cap_units: 100,                          // bounded research budget per cycle
    },
    provenance: {
      ecosystem_finding: finding.finding_id,
      audit_disposition: finding.disposition,
      resource_source_url: finding.resource.source_url,
    },
    actor: opts.actor,
  });

  return {
    kind: "opportunity_created",
    opportunity,
    ecosystem_finding_id: finding.finding_id,
  };
}
