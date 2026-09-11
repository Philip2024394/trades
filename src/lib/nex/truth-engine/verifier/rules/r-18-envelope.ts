// src/lib/nex/truth-engine/verifier/rules/r-18-envelope.ts
//
// R-18 · Verifier / Audit Envelope · rule module.
//
// Founder-authorised sub-step 1a.4 · 2026-09-11.
// Doctrine source: ADR-0314e Section 4 (verifier envelope requirement) ·
// R-18.v1.0.0.
//
// R-18 is an ENVELOPE / AUDIT rule. It verifies that verifier envelope
// requirements are satisfiable from the input context:
//   - `verifier_instance_id` present at construction (enforced already at
//     Verifier construction · R-18 rule verifies context declares its
//     participation)
//   - Object snapshot ref present
//
// R-18 is NEVER a promotion mechanism. R-18 PASS does not authorise
// AUTHORITATIVE writes. Only R-10 (Stage 2) does. R-18 attests to the
// integrity of the envelope only.
//
// If either invariant is absent from the input, R-18 fails-closed with
// the canonical reason (`missing_verifier_instance_id` where relevant).

import type { RuleModule, RuleVerdict, VerifierInput } from "../types";
import {
  CANONICAL_FAIL_CLOSED_REASONS,
  failVerdict,
  passVerdict,
} from "../fail-closed";

const RULE_ID = "R-18";
const RULE_VERSION = "R-18.v1.0.0";

/**
 * VerifierInput audit check:
 *   - objectSnapshotRef non-empty
 *   - evidenceRefs is an array
 *
 * Verifier-instance-id is enforced at Verifier construction time · this
 * rule attests that the input carries a bindable snapshot reference. The
 * envelope's verifier_instance_id, rule_set_version, guardian_version are
 * populated by `buildEnvelope()` deterministically · this rule verifies
 * the input side of the audit trail.
 */
export function evaluateR18(input: VerifierInput): RuleVerdict {
  if (
    typeof input.objectSnapshotRef !== "string" ||
    input.objectSnapshotRef.length === 0
  ) {
    return failVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.MISSING_VERIFIER_INSTANCE_ID,
      input.evidenceRefs,
    );
  }
  if (!Array.isArray(input.evidenceRefs)) {
    return failVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.MISSING_RULE_SET_VERSION,
      [],
    );
  }
  return passVerdict(RULE_ID, RULE_VERSION, input.evidenceRefs);
}

export const RULE_R18: RuleModule = Object.freeze({
  ruleId: RULE_ID,
  ruleVersion: RULE_VERSION,
  evaluate: evaluateR18,
});
