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
