// src/lib/nex/truth-engine/verifier/rules/index.ts
//
// Public re-export of all 10 R-XX rule modules · Stage 1a sub-step 1a.4.
// Founder-authorised 2026-09-11.
//
// Rule status summary (ADR provenance):
//   R-01  populated       · ADR-0314a.2.n · 14 founder-authored thresholds
//   R-03  pending values  · ADR-0317      · returns UNKNOWN
//   R-05  pending values  · ADR-0314a.2.p · returns UNKNOWN
//   R-07  pending values  · ADR-0314a.2.q · returns UNKNOWN
//   R-11  populated       · ADR-0314a.2.j · 6-band + unknown sentinel
//   R-12  pending values  · ADR-0314a.2.k · returns UNKNOWN
//   R-13  populated       · ADR-0314a.2.l · 8-value baseline
//   R-17  populated       · ADR-0314a.2.m · 30% Levenshtein initial
//   R-18  populated       · ADR-0314e     · envelope audit
//   R-20  pending values  · ADR-0314a.2.r · returns UNKNOWN

export { RULE_R01, R01_THRESHOLDS, evaluateR01 } from "./r-01-plausibility";
export { RULE_R03, evaluateR03 } from "./r-03-voice";
export { RULE_R05, evaluateR05 } from "./r-05-authority";
export { RULE_R07, evaluateR07 } from "./r-07-connection";
export {
  RULE_R11,
  R11_BANDS,
  deriveBand,
  evaluateR11,
} from "./r-11-confidence";
export type { ConfidenceBand } from "./r-11-confidence";
export { RULE_R12, evaluateR12 } from "./r-12-classification";
export {
  RULE_R13,
  R13_BASELINE,
  evaluateR13,
} from "./r-13-relationship";
export type { RelationKind } from "./r-13-relationship";
export {
  RULE_R17,
  LEVENSHTEIN_INITIAL_THRESHOLD,
  levenshtein,
  normalisedLevenshtein,
  shouldVersion,
  evaluateR17,
} from "./r-17-versioning";
export type { R17Request } from "./r-17-versioning";
export { RULE_R18, evaluateR18 } from "./r-18-envelope";
export { RULE_R20, evaluateR20 } from "./r-20-contradiction";

import { RULE_R01 } from "./r-01-plausibility";
import { RULE_R03 } from "./r-03-voice";
import { RULE_R05 } from "./r-05-authority";
import { RULE_R07 } from "./r-07-connection";
import { RULE_R11 } from "./r-11-confidence";
import { RULE_R12 } from "./r-12-classification";
import { RULE_R13 } from "./r-13-relationship";
import { RULE_R17 } from "./r-17-versioning";
import { RULE_R18 } from "./r-18-envelope";
import { RULE_R20 } from "./r-20-contradiction";
import type { RuleModule } from "../types";

/**
 * All 10 rule modules in canonical order. Ordering is preserved but does
 * not doctrinally constrain execution order (per R-10 gate-model 2026-09-11).
 *
 * Callers that want the full Stage 1a rule set pass `ALL_RULES` to
 * `createVerifier({ rules: ALL_RULES })`.
 */
export const ALL_RULES: readonly RuleModule[] = Object.freeze([
  RULE_R01,
  RULE_R03,
  RULE_R05,
  RULE_R07,
  RULE_R11,
  RULE_R12,
  RULE_R13,
  RULE_R17,
  RULE_R18,
  RULE_R20,
]);
