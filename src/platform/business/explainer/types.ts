// Strategy Explainer — types.
//
// Turns a ResolvedStrategy into human-readable "what the platform
// decided and why" — for MERCHANTS, not developers.
//
// This is not another registry. It's a pure service that consumes
// ResolvedStrategy + a static vocabulary of intent → phrase mappings.
// If a facet doesn't have a phrase, it's skipped silently — the
// vocabulary can grow without breaking anything.

export type ExplanationLine = {
  /** Bucket the merchant sees — Website / Dashboard / Booking / SEO / Marketing / Trust. */
  bucket: ExplanationBucket;
  /** Plain-language sentence, present tense. */
  sentence: string;
  /** Provenance — which playbook(s) contributed this decision. */
  citedPlaybooks: readonly string[];
  /** Optional confidence % from the strongest contributing playbook. */
  confidence?: number;
};

export type ExplanationBucket =
  | "Website"
  | "Booking"
  | "Dashboard"
  | "SEO"
  | "Marketing"
  | "Trust"
  | "Content";

export type StrategyExplanation = {
  /** Short summary line — "Your growth strategy is Door Installation." */
  summary: string;

  /** What the merchant told us. */
  context: {
    trade: string;
    tradeLabel: string;
    goal: string;
    goalLabel: string;
    pushServices: readonly string[];
    positioning: string;
  };

  /** The recipe + playbooks the platform used. */
  provenance: {
    recipe: { slug: string; name: string };
    playbooks: readonly { slug: string; name: string; confidence: number }[];
  };

  /** The actual decisions, grouped by bucket. */
  decisions: readonly ExplanationLine[];

  /** ISO 8601 timestamp of the explanation. */
  generatedAt: string;
};

/** Deep-dive "Why is this specific recommendation on my site?" for
 *  ONE (domain, field) decision. Consumed by the per-tile "Why?"
 *  buttons on the merchant surface. */
export type DecisionExplanation = {
  domain: string;
  field: string;
  /** Human-readable recommendation — "Prioritise Door Installation". */
  recommendation: string;
  /** The concise Why — pulled from the strongest playbook's rationale
   *  when available, or synthesised from provenance if not. */
  reasoning: string;
  /** Cited playbooks that contributed to this decision. */
  citedPlaybooks: readonly {
    slug: string;
    name: string;
    confidence: number;
    rationaleStatement?: string;
  }[];
  /** Patterns cited by the strongest playbook's rationale. */
  citedPatterns: readonly {
    slug: string;
    title: string;
    statement: string;
    derivedConfidence: number;
  }[];
  /** Evidence findings cited by the strongest playbook's rationale. */
  citedEvidence: readonly {
    slug: string;
    title: string;
    state: string;
    sourceKind: string;
  }[];
  /** Overall evidence strength band ("insufficient" → "very-high"). */
  strengthBand: string;
  /** Merchant-facing overall strength label — "High (supported by
   *  platform research and measured outcomes)". */
  strengthLabel: string;
};
