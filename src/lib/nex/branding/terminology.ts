// NEX branded-design terminology · single source of truth for customer
// facing surfaces (Philip 2026-08-05 · S2 execution).
//
// Every customer-facing surface (Trade Centre · brain chat · configurator ·
// customer education · marketing) imports from this file rather than
// hardcoding brand strings. Technical documentation (engineering IDs,
// YAML filenames, DB enums, CAD/CAM identifiers, construction rules,
// docstrings, code comments, joiner-facing detail) continues using the
// industry terms unchanged — never call any helper from technical code.
//
// Framing rule (Philip 2026-08-05): NEX brand terms do NOT replace
// industry terms. They are the NEX customer-voice for the same
// underlying construction. The technicalTerm() helper is the bridge:
// use it whenever a customer surface needs to acknowledge the industry
// vocabulary for context, honesty, or expert-audience clarity.

export type BrandingKey = "closed-string" | "split-newel";

type Entry = {
  /** First mention on a page · always with the ™ symbol. */
  brand: string;
  /** Subsequent mentions on the same page · no ™ symbol. */
  brandPlain: string;
  /** The industry / engineering / manufacturing term. */
  technical: string;
  /** First mention bridged to industry vocabulary for customer clarity. */
  explanation: string;
};

const REGISTRY: Record<BrandingKey, Entry> = {
  "closed-string": {
    brand: "NexString™",
    brandPlain: "NexString",
    technical: "closed string staircase",
    explanation:
      "NexString™ (our branded enclosed outer string design, traditionally known as a closed string staircase)",
  },
  "split-newel": {
    brand: "NEX Split Newel™",
    brandPlain: "NEX Split Newel",
    technical: "split newel post",
    explanation:
      "NEX Split Newel™ (our branded two-part timber newel with a stainless steel spacer)",
  },
};

/** First mention on a customer-facing surface · includes ™ symbol. */
export function brandTerm(key: BrandingKey): string {
  return REGISTRY[key].brand;
}

/** Subsequent mentions on the same customer-facing surface · no ™. */
export function brandTermPlain(key: BrandingKey): string {
  return REGISTRY[key].brandPlain;
}

/** Engineering / manufacturing / industry vocabulary. */
export function technicalTerm(key: BrandingKey): string {
  return REGISTRY[key].technical;
}

/** First mention paired with a bridge to the industry term. */
export function customerExplanation(key: BrandingKey): string {
  return REGISTRY[key].explanation;
}
