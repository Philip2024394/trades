// patternRegistry — types.
//
// STAGE 2 of the Business Evidence Framework.
// A pattern is an aggregated conclusion drawn from multiple pieces
// of evidence. It is NOT a raw finding.
//
// Example:
//   "82% of high-performing carpenter Ireland websites specialising
//    in doors place project galleries before pricing."
//
// A pattern is only useful once it has enough underlying proven
// evidence. Confidence is DERIVED from the evidence, never
// hand-set. That's the honesty guarantee.

import type { EvidenceScope } from "../evidence/types";

/** Where a pattern is in its lifecycle from candidate to canon. */
export type PatternCandidacyStatus =
  | "proposed"        // extracted, not yet reviewed
  | "adopted"         // baked into at least one playbook
  | "rejected"        // reviewed and rejected
  | "superseded";     // replaced by a stronger pattern

export type PatternManifest = {
  manifestVersion: 1;
  slug: string;
  /** Short human title. */
  title: string;
  /** The pattern statement — MUST be structured, quantified where
   *  possible. Free text OK but avoid weasel words. */
  statement: string;
  version: string;

  /** Which businesses this pattern applies to. */
  scope: EvidenceScope;

  /** Which facet kind(s) this pattern informs. Patterns without a
   *  facet mapping are informational — they can inform playbook
   *  RATIONALE without directly contributing a facet. */
  informsFacetKinds?: readonly string[];

  /** Evidence slugs supporting this pattern. */
  supportingEvidence: readonly string[];

  /** Pattern lifecycle. */
  candidacy: {
    status: PatternCandidacyStatus;
    /** ISO 8601 timestamp of last change. */
    lastStateChangeAt: string;
    /** Playbook slug(s) this pattern is baked into (populated when
     *  status = "adopted"). */
    adoptedByPlaybooks?: readonly string[];
    /** If superseded, the pattern that replaced it. */
    supersededBy?: string;
    /** Reviewer notes. */
    notes?: string;
  };

  /** Author-declared quantification, if the pattern includes one. */
  quantification?: {
    percentage?: number;             // "82%"
    sampleSize?: number;              // "of 45 sites analysed"
    delta?: number;                   // "+18% conversion"
    unit?: string;                    // "%", "sec", "£"
  };

  /** Free-text tags. */
  tags?: readonly string[];

  publisher?: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };
};

export type FrozenPatternManifest = Readonly<PatternManifest>;

/** Bands used when translating derived confidence into merchant-facing
 *  words. */
export type EvidenceStrengthBand =
  | "insufficient"
  | "emerging"
  | "moderate"
  | "high"
  | "very-high";

export function bandForConfidence(confidence: number): EvidenceStrengthBand {
  if (confidence < 25) return "insufficient";
  if (confidence < 50) return "emerging";
  if (confidence < 70) return "moderate";
  if (confidence < 85) return "high";
  return "very-high";
}
