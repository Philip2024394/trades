// src/lib/nex/truth-engine/guardian/types.ts
//
// Truth Engine Guardian · Stage 1a sub-step 1a.5 · core types.
//
// Founder-authorised sub-step 1a.5 · 2026-09-11.
// Doctrine: Guardian is a DETERMINISTIC GATE, NEVER an authority source.
// Guardian enforces already-locked ADR policy (0314a.2.n · .j · .l · .m ·
// 0314e · §7.7 H1 · R-DOMAIN-01) at the boundary between verifier output
// and downstream substrate. Guardian:
//
//   - CANNOT convert UNKNOWN into PASS
//   - CANNOT convert FAIL into PASS
//   - CANNOT create constitutional policy
//   - CANNOT invent thresholds · taxonomy · relationships · authority
//     sources · contradiction criteria
//   - CANNOT promote to AUTHORITATIVE
//   - CANNOT execute R-10 authorisation
//   - CANNOT write production `nex.*`
//   - CANNOT write `nex_lab_*`
//   - CANNOT write `nex_test.*` (Stage 1a preserves fixture-only posture)
//
// Guardian INSPECTS. It returns ACCEPT or REJECT with named codes.
// Callers act on the decision. Guardian itself does not mutate anything.

import type { VerdictEnvelope } from "../verifier/types";

/**
 * Rejection codes emitted by Guardian. Canonical · deterministic. Every
 * REJECT decision carries at least one rejection with a canonical code.
 * Codes are enforced enum values · Guardian does not fabricate codes.
 */
export type GuardianRejectionCode =
  // R-18 envelope invariants
  | "envelope_missing_verifier_instance_id"
  | "envelope_missing_rule_set_version"
  | "envelope_missing_guardian_version"
  | "envelope_missing_object_snapshot_ref"
  | "envelope_verdict_at_malformed"
  // Rule ledger invariants
  | "rule_id_mismatch"
  | "rule_version_mismatch"
  | "rule_id_duplicated_in_verdicts"
  | "unknown_verdict_missing_reason"        // §7.7 H1
  | "fail_verdict_missing_reason"           // §7.7 H1
  | "reason_not_canonical"                  // non-CANONICAL_FAIL_CLOSED_REASONS
  | "verdict_kind_invalid"
  // Aggregate invariants
  | "truth_engine_ok_recompute_mismatch"    // stated ≠ recomputed
  | "unknown_to_pass_conversion_detected"   // silent promotion attempt
  | "fail_to_pass_conversion_detected"      // silent promotion attempt
  // Stage-1a authorisation invariants
  | "authorisation_policy_ref_non_null_at_stage_1a"  // R-10 belongs to Stage 2
  | "promotion_attempted_authoritative_forbidden"
  | "r10_authorisation_attempted_stage_2_only"
  // Substrate isolation invariants
  | "production_nex_write_attempted"
  | "nex_lab_write_attempted"
  | "nex_test_write_attempted_stage_1a"     // Stage 1a preserves fixture-only
  // Constitutional invention forbidden
  | "policy_invention_attempted"
  | "threshold_invention_attempted"
  | "taxonomy_invention_attempted"
  | "relationship_invention_attempted"
  | "authority_invention_attempted"
  | "contradiction_criterion_invention_attempted";

export interface GuardianRejection {
  readonly code: GuardianRejectionCode;
  readonly message: string;
  readonly ruleId?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export type GuardianDecision =
  | { readonly accepted: true; readonly rejections: readonly [] }
  | { readonly accepted: false; readonly rejections: readonly GuardianRejection[] };

/**
 * A proposed post-verifier action that Guardian inspects. Guardian rejects
 * any action outside its scope (promotion · R-10 · production write).
 *
 * NOTE: Guardian does not EXECUTE actions. It only INSPECTS proposed
 * actions. Callers submit an intent envelope; Guardian returns a
 * decision; callers act accordingly. Guardian never writes.
 */
export type GuardianAction =
  | { readonly kind: "envelope_only" }
  | { readonly kind: "promote_to_authoritative"; readonly target: string }
  | { readonly kind: "apply_r10_authorisation"; readonly policyRef: string }
  | { readonly kind: "write_production"; readonly schema: "nex" | "nex_lab" | "nex_test"; readonly table: string };

export interface GuardianInspectionRequest {
  readonly envelope: VerdictEnvelope;
  readonly action: GuardianAction;
}

export interface GuardianConfig {
  /** Guardian identity string · matches envelope.guardianVersion when valid. */
  readonly guardianVersion: string;
  /** Expected verifier instance IDs · empty array = any (Stage 1a). */
  readonly expectedVerifierInstanceIds?: readonly string[];
  /** Whether nex_test.* writes are permitted (Stage 1a: false · Stage 1b: true). */
  readonly nexTestWritesPermitted: boolean;
}
