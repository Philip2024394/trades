// src/lib/nex/truth-engine/verifier/rules/r-03-voice.ts
//
// R-03 · NEX Voice Mandate · rule module.
//
// Founder-authorised sub-step 1a.4 · 2026-09-11.
// Doctrine source: ADR-0317 (STRUCTURE LOCKED · specific voice guidelines
// PENDING founder authoring) · R-03.v1.0.0 · §7.7 H1.
//
// Founder-authorised voice guidelines have NOT yet been populated.
// Therefore R-03 returns deterministic UNKNOWN with canonical reason
// `voice_check_disabled_pending_mandate`. It does NOT infer voice
// guidelines · does NOT invoke an LLM · does NOT let an LLM voice
// judgement become a final constitutional verdict.
//
// When founder authors ADR-0317 voice guideline values, R-03 will
// evaluate deterministically. Amendment requires a founder-authored
// versioning-policy ADR.

import type { RuleModule, RuleVerdict, VerifierInput } from "../types";
import { CANONICAL_FAIL_CLOSED_REASONS, unknownVerdict } from "../fail-closed";

const RULE_ID = "R-03";
const RULE_VERSION = "R-03.v1.0.0";
const VOICE_MANDATE_VERSION = "voice_mandate.v1.0.0";

export function evaluateR03(input: VerifierInput): RuleVerdict {
  // ADR-0317 structure is locked · specific guidelines PENDING founder
  // authoring. Return deterministic UNKNOWN. LLM voice judgement is
  // explicitly forbidden as a substitute per founder directive.
  return unknownVerdict(
    RULE_ID,
    RULE_VERSION,
    CANONICAL_FAIL_CLOSED_REASONS.VOICE_CHECK_DISABLED_PENDING_MANDATE,
    input.evidenceRefs,
    VOICE_MANDATE_VERSION,
  );
}

export const RULE_R03: RuleModule = Object.freeze({
  ruleId: RULE_ID,
  ruleVersion: RULE_VERSION,
  evaluate: evaluateR03,
});
