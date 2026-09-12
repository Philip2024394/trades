// src/lib/nex/security-agent/types.ts
//
// HQ Security Agent · 4th Guardian tier · Stage 1 of BUILD PLAN v1.1.
//
// Founder-authorised 2026-09-11 · single AUTHORISE BUILD covers all 10 stages.
// Consumes: ADR-0316a (Security Agent Design) · docs/nex-work-map.json ·
// docs/nex-file-capability-map.json · docs/nex-locked-doctrines.json.
//
// The Security Agent inspects proposed CODE changes only. It does NOT decide
// truth (that is TE-Guardian) · does NOT decide candidate acceptance (that is
// Lab-Guardian) · does NOT decide AUTHORITATIVE promotion (that is R-10).
//
// Boundary invariants (ADR-0316a §3.2 · locked):
//   1. MUST NOT decide constitutional truth
//   2. MUST NOT decide candidate acceptance
//   3. MUST NOT decide AUTHORITATIVE promotion
//   4. MUST NOT execute code changes
//   5. MUST NOT invent capabilities
//   6. MUST NOT write Work Map / file-capability-map / locked-doctrines
//   7. MUST NOT bypass other Guardians

/**
 * Guardian namespace for rejection codes. Each Guardian owns one prefix
 * per ADR-0314f §5. `sec.` is exclusively HQ Security Agent's namespace.
 */
export type SecurityRejectionCode =
  // File registry
  | "sec.file_outside_registry"
  | "sec.rogue_path_modified"
  | "sec.mapping_registry_missing"
  // Doctrine violations (constitutional axis)
  | "sec.axis_substitution_attempted"
  | "sec.activity_promoted_to_domain"
  | "sec.unknown_to_pass_conversion_detected"
  | "sec.physical_vs_logical_authority_conflated"
  | "sec.business_services_conflated"
  | "sec.domain_axis_inflation_attempted"
  | "sec.axis_substitution_violation"
  | "sec.r10_bypass_attempted"
  | "sec.guardian_responsibility_conflated"
  | "sec.canonical_knowledge_conflation"
  // Anti-drift
  | "sec.observation_as_authority_attempted"
  | "sec.calendar_time_authority_attempted"
  | "sec.threshold_invention_attempted"
  // Anti-zoo
  | "sec.crawler_zoo_attempted"
  | "sec.url_driven_acquisition_attempted"
  | "sec.entity_or_location_fragmented"
  | "sec.audit_duplication_attempted"
  // Rule invariants
  | "sec.r01_threshold_invention_attempted"
  | "sec.r11_band_invention_attempted"
  | "sec.r13_vocabulary_invention_attempted"
  | "sec.r17_threshold_invention_attempted"
  | "sec.r18_envelope_invariant_violated"
  | "sec.r20_forbidden_basis_used"
  // Stage 1b safety boundary
  | "sec.stage_1b_r10_boundary_violated"
  | "sec.lab_guardian_out_of_order"
  | "sec.rejection_scope_expansion_attempted"
  | "sec.determinism_failure_bypassed"
  // Anti-invention + governance
  | "sec.guardian_surface_invention_attempted"
  | "sec.third_party_image_copy_attempted"
  | "sec.seed_listing_rule_violated"
  | "sec.image_manifest_bypassed"
  | "sec.image_matcher_threshold_violated"
  | "sec.destructive_git_op_attempted"
  | "sec.stage_1a_foundation_modified"
  | "sec.work_map_bypassed"
  // Section-build lifecycle (from feedback memories)
  | "sec.constitutional_auto_rebuild_attempted"
  | "sec.asset_preservation_shortcut"
  // Action scope (ADR-0316a §3.2 · #4/#5/#6/#7)
  | "sec.policy_invention_attempted"
  | "sec.work_map_write_attempted"
  | "sec.sibling_regression_risk"
  | "sec.guardian_bypass_attempted"
  // UI theme (Phase D.3.b · scaffolded here · full check in D.3.b)
  | "sec.ui_dna_violation"
  | "sec.orange_misused"
  | "sec.cyan_misused"
  | "sec.icon_library_violation"
  | "sec.mobile_first_violation"
  | "sec.motion_sensitivity_violation"
  | "sec.gaming_aesthetic_detected"
  | "sec.recognition_test_flagged"
  | "sec.accessibility_violation"
  | "sec.hero_em_dash"
  | "sec.doctrine_violation"
  | "sec.test_deletion_unauthorised"
  | "sec.competing_substrate_attempted";

/**
 * A single rejection produced by the inspection pipeline.
 */
export interface SecurityRejection {
  readonly code: SecurityRejectionCode;
  readonly message: string;
  readonly filePath?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

/**
 * The decision returned by the Security Agent.
 * Decision.accepted=true is a required precondition for downstream
 * promotion · never a signal that code should reach production.
 */
export type SecurityDecision =
  | { readonly accepted: true; readonly rejections: readonly []; readonly runId: string; readonly agentId: AgentIdentity }
  | { readonly accepted: false; readonly rejections: readonly SecurityRejection[]; readonly runId: string; readonly agentId: AgentIdentity };

/**
 * Identity of the agent proposing the code change. Every inspection
 * requires an identity so audit trails carry provenance.
 */
export type AgentIdentity =
  | "nex1"
  | "nex2"
  | "nex3"
  | "master-ai"
  | "founder"
  | "test";

/**
 * A single file touched by a proposed change. The full file paths are
 * evaluated against the file-capability-map. Content is the proposed
 * new content (for pattern-matched doctrine checks).
 */
export interface ProposedFileChange {
  readonly path: string;
  readonly action: "create" | "modify" | "delete" | "rename";
  readonly newContentPreview?: string; // truncated content for pattern check
  readonly renameTo?: string;
}

/**
 * The complete inspection request. Callers submit their proposed
 * change · the Security Agent returns SecurityDecision.
 */
export interface SecurityInspectionRequest {
  readonly agentId: AgentIdentity;
  readonly targetCapabilities: readonly string[]; // CAP-XXX identifiers the caller claims to touch
  readonly changeReason: string; // must reference CAP-XXX
  readonly proposedFiles: readonly ProposedFileChange[];
  readonly proposedAction:
    | { readonly kind: "code_change_only" }
    | { readonly kind: "promote_to_authoritative"; readonly target: string }
    | { readonly kind: "apply_r10_authorisation"; readonly policyRef: string }
    | { readonly kind: "write_production"; readonly schema: string; readonly table: string };
}

/**
 * Growth-ledger row shape (mirrors nex.security_growth_ledger schema).
 * Written on every ACCEPT · never on REJECT (rejections logged elsewhere).
 */
export interface GrowthLedgerEntry {
  readonly runId: string;
  readonly agentId: AgentIdentity;
  readonly capabilitiesTouched: readonly string[];
  readonly filesTouchedCount: number;
  readonly changeReason: string;
  readonly siblingsBoosted: readonly string[];
  readonly invariantsPreserved: readonly string[];
  readonly verdictAt: string; // ISO-8601
}
