// playbookRegistry — types.
//
// Playbooks are small single-concern patterns. Each contributes to a
// set of facet KINDS via the `facets` map. Reusable across trades.
//
// Playbooks own INTENT, never copy. `hero.messageStrategy` says
// "primary-service-emphasis"; the actual headline comes from the AI
// content layer + KG package.

export type PlaybookCategory =
  | "trust"
  | "portfolio"
  | "seo"
  | "pricing"
  | "marketing"
  | "cta"
  | "hero"
  | "gallery"
  | "theme"
  | "urgency"
  | "conversion"
  | "brand"
  | "accessibility"
  | "performance"
  | "storytelling"
  | "commerce"
  | "customer-segment";

export type EvidenceStrength =
  | "none"
  | "anecdotal"
  | "measured"
  | "validated";

/** Provenance dimensions per Amendment 7 §RGP-9. */
export type EvidenceProfile = {
  confidence: number;                       // 0-100
  evidenceStrength: EvidenceStrength;
  sampleSize?: number;
  lastValidated?: string;                   // ISO 8601
  marketsValidated?: readonly string[];     // ISO country codes
  evidenceId?: string;                      // future evidenceRegistry link
};

/** A single facet contribution declared by a playbook. Keyed by
 *  facetKind slug ("gallery.style", "pricing.display", etc.). Value
 *  is the data payload for that kind. */
export type PlaybookFacets = Record<string, Record<string, unknown>>;

/** The "Why?" explanation for a playbook. Amendment 7 addendum
 *  (2026-07-05) — every new playbook SHOULD declare a rationale so
 *  merchants can click "Why?" and see the reasoning + evidence.
 *  Optional on legacy playbooks; backfilled progressively. */
export type PlaybookRationale = {
  /** Short one-liner — "Why this playbook works". */
  statement: string;
  /** Longer plain-English reasoning, present tense. Must NOT invent
   *  numbers — quote patterns or evidence, don't fabricate. */
  reasoning: string;
  /** Slugs from patternRegistry that back this rationale. */
  citesPatterns?: readonly string[];
  /** Slugs from evidenceRegistry that directly back this rationale.
   *  Prefer patterns; cite evidence when the rationale hinges on one
   *  specific finding. */
  citesEvidence?: readonly string[];
};

export type PlaybookManifest = {
  manifestVersion: 1;
  slug: string;
  name: string;
  description: string;
  version: string;

  category: PlaybookCategory;

  appliesTo: {
    trades: readonly string[];              // ["*"] = universal
    profileFlags?: readonly string[];       // "premium" | "emergency" | "residential" | ...
    growthGoals?: readonly string[];
    countries?: readonly string[];
  };

  /** The typed facet contributions. Keys are facetKind slugs. */
  facets: PlaybookFacets;

  /** The "Why?" — optional on legacy playbooks; required-in-spirit on
   *  new playbooks. */
  rationale?: PlaybookRationale;

  source: "platform-authored" | "agency-authored" | "data-derived";
  evidence: EvidenceProfile;

  publisher?: { name: string; verified: boolean };
};

export type FrozenPlaybookManifest = Readonly<PlaybookManifest>;
