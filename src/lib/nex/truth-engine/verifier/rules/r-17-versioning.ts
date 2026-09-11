// src/lib/nex/truth-engine/verifier/rules/r-17-versioning.ts
//
// R-17 · Versioning Thresholds and Significance Triggers · rule module.
//
// Founder-authorised sub-step 1a.4 · 2026-09-11.
// Doctrine source: ADR-0314a.2.m (D-17 · founder-authored 2026-09-11 ·
// LOCKED with amendment clause · verbatim) · R-17.v1.0.0.
//
// Founder verbatim (D-17): *"30% is the initial deterministic threshold,
// versioned and measurable, and may later be changed only through an
// explicit versioning-policy ADR. That gives you a starting rule without
// pretending it is mathematically perfect forever."*
//
// The 30% Levenshtein threshold is INITIAL. Master AI does NOT:
//   - Tune the threshold based on observed change rates
//   - Fit the threshold to production data
//   - Lower the threshold to reduce version-row growth
//   - Raise the threshold to reduce noise
// Only founder-authored amendment ADRs can change this value.
//
// Six triggers per ADR-0314a.2.m Section 2:
//   1. Body content change  → 30% Levenshtein (threshold)
//   2. Claim delta          → always fires (no threshold)
//   3. Authority change     → always fires (no threshold)
//   4. Status transition    → always fires (no threshold)
//   5. Domain reclassification → always fires (Guardian-authored only)
//   6. Founder-declared significance → OVERRIDES automatic thresholds

import type { RuleModule, RuleVerdict, VerifierInput } from "../types";
import {
  CANONICAL_FAIL_CLOSED_REASONS,
  failVerdict,
  passVerdict,
  unknownVerdict,
} from "../fail-closed";

const RULE_ID = "R-17";
const RULE_VERSION = "R-17.v1.0.0";
const VERSIONING_THRESHOLD_VERSION = "versioning_threshold.v1.0.0-initial";

/**
 * Founder-authored initial threshold · 30% Levenshtein.
 * Marked const · reassignment forbidden · Guardian rejects tunable variants.
 * Any amendment requires a founder-authored versioning-policy ADR.
 */
export const LEVENSHTEIN_INITIAL_THRESHOLD = 0.3;

/**
 * Levenshtein edit distance (deterministic · language-agnostic).
 * Returns integer edit count.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insert
        prev[j] + 1, // delete
        prev[j - 1] + cost, // substitute
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Normalised Levenshtein · edit_distance / max(len(old), len(new)).
 * Returns 0 for two identical empty strings.
 */
export function normalisedLevenshtein(oldText: string, newText: string): number {
  const denom = Math.max(oldText.length, newText.length);
  if (denom === 0) return 0;
  return levenshtein(oldText, newText) / denom;
}

/**
 * Six-trigger decision per ADR-0314a.2.m Section 2. Any single trigger
 * firing means R-17 records a version create (PASS is the verdict of
 * "correctly determined").
 *
 * Founder-declared significance OVERRIDES thresholds when set to true ·
 * always fires · no threshold to amend.
 */
export interface R17Request {
  readonly oldBody?: string;
  readonly newBody?: string;
  readonly claimDelta?: boolean; // any attribute-tier change
  readonly authorityChange?: boolean;
  readonly statusTransition?: boolean;
  readonly domainReclassification?: boolean;
  readonly founderDeclaredSignificance?: boolean;
}

/**
 * Returns true if any trigger fires. Pure function · deterministic.
 */
export function shouldVersion(req: R17Request): boolean {
  if (req.founderDeclaredSignificance === true) return true; // trigger 6 · override
  if (req.claimDelta === true) return true;
  if (req.authorityChange === true) return true;
  if (req.statusTransition === true) return true;
  if (req.domainReclassification === true) return true;
  if (typeof req.oldBody === "string" && typeof req.newBody === "string") {
    // Trigger 1: 30% Levenshtein on body content
    if (normalisedLevenshtein(req.oldBody, req.newBody) > LEVENSHTEIN_INITIAL_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/**
 * VerifierInput shape expected by R-17:
 *   context.versioning = R17Request
 *
 * When no request supplied · PASS (nothing to evaluate).
 * When request supplied · deterministic PASS regardless of whether a
 * version is triggered · R-17 verdict is about correct trigger evaluation ·
 * NOT about whether a version was created.
 *
 * The `versionShouldFire` decision is returned via candidateFlagPayload
 * so downstream Guardian / persistence can act on it without treating
 * this rule as a promotion mechanism.
 */
export function evaluateR17(input: VerifierInput): RuleVerdict {
  const req = (input.context?.versioning ?? null) as R17Request | null;

  if (req === null) {
    return passVerdict(RULE_ID, RULE_VERSION, input.evidenceRefs, VERSIONING_THRESHOLD_VERSION);
  }

  // Fail-closed on malformed input structure · never infer.
  if (typeof req !== "object") {
    return unknownVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.VERSIONING_DISABLED_PENDING_THRESHOLDS,
      input.evidenceRefs,
      VERSIONING_THRESHOLD_VERSION,
    );
  }

  // Fail if body strings are wrong-typed (non-string non-undefined).
  const oldBad = req.oldBody !== undefined && typeof req.oldBody !== "string";
  const newBad = req.newBody !== undefined && typeof req.newBody !== "string";
  if (oldBad || newBad) {
    return failVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.VERSIONING_DISABLED_PENDING_THRESHOLDS,
      input.evidenceRefs,
      VERSIONING_THRESHOLD_VERSION,
    );
  }

  const fire = shouldVersion(req);

  // Deterministic PASS · candidateFlagPayload carries the decision.
  return {
    ruleId: RULE_ID,
    ruleVersion: RULE_VERSION,
    verdict: "PASS",
    reason: null,
    evidenceRefs: input.evidenceRefs,
    thresholdVersion: VERSIONING_THRESHOLD_VERSION,
    candidateFlagPayload: Object.freeze({
      versionShouldFire: fire,
      thresholdApplied: LEVENSHTEIN_INITIAL_THRESHOLD,
    }),
  };
}

export const RULE_R17: RuleModule = Object.freeze({
  ruleId: RULE_ID,
  ruleVersion: RULE_VERSION,
  evaluate: evaluateR17,
});
