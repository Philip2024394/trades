// src/lib/nex/truth-engine/verifier/fail-closed.ts
//
// Truth Engine Verifier · Stage 1a · Fail-closed helpers.
//
// Founder-authorised sub-step 1a.3 · 2026-09-11.
// Doctrine: §7.7 H1 (`other` ≠ `unknown`) + §7.6.5 G4 (Activity ≠ Domain ·
// R-07 unknown ≠ false ≠ contradiction) + individual R-XX fail-closed
// clauses locked in their companion ADRs.
//
// This file provides SHARED HELPERS for rule modules to construct
// fail-closed RuleVerdicts with NAMED reason strings per §7.7 H1. No
// rule module fabricates a reason string · every reason is drawn from
// the CANONICAL_FAIL_CLOSED_REASONS enum below.
//
// Guardian violation: any rule module producing an UNKNOWN or FAIL
// verdict with `reason=null` is a §7.7 H1 violation (unnamed fail-closed).

import type { RuleVerdict } from "./types";

/**
 * Canonical fail-closed reason strings.
 *
 * Each string corresponds to a locked ADR clause. Rule modules SHOULD
 * use exactly these strings when producing UNKNOWN / FAIL verdicts.
 *
 * Adding a new reason requires an explicit founder-authored ADR
 * amendment (per D-17 amendment pattern generalised).
 */
export const CANONICAL_FAIL_CLOSED_REASONS = {
  // R-01 plausibility · ADR-0314a.2.n
  PLAUSIBILITY_CHECK_DISABLED_PENDING_THRESHOLDS:
    "plausibility_check_disabled_pending_thresholds",
  PLAUSIBILITY_CHECK_FAILED: "plausibility_check_failed",

  // R-03 voice · ADR-0317
  VOICE_CHECK_DISABLED_PENDING_MANDATE: "voice_check_disabled_pending_mandate",
  VOICE_CHECK_FAILED: "voice_check_failed",

  // R-05 authority · ADR-0314a.2.p
  AUTHORITY_CHECK_DISABLED_PENDING_REGISTRY:
    "authority_check_disabled_pending_registry",
  UNREGISTERED_AUTHORITY: "unregistered_authority",

  // R-07 connection · ADR-0314a.2.q · NEVER `false` · NEVER `contradiction`
  PLAUSIBILITY_CHECK_DISABLED_PENDING_CRITERIA:
    "plausibility_check_disabled_pending_criteria",

  // R-11 confidence · ADR-0314a.2.j
  CONFIDENCE_SCORE_OUT_OF_RANGE: "confidence_score_out_of_range",
  BAND_DRIFT_DETECTED: "band_drift_detected",
  UNKNOWN_SCORE_CANNOT_PROMOTE: "unknown_score_cannot_promote",

  // R-12 classification · ADR-0314a.2.k
  CLASSIFICATION_TAXONOMY_VERSION_PENDING:
    "classification_taxonomy_version=pending",
  UNREGISTERED_CLASSIFICATION_VALUE: "unregistered_classification_value",

  // R-13 relationships · ADR-0314a.2.l
  RELATIONSHIP_VOCABULARY_VERSION_PENDING:
    "relationship_vocabulary_version=pending",
  UNREGISTERED_RELATION_KIND: "unregistered_relation_kind",

  // R-17 versioning · ADR-0314a.2.m · D-17
  VERSIONING_DISABLED_PENDING_THRESHOLDS:
    "versioning_disabled_pending_thresholds",

  // R-18 verifier envelope
  MISSING_VERIFIER_INSTANCE_ID: "missing_verifier_instance_id",
  MISSING_RULE_SET_VERSION: "missing_rule_set_version",

  // R-20 contradiction · ADR-0314a.2.r · NEVER `contradiction` when unauthored
  CROSS_RECORD_DETECTION_PENDING_RULES:
    "cross_record_detection_pending_rules",

  // Cross-substrate · ADR-0314c
  BRIDGE_UNRESOLVABLE: "bridge_unresolvable",

  // Anti-substitution (R-DOMAIN-01 · §7.3-B1 · §7.7 H1)
  AXIS_SUBSTITUTION_VIOLATION: "axis_substitution_violation",
  ZERO_AS_UNKNOWN_PROXY_FORBIDDEN: "zero_as_unknown_proxy_forbidden",
} as const;

export type CanonicalFailClosedReason =
  (typeof CANONICAL_FAIL_CLOSED_REASONS)[keyof typeof CANONICAL_FAIL_CLOSED_REASONS];

/**
 * Construct an UNKNOWN verdict with a named canonical reason. Guardian
 * rejects any UNKNOWN with a null / non-canonical reason per §7.7 H1.
 */
export function unknownVerdict(
  ruleId: string,
  ruleVersion: string,
  reason: CanonicalFailClosedReason,
  evidenceRefs: readonly string[] = [],
  thresholdVersion?: string,
): RuleVerdict {
  return {
    ruleId,
    ruleVersion,
    verdict: "UNKNOWN",
    reason,
    evidenceRefs,
    thresholdVersion,
  };
}

/**
 * Construct a FAIL verdict with a named canonical reason.
 * FAIL is distinct from UNKNOWN (per §7.7 H1 · silent conversion forbidden).
 */
export function failVerdict(
  ruleId: string,
  ruleVersion: string,
  reason: CanonicalFailClosedReason,
  evidenceRefs: readonly string[] = [],
  thresholdVersion?: string,
): RuleVerdict {
  return {
    ruleId,
    ruleVersion,
    verdict: "FAIL",
    reason,
    evidenceRefs,
    thresholdVersion,
  };
}

/**
 * Construct a PASS verdict. No reason string required (reason=null is
 * legitimate when verdict=PASS · but Guardian rules elsewhere may still
 * require a reason for auditability).
 */
export function passVerdict(
  ruleId: string,
  ruleVersion: string,
  evidenceRefs: readonly string[] = [],
  thresholdVersion?: string,
): RuleVerdict {
  return {
    ruleId,
    ruleVersion,
    verdict: "PASS",
    reason: null,
    evidenceRefs,
    thresholdVersion,
  };
}
