// src/lib/nex/truth-engine/verifier/rules/r-12-classification.ts
//
// R-12 · Classification Taxonomy · rule module.
//
// Founder-authorised sub-step 1a.4 · 2026-09-11.
// Doctrine source: ADR-0314a.2.k (STRUCTURE LOCKED · per-Domain enum
// values PENDING founder authoring) · R-12.v1.0.0 · §7.4 C1 (Shared
// cross-Domain Activity Category · applicable_domains pattern) · §7.7 H1
// (`other` axis-specific catch-all).
//
// Per-Domain Category enum values have NOT yet been populated. R-12
// returns deterministic UNKNOWN with canonical reason
// `classification_taxonomy_version=pending`.
//
// DOCTRINE (preserved from ADR-0314a.2.k):
//   - Guardian rejects any classification value not in the founder-authored enum.
//   - `other` is permitted at Category axis ONLY when parent taxonomy
//     explicitly authors it (per §7.7 H1 axis-specific).
//   - Rule MUST fail closed for unknown / unrecognised classification values.
//
// When founder authors per-Domain enum values, R-12 will evaluate
// deterministically. Amendment requires a founder-authored versioning-policy ADR.

import type { RuleModule, RuleVerdict, VerifierInput } from "../types";
import { CANONICAL_FAIL_CLOSED_REASONS, unknownVerdict } from "../fail-closed";

const RULE_ID = "R-12";
const RULE_VERSION = "R-12.v1.0.0";
const TAXONOMY_VERSION = "classification_taxonomy.v1.0.0";

export function evaluateR12(input: VerifierInput): RuleVerdict {
  // ADR-0314a.2.k structure is locked · per-Domain enum values PENDING
  // founder authoring. Master AI does NOT invent Category enum values.
  // Return deterministic UNKNOWN.
  return unknownVerdict(
    RULE_ID,
    RULE_VERSION,
    CANONICAL_FAIL_CLOSED_REASONS.CLASSIFICATION_TAXONOMY_VERSION_PENDING,
    input.evidenceRefs,
    TAXONOMY_VERSION,
  );
}

export const RULE_R12: RuleModule = Object.freeze({
  ruleId: RULE_ID,
  ruleVersion: RULE_VERSION,
  evaluate: evaluateR12,
});
