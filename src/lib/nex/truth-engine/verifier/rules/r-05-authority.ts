// src/lib/nex/truth-engine/verifier/rules/r-05-authority.ts
//
// R-05 · External Authority Registry · rule module.
//
// Founder-authorised sub-step 1a.4 · 2026-09-11.
// Doctrine source: ADR-0314a.2.p (STRUCTURE LOCKED · registry entries
// PENDING founder authoring) · R-05.v1.0.0.
//
// External-authority registry entries have NOT yet been populated. R-05
// returns deterministic UNKNOWN with canonical reason
// `authority_check_disabled_pending_registry`.
//
// IMPORTANT DOCTRINE: Registry membership is EVIDENCE ELIGIBILITY ONLY.
// R-05 does NOT bypass · replace · or short-circuit:
//   - Truth Engine evaluation
//   - Provenance requirements
//   - Contradiction detection (R-20)
//   - Confidence scoring (R-11)
//   - Authority chain rules
//
// A registered authority provides source evidence · not verdict promotion.
// Non-registered sources fail-closed per doctrine.

import type { RuleModule, RuleVerdict, VerifierInput } from "../types";
import { CANONICAL_FAIL_CLOSED_REASONS, unknownVerdict } from "../fail-closed";

const RULE_ID = "R-05";
const RULE_VERSION = "R-05.v1.0.0";
const AUTHORITY_REGISTRY_VERSION = "external_authority_registry.v1.0.0";

export function evaluateR05(input: VerifierInput): RuleVerdict {
  // ADR-0314a.2.p structure is locked · registry entries PENDING founder
  // authoring. Master AI does NOT infer authorities. Return deterministic
  // UNKNOWN.
  return unknownVerdict(
    RULE_ID,
    RULE_VERSION,
    CANONICAL_FAIL_CLOSED_REASONS.AUTHORITY_CHECK_DISABLED_PENDING_REGISTRY,
    input.evidenceRefs,
    AUTHORITY_REGISTRY_VERSION,
  );
}

export const RULE_R05: RuleModule = Object.freeze({
  ruleId: RULE_ID,
  ruleVersion: RULE_VERSION,
  evaluate: evaluateR05,
});
