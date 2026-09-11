// src/lib/nex/truth-engine/verifier/rules/r-13-relationship.ts
//
// R-13 · Relationship Vocabulary · rule module.
//
// Founder-authorised sub-step 1a.4 · 2026-09-11.
// Doctrine source: ADR-0314a.2.l (8-VALUE BASELINE RATIFIED · Bridge/
// Activity extensions PENDING founder authoring) · R-13.v1.0.0 · §7.6.5
// G4 · §7.4 C1.
//
// Founder-ratified 8-value baseline (verbatim from ADR-0314a.2.l
// Section 2). Extensions require explicit founder-authored ADR (Bridge
// relations · Activity-relation extensions).
//
// Guardian rejects any relation_kind NOT in this baseline (until
// extensions authored). Master AI does NOT expand the vocabulary.

import type { RuleModule, RuleVerdict, VerifierInput } from "../types";
import {
  CANONICAL_FAIL_CLOSED_REASONS,
  failVerdict,
  passVerdict,
} from "../fail-closed";

const RULE_ID = "R-13";
const RULE_VERSION = "R-13.v1.0.0";
const VOCAB_VERSION = "relationship_vocabulary.v1.0.0-baseline";

/**
 * Founder-ratified 8-value baseline · verbatim from ADR-0314a.2.l Section 2.
 * Also enforced by migration `006_nex_english_brain_v1.sql` CHECK constraint.
 */
export type RelationKind =
  | "synonym"
  | "antonym"
  | "hypernym"
  | "hyponym"
  | "related"
  | "domain_of"
  | "derived_from"
  | "part_of";

const FOUNDER_RATIFIED_BASELINE: readonly RelationKind[] = Object.freeze([
  "synonym",
  "antonym",
  "hypernym",
  "hyponym",
  "related",
  "domain_of",
  "derived_from",
  "part_of",
]);

function isRegisteredKind(v: unknown): v is RelationKind {
  return (
    typeof v === "string" &&
    (FOUNDER_RATIFIED_BASELINE as readonly string[]).includes(v)
  );
}

/**
 * VerifierInput shape expected by R-13:
 *   context.relationship = { relationKind: "synonym" }   // string or missing
 *
 * If no relationship request supplied → PASS (nothing to evaluate).
 * If supplied and value is one of the 8 baseline values → PASS.
 * Otherwise → FAIL with reason `unregistered_relation_kind` (Guardian
 * rejects unregistered values until extensions are founder-authored).
 */
export function evaluateR13(input: VerifierInput): RuleVerdict {
  const req = (input.context?.relationship ?? null) as
    | { relationKind?: unknown }
    | null;

  if (req === null || req.relationKind === undefined) {
    return passVerdict(RULE_ID, RULE_VERSION, input.evidenceRefs, VOCAB_VERSION);
  }

  if (!isRegisteredKind(req.relationKind)) {
    return failVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.UNREGISTERED_RELATION_KIND,
      input.evidenceRefs,
      VOCAB_VERSION,
    );
  }

  return passVerdict(RULE_ID, RULE_VERSION, input.evidenceRefs, VOCAB_VERSION);
}

export const RULE_R13: RuleModule = Object.freeze({
  ruleId: RULE_ID,
  ruleVersion: RULE_VERSION,
  evaluate: evaluateR13,
});

/** Exposed for tests / audit · read-only frozen copy. */
export const R13_BASELINE = FOUNDER_RATIFIED_BASELINE;
