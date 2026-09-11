// src/lib/nex/truth-engine/verifier/rules/r-07-connection.ts
//
// R-07 · Connection Plausibility · rule module.
//
// Founder-authorised sub-step 1a.4 · 2026-09-11.
// Doctrine source: ADR-0314a.2.q (STRUCTURE LOCKED · specific per-pair
// criteria PENDING founder authoring) · R-07.v1.0.0 · §7.7 H1 (`unknown`
// ≠ `false` ≠ `contradiction`).
//
// Connection plausibility criteria for concept-pair relationships have
// NOT yet been populated. R-07 returns deterministic UNKNOWN with
// canonical reason `plausibility_check_disabled_pending_criteria`.
//
// IMPORTANT DOCTRINE (preserved from ADR-0314a.2.q):
//   - Missing graph evidence is NOT implausibility.
//   - `no evidence` ≠ `contradiction`.
//   - Absence of a criterion does NOT imply the connection is false.
//   - R-07 must NEVER convert `unknown` to `false` (per §7.7 H1).
//
// When founder authors per-pair criteria, R-07 will evaluate
// deterministically. Amendment requires a founder-authored versioning-policy ADR.

import type { RuleModule, RuleVerdict, VerifierInput } from "../types";
import { CANONICAL_FAIL_CLOSED_REASONS, unknownVerdict } from "../fail-closed";

const RULE_ID = "R-07";
const RULE_VERSION = "R-07.v1.0.0";
const CONNECTION_CRITERIA_VERSION = "connection_criteria.v1.0.0";

export function evaluateR07(input: VerifierInput): RuleVerdict {
  // ADR-0314a.2.q structure is locked · per-pair criteria PENDING founder
  // authoring. Missing graph evidence must NOT be interpreted as
  // implausibility per R-07 doctrine.
  return unknownVerdict(
    RULE_ID,
    RULE_VERSION,
    CANONICAL_FAIL_CLOSED_REASONS.PLAUSIBILITY_CHECK_DISABLED_PENDING_CRITERIA,
    input.evidenceRefs,
    CONNECTION_CRITERIA_VERSION,
  );
}

export const RULE_R07: RuleModule = Object.freeze({
  ruleId: RULE_ID,
  ruleVersion: RULE_VERSION,
  evaluate: evaluateR07,
});
