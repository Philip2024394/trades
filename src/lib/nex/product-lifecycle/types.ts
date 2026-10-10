// src/lib/nex/product-lifecycle/types.ts
//
// UWI · Wave 8.C · NEX Product Candidate + Product lifecycle vocabulary
// Founder-authorised programme (Rule 5o.T · capability → NEX Product doctrine).
//
// This module EXTENDS Wave 5's 8-entity chain downstream WITHOUT
// collapsing into existing entities (M18 invariant preserved). The
// existing 8 entities remain intact:
//   RAW_EVIDENCE → SOURCE_RECORD → RESEARCH_EVENT → FINDING →
//   HYPOTHESIS → OPPORTUNITY → IDEA → DECISION
//
// Wave 8.C adds a distinct downstream stage (never merged):
//   → NEX_PRODUCT_CANDIDATE → VALIDATION → ENGINEERING → NEX_PRODUCT
//   → MONITOR → LEARN
//
// The Product Candidate 27-field shape is founder-locked (Rule 5o.T §8).

import type { EntityRef, FalsifiabilityCheck } from "../research-memory/types";

// ─── Product-lifecycle status (respects Wave 5 M23 distinct absorbing states) ─
export type ProductCandidateStatus =
  | "PROPOSED"                // Candidate created · not yet validated
  | "VALIDATING"              // Validation experiments underway
  | "VALIDATED"               // §18 + §19 gates passed with evidence
  | "READY_FOR_ENGINEERING"   // Candidate approved for build
  | "BUILDING"                // Engineering in progress (protected-file gates)
  | "LIVE"                    // Real NEX product exists with real route
  | "MONITORING"              // Post-launch observation
  // ─── ABSORBING STATES (never collapse · M23 discipline) ────────────
  | "REJECTED"                // Evidence says do not pursue · terminal
  | "SUPERSEDED"              // Better candidate replaced it · terminal
  | "MERGED"                  // Absorbed into another candidate · terminal
  | "PARKED"                  // Waiting on external condition · reversible
  | "ARCHIVED";               // No longer of interest · terminal

// ─── Route registry primitive (§22-§23 · never invent) ──────────────
export type RouteStatus = "not_yet_created" | "in_engineering" | "live" | "deprecated";

export interface NexRouteReference {
  readonly status: RouteStatus;
  /** Absolute route within NEX (e.g. `/app/nex-video-studio`) · null if not-yet-created. */
  readonly path: string | null;
  /** Optional label for human-facing display. */
  readonly label?: string;
  /** ISO timestamp of last verification the route exists (or null). */
  readonly last_verified_at_iso: string | null;
}

// ─── §18 selectivity gates · 10 questions the candidate must answer ─
export interface ProductCandidateGates {
  readonly what_user_problem: string;               // §18.1
  readonly why_nex_needs_it: string;                // §18.2
  readonly what_is_genuinely_new: string;           // §18.3
  readonly evidence_supporting_opportunity: string; // §18.4
  readonly capability_creating_value: string;       // §18.5
  readonly nex_can_build_technically: string;       // §18.6
  readonly nex_can_build_legally: string;           // §18.7
  readonly nex_can_keep_runtime_clean: string;      // §18.8
  /** §18.9 · what would prove the product works — MUST also appear in falsifiability.predicted_effect + measurable_outcome. */
  readonly proof_product_works: string;             // §18.9
  /** §18.10 · what would prove the idea is wrong — MUST also appear in falsifiability.refutation_condition. */
  readonly proof_idea_is_wrong: string;             // §18.10
}

// ─── Vacuous-content refusal · gates cannot be filled with placeholder text ──
export const VACUOUS_GATE_ANSWERS: ReadonlyArray<string> = [
  "tbd", "todo", "unknown", "n/a", "na", "none", "-", "?", "",
  "to be determined", "to be decided", "we will see", "we don't know",
];

export class ProductCandidateGatesInsufficientError extends Error {
  constructor(
    public readonly missing_or_vacuous: ReadonlyArray<keyof ProductCandidateGates>,
    caller: string,
  ) {
    super(`Rule 5o.T §18 violation in '${caller}': product candidate gates are missing or vacuous [${missing_or_vacuous.join(", ")}]. Candidate cannot be created — remain FINDING / OPPORTUNITY until evidence answers all 10 questions.`);
    this.name = "ProductCandidateGatesInsufficientError";
  }
}

