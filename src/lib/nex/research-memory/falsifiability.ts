// src/lib/nex/research-memory/falsifiability.ts
//
// UWI · Wave 5 · M20 · Falsifiability discipline
// Founder-authorised programme.
//
// CRII synthesis §5 · every hypothesis must carry:
//   1. predicted_effect (what should happen if the hypothesis is true)
//   2. measurable_outcome (how we would measure it)
//   3. refutation_condition (what would prove the hypothesis false)
//
// If any of the three is missing / vacuous, the item is downgraded to
// an OBSERVATION rather than being accepted as a HYPOTHESIS. This
// prevents unfalsifiable claims from propagating into OPPORTUNITY
// creation and beyond.
//
// Deterministic · pure · no external deps.

import type { FalsifiabilityCheck, FalsifiabilityVerdict } from "./types";

/** Minimum meaningful length for each element · below this = vacuous. */
const MIN_LEN = 12;

/** Vacuous-phrase blocklist · trivially-satisfied placeholders. */
const VACUOUS_PATTERNS = [
  /^(tbd|n\/a|none|unspecified|placeholder|todo|fill in|to be defined)$/i,
  /^(will happen|will occur|will change|will improve|will get better)$/i,
];

function isMissing(v: string | null | undefined): boolean {
  if (!v) return true;
  const trimmed = v.trim();
  if (trimmed.length < MIN_LEN) return true;
  if (VACUOUS_PATTERNS.some(p => p.test(trimmed))) return true;
  return false;
}

/** Assess whether a proposed hypothesis is falsifiable. Pure. */
export function assessFalsifiability(check: FalsifiabilityCheck): FalsifiabilityVerdict {
  const missing: Array<keyof FalsifiabilityCheck> = [];
  if (isMissing(check.predicted_effect)) missing.push("predicted_effect");
  if (isMissing(check.measurable_outcome)) missing.push("measurable_outcome");
  if (isMissing(check.refutation_condition)) missing.push("refutation_condition");

  const is_falsifiable = missing.length === 0;
  return {
    is_falsifiable,
    missing_elements: missing,
    downgrade_recommendation: is_falsifiable ? "keep_as_hypothesis" : "downgrade_to_observation",
  };
}

/** Throws if the assessment is not falsifiable. Insertion-time guard. */
export function assertFalsifiable(check: FalsifiabilityCheck, caller: string): void {
  const verdict = assessFalsifiability(check);
  if (!verdict.is_falsifiable) {
    throw new NotFalsifiableError(caller, verdict.missing_elements);
  }
}

export class NotFalsifiableError extends Error {
  constructor(public readonly caller: string, public readonly missing: ReadonlyArray<string>) {
    super(`Falsifiability discipline violation in '${caller}': missing/vacuous elements [${missing.join(", ")}] — downgrade to observation, do not persist as hypothesis`);
    this.name = "NotFalsifiableError";
  }
}
