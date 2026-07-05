// evidenceRegistry — types.
//
// STAGE 1 of the Business Evidence Framework.
// One entry = one atomic observation. Structured, not free text.
//
// Evidence is the RAW input to the loop:
//   evidence → pattern → playbook → recipe → resolved strategy →
//   website → measured outcome → evidence.
//
// Findings enter as `draft` and can only meaningfully raise playbook
// confidence once they reach `proven`. That prevents cargo-culting
// bad advice from a single successful competitor.

export type EvidenceSourceKind =
  | "competitor-research"
  | "merchant-interview"
  | "a-b-test"
  | "measured-outcome"
  | "industry-report"
  | "academic-study"
  | "expert-opinion"
  | "internal-analysis";

/** Validation lifecycle — only Proven materially boosts confidence. */
export type EvidenceValidationState =
  | "draft"
  | "reviewed"
  | "approved"
  | "a-b-tested"
  | "measured"
  | "proven";

/** Scope — which businesses this finding applies to. Same shape used
 *  across evidence, patterns, and playbook applicability so filters
 *  compose cleanly. */
export type EvidenceScope = {
  /** Trade slugs. `["*"]` = any trade. */
  trades: readonly string[];
  /** ISO 3166 alpha-2 country codes. `["*"]` = any country. */
  countries: readonly string[];
  /** Business goal slugs (matches growthStrategyRegistry). */
  goals?: readonly string[];
  /** Profile flags (emergency / luxury / commercial / residential / premium / budget). */
  profileFlags?: readonly string[];
};

/** A single reviewer's decision on this finding. */
export type EvidenceReview = {
  reviewer: string;                    // person / handle
  reviewedAt: string;                  // ISO 8601
  decision: "approved" | "rejected" | "requested-changes";
  notes?: string;
};

/** Numeric measurement associated with a finding (optional). */
export type EvidenceMetric = {
  metric: string;                      // "gallery_before_pricing_rate", "cta_click_through", etc.
  value: number;
  unit?: string;                       // "%", "seconds", "£", etc.
  sampleSize?: number;
  confidenceInterval?: { low: number; high: number };
};

export type EvidenceFindingManifest = {
  manifestVersion: 1;
  slug: string;
  /** Short human title — used in reviewer UIs + explainer. */
  title: string;
  /** The observation itself, in structured plain English. */
  observation: string;
  version: string;

  /** Where this finding came from. */
  source: {
    kind: EvidenceSourceKind;
    /** Free-text citation — URL / paper / interview date / test id. */
    citation: string;
    /** Who collected it. */
    collectedBy: string;
    /** ISO 8601 date. */
    collectedAt: string;
    /** Whether the collection can be reproduced (has methodology). */
    reproducible: boolean;
  };

  /** Which businesses this applies to. */
  scope: EvidenceScope;

  /** What page / surface this finding relates to. */
  pageContext?: "home" | "service" | "gallery" | "pricing" | "contact" | "booking" | "checkout" | "any";

  /** Which facet(s) this finding informs. Kept as raw slugs to avoid
   *  a hard dependency on facetKindRegistry ordering at load time —
   *  patterns validate this. */
  informsFacetKinds?: readonly string[];

  /** Which playbook slug(s) this finding supports. Populated when a
   *  finding is explicitly wired into a playbook. */
  supportsPlaybooks?: readonly string[];

  /** Optional numeric measurement. */
  measurement?: EvidenceMetric;

  /** Validation lifecycle. */
  validation: {
    state: EvidenceValidationState;
    /** How many independent instances corroborate this finding.
     *  N=1 with source=competitor-research is a suggestion, not a
     *  law. */
    corroborationCount: number;
    /** Reviewer audit trail. */
    reviews: readonly EvidenceReview[];
    /** ISO 8601 timestamp of last state change. */
    lastStateChangeAt: string;
    /** Anticipated next validation step (for review dashboards). */
    nextStep?: "collect-more" | "peer-review" | "a-b-test" | "measure-outcome" | "publish";
  };

  /** Free-text tags. */
  tags?: readonly string[];

  publisher?: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };
};

export type FrozenEvidenceFindingManifest = Readonly<EvidenceFindingManifest>;

/** Confidence multiplier per validation state — used by patterns to
 *  compute their own confidence from underlying evidence. `draft`
 *  evidence contributes zero; only `proven` contributes the full
 *  weight. */
export const EVIDENCE_STATE_WEIGHT: Record<EvidenceValidationState, number> = {
  draft: 0,
  reviewed: 0.15,
  approved: 0.35,
  "a-b-tested": 0.6,
  measured: 0.85,
  proven: 1
};