// ─── NEX Product Candidate · founder-locked 27-field shape (§8) ─────
export interface NexProductCandidate {
  // 1
  readonly candidate_id: string;
  // 2
  readonly created_at_iso: string;
  // 3 · founder-locked 27 fields begin here
  readonly product_name: string;
  // 4
  readonly product_category: string;
  // 5
  readonly problem_solved: string;
  // 6
  readonly target_user: string;
  // 7 · typed EntityRef to Wave 8 EcosystemFinding / Wave 5 Opportunity / Idea
  readonly capability_origin: ReadonlyArray<EntityRef>;
  // 8 · deterministic URL/id of the original source
  readonly source_provenance: ReadonlyArray<{ ecosystem: string; source_url: string; resource_id: string }>;
  // 9
  readonly evidence: ReadonlyArray<{ kind: string; detail: string; ref?: EntityRef }>;
  // 10
  readonly useful_underlying_technique: string;
  // 11
  readonly nex_interpretation: string;
  // 12
  readonly proposed_nex_experience: string;
  // 13
  readonly proposed_inputs: ReadonlyArray<string>;
  // 14
  readonly proposed_outputs: ReadonlyArray<string>;
  // 15
  readonly dependencies_summary: {
    readonly notable: ReadonlyArray<string>;
    readonly total_direct: number;
    readonly total_transitive: number;
  };
  // 16 · SPDX + copyleft class + nex_compatible from Wave 8.A LicenseForensicsReport
  readonly licence: { readonly spdx_identifier: string | null; readonly copyleft_class: string; readonly nex_compatible: boolean; readonly requires_legal_review: boolean; };
  // 17 · risk level + notable signals from Wave 8.A SupplyChainReport
  readonly security: { readonly risk_level: "low" | "medium" | "high" | "critical"; readonly notes: ReadonlyArray<string>; };
  // 18 · Wave 8.A EcosystemRuntimePurityReport summary
  readonly runtime_purity: { readonly is_pure_for_nex_runtime: boolean; readonly notable_external_deps: ReadonlyArray<string>; };
  // 19
  readonly direct_reuse_verdict: { readonly appropriate: boolean; readonly reason: string; };
  // 20
  readonly clean_rebuild_verdict: { readonly possible: boolean; readonly reason: string; };
  // 21
  readonly novelty_assessment: { readonly novelty_score: number; readonly rationale: string; };
  // 22 · M22 · kept SEPARATE from nex_relevance — never averaged
  readonly user_relevance: number;
  // 23 · M22 · kept SEPARATE from user_relevance
  readonly nex_relevance: number;
  // 24 · §18 gates
  readonly validation_gates: ProductCandidateGates;
  // 25 · §19 measurability triad · reuses Wave 5 FalsifiabilityCheck
  readonly measurable_success: FalsifiabilityCheck;
  // 26 · four NEX routes (product/page/design/engineering) · never invent
  readonly routes: {
    readonly product: NexRouteReference;
    readonly page: NexRouteReference;
    readonly design: NexRouteReference;
    readonly engineering: NexRouteReference;
  };
  // 27 · lifecycle status
  readonly status: ProductCandidateStatus;
  // ─── Provenance envelope ─────────────────────────────────────────
  readonly provenance: Readonly<Record<string, unknown>>;
}

// ─── Product-lifecycle event log (M19 discipline · state=projection · history=truth) ─
export type ProductLifecycleEventKind =
  | "candidate_created"
  | "validation_started"
  | "validation_passed"
  | "validation_failed"
  | "engineering_started"
  | "engineering_completed"
  | "gone_live"
  | "monitoring_reading"
  | "rejected"
  | "superseded"
  | "merged_into"
  | "parked"
  | "archived"
  | "route_updated";

export interface ProductLifecycleEvent {
  readonly event_id: string;
  readonly candidate_id: string;
  readonly kind: ProductLifecycleEventKind;
  readonly at_iso: string;
  readonly actor: string;
  readonly from_status?: ProductCandidateStatus | null;
  readonly to_status?: ProductCandidateStatus | null;
  readonly detail?: Readonly<Record<string, unknown>>;
}
