// src/lib/nex/theme-brain/capability-validator.ts
//
// Validates whether a VocabularySelection fully expresses the intent
// or whether the intent requires vocabulary the Engine does not
// currently support · in which case the Brain emits a
// missing_capability result rather than inventing a token.
//
// Load-bearing: the Brain MUST NEVER silently invent engine
// vocabulary. If a gap exists, this validator exposes it.

import type { CapabilityGap } from "./intent";
import type { VocabularySelection } from "./vocabulary-selector";

export interface ValidationReport {
  readonly fullyExpressible: boolean;
  readonly gaps: readonly CapabilityGap[];
}

export function validateSelection(
  selection: VocabularySelection,
): ValidationReport {
  // In Phase 1 the selector already attaches detected gaps. The
  // validator's job is to codify the rule: ANY gap means the result
  // is a missing_capability · not a package_proposal.
  return {
    fullyExpressible: selection.gaps.length === 0,
    gaps: selection.gaps,
  };
}
