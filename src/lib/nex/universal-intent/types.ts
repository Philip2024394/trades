// Universal Intent types — the 10-verb Layer 1 · Domain Layer 2 · Capability Layer 3
// classification model from Master Intent Library v1.0 (Philip 2026-08-03).
//
// Composes with the existing intent-router.ts (which picks navigation/database/brain/ai
// kind). Universal Intent is an orthogonal DIMENSION: WHAT verb + WHICH domain +
// WHICH capability, versus the existing WHICH route.
//
// Doctrine: docs/brains/nex-master-intent-library-v1-philip-2026-08-03.md

/** Layer 1 — the 10 universal verbs. Every user request in the world maps to one
 *  (or occasionally two) of these. Timeless — new industries add DOMAINS, not verbs. */
export type UniversalVerb =
  | "Create"       // Generate something new (image · doc · code · design · quote)
  | "Communicate"  // Deliver a message (reply · email · post · translate · notify)
  | "Decide"       // Compare + choose (which is best · A vs B · rank options)
  | "Plan"         // Organise a sequence (roadmap · schedule · timeline · itinerary)
  | "Manage"       // Ongoing state maintenance (track · organise · store · monitor state)
  | "Automate"     // Delegate to run without asking (schedule · recurring · auto-reply)
  | "Analyse"      // Explain data (why · which · dashboards · trends · reports)
  | "Learn"        // Get taught something (teach · explain · summarise · define)
  | "Improve"      // Optimise existing state (SEO · speed · profits · conversions)
  | "Monitor";     // Track + alert on change (remind · alert · watch · deadlines)

export const UNIVERSAL_VERBS: readonly UniversalVerb[] = [
  "Create", "Communicate", "Decide", "Plan", "Manage",
  "Automate", "Analyse", "Learn", "Improve", "Monitor",
] as const;

/** Layer 2 — the domain the verb applies to. Extensible; new industries add here
 *  without touching Layer 1 or Layer 3. Case-sensitive canonical labels. */
export type Domain = string; // free-form, canonical labels tracked in seed corpus

/** Layer 3 — the capability that performs the work. */
export type Capability =
  | "Answer"       // Direct response from knowledge
  | "Generate"     // Produce structured content (text · post · doc)
  | "Design"       // Produce visual/spatial output (image · layout · scheme)
  | "Calculate"    // Numeric computation
  | "Schedule"     // Time-based action (calendar · reminder · recurring)
  | "Report"       // Analytical output (dashboard · summary · comparison)
  | "Recommend"    // Advice with reasoning
  | "Quote"        // Priced proposal
  | "Execute";     // Take action in the world (post · send · book · pay)

export type IntentRoute = {
  layer1_verb: UniversalVerb;
  layer2_domain: Domain;
  layer3_capability: Capability;
};

export type IntentClassification = IntentRoute & {
  /** Fuzzy-match confidence 0..1. <0.7 → ask a clarifying question (Brain 14). */
  confidence: number;
  /** The corpus phrasing that matched (for telemetry + debugging). */
  matched_phrasing: string | null;
  /** The original user input. */
  original: string;
  /** Why this route was chosen (human-readable). */
  reason: string;
};

export type PhrasingRow = {
  phrasing: string;
  layer1_verb: UniversalVerb;
  layer2_domain: Domain;
  layer3_capability: Capability;
  authored_by: string;
  captured_at: string;
};
