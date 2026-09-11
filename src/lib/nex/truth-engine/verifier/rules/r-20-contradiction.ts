// src/lib/nex/truth-engine/verifier/rules/r-20-contradiction.ts
//
// R-20 · Contradiction Detection · rule module.
//
// Founder-authorised sub-step 1a.4 · 2026-09-11.
// Doctrine source: ADR-0314a.2.r (STRUCTURE + FORBIDDEN-BASES LOCKED ·
// specific per-attribute rules PENDING founder authoring) · R-20.v1.0.0
// · §7.7 H1 (`unknown` ≠ `contradiction`) · ADR-0314c (Cross-Substrate).
//
// Per-attribute contradiction rules have NOT yet been populated. R-20
// returns deterministic UNKNOWN with canonical reason
// `cross_record_detection_pending_rules`.
//
// LOCKED FORBIDDEN BASES (from ADR-0314a.2.r · Master AI must NOT flag
// these as contradiction until founder authors a per-attribute rule):
//   - Wording difference (linguistic phrasing) ≠ contradiction
//   - Scope difference (partial overlap · different resolution) ≠ contradiction
//   - Missing information ≠ contradiction
//   - Difference alone ≠ contradiction (delta ≠ conflict)
//   - `unknown` value ≠ `contradiction`
//
// Only founder-authored per-attribute contradiction specifications
// (Stage-later ADR) can promote a delta to CONTRADICTION_RECORDED.
// Until then · R-20 fails-closed with UNKNOWN.

import type { RuleModule, RuleVerdict, VerifierInput } from "../types";
import { CANONICAL_FAIL_CLOSED_REASONS, unknownVerdict } from "../fail-closed";

const RULE_ID = "R-20";
const RULE_VERSION = "R-20.v1.0.0";
const CONTRADICTION_VERSION = "contradiction_rules.v1.0.0";

export function evaluateR20(input: VerifierInput): RuleVerdict {
  // ADR-0314a.2.r structure + forbidden bases LOCKED · per-attribute
  // rules PENDING founder authoring. Master AI does NOT invent
  // contradiction rules. Return deterministic UNKNOWN.
  //
  // Preserves §7.7 H1: `unknown` never silently becomes `contradiction`.
  return unknownVerdict(
    RULE_ID,
    RULE_VERSION,
    CANONICAL_FAIL_CLOSED_REASONS.CROSS_RECORD_DETECTION_PENDING_RULES,
    input.evidenceRefs,
    CONTRADICTION_VERSION,
  );
}

export const RULE_R20: RuleModule = Object.freeze({
  ruleId: RULE_ID,
  ruleVersion: RULE_VERSION,
  evaluate: evaluateR20,
});
