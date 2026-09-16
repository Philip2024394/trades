// src/lib/nex-agent/code-engine/capability-a-founder-intent/types.ts
//
// NEX1 · CAPABILITY A · NATIVE FOUNDER-INTENT CLASSIFIER · type surface.
// Deterministic · zero LLM · pure functions.
//
// Contract:
//   classifyFounderIntent(goal) → Nex1IntentClassified | Nex1IntentRefused
//
// A classified result is a structured, inspectable description of what the
// Founder was asking for. It NEVER fabricates confidence: every field carries
// evidence spans from the original goal text, and every classification decision
// appears in the reasoning_trace.
//
// A refusal is emitted honestly whenever the deterministic layer cannot make a
// safe classification. Refusals are enumerated so callers can branch precisely.

/** Verb-family bucket. Each bucket has a locked lexical variant list in vocabulary.ts. */
export type Nex1VerbFamily =
  | "BUILD"        // create something new
  | "MODIFY"       // change existing behaviour
  | "FIX"          // repair a broken/failing thing
  | "REFACTOR"     // improve without changing behaviour
  | "TEST"         // add or run tests
  | "INVESTIGATE"  // understand / inspect / analyse
  | "VERIFY"       // confirm / validate / prove
  | "REMOVE";      // delete / drop / eliminate

/** Deliverable class the Founder is asking for. `unclear` is a valid honest state. */
export type Nex1DeliverableKind =
  | "application"
  | "component"
  | "function"
  | "module"
  | "test"
  | "test_suite"
  | "route"
  | "endpoint"
  | "type_definition"
  | "documentation"
  | "unclear";

/** A single character span inside the original goal text. Inclusive start, exclusive end. */
export interface Nex1TextSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** A domain noun the classifier extracted from the goal (e.g. "notes", "plugin"). */
export interface Nex1DomainToken {
  /** The normalised token (lower-case). */
  readonly token: string;
  /** How many times this token appeared in the goal. */
  readonly occurrences: number;
  /** Spans where the token appeared in the original text. */
  readonly spans: readonly Nex1TextSpan[];
}

/** A verb-family occurrence in the goal. */
export interface Nex1VerbHit {
  readonly family: Nex1VerbFamily;
  readonly variant: string; // the lexeme that matched (e.g. "build", "repair")
  readonly span: Nex1TextSpan;
}

/** A requirement phrase extracted from the goal. */
export interface Nex1RequirementPhrase {
  readonly kind: "must_have" | "must_not_have" | "constraint" | "verification_intent";
  readonly evidence: Nex1TextSpan;
}

/** A file/line reference regex-extracted from the goal (e.g. "src/lib/foo.ts:42"). */
export interface Nex1FileReference {
  readonly path: string;
  readonly line: number | null;
  readonly span: Nex1TextSpan;
}

/** An ambiguity flag: the classifier detected a possibly-uncertain classification. */
export interface Nex1AmbiguityFlag {
  readonly kind:
    | "low_verb_confidence"
    | "low_deliverable_confidence"
    | "multiple_verb_families_close"
    | "no_domain_extracted"
    | "requirement_phrases_missing"
    | "no_coding_context_detected";
  readonly detail: string;
}

/**
 * A recognised coding-context token in the goal. `category` distinguishes:
 *   - `tool`      · build/test/lint/container/VCS tools (npm, vitest, docker)
 *   - `framework` · libraries + frameworks + databases (react, tailwind, prisma)
 *   - `concept`   · abstract programming concepts (hook, middleware, promise)
 *   - `language`  · programming languages (typescript, python, rust)
 * A lexeme belongs to exactly one category — enforced at vocabulary module load.
 */
export interface Nex1CodingConceptToken {
  readonly token: string;
  readonly category: "tool" | "framework" | "concept" | "language";
  readonly occurrences: number;
  readonly spans: readonly Nex1TextSpan[];
}

/** Successful classification result. */
export interface Nex1IntentClassified {
  readonly kind: "classified";
  /** Primary verb family. Selected as highest-scoring, tiebreak = first-appearing. */
  readonly verb_family: Nex1VerbFamily;
  /** Confidence [0,1] · verb-hit-count for primary / total verb hits. */
  readonly verb_family_confidence: number;
  /** All verb hits, ordered by span position in the original goal. */
  readonly verb_hits: readonly Nex1VerbHit[];
  /** Deliverable kind chosen (may be "unclear"). */
  readonly deliverable_kind: Nex1DeliverableKind;
  /** Confidence [0,1] for the deliverable classification. */
  readonly deliverable_confidence: number;
  /** Domain tokens found (top-N by occurrence) — business-domain nouns, NOT coding vocabulary. */
  readonly domain_tokens: readonly Nex1DomainToken[];
  /** Coding-context tokens: tools + frameworks + concepts + languages recognised in the goal. */
  readonly coding_concepts: readonly Nex1CodingConceptToken[];
  /** File references regex-extracted from the goal (source files + well-known config files). */
  readonly file_references: readonly Nex1FileReference[];
  /** Extracted requirement phrases. */
  readonly requirement_phrases: readonly Nex1RequirementPhrase[];
  /** Any ambiguities noted during classification. */
  readonly ambiguities: readonly Nex1AmbiguityFlag[];
  /** Overall confidence combining verb + deliverable + presence-of-domain signals. [0,1]. */
  readonly overall_confidence: number;
  /** Human-inspectable reasoning trace. Every decision leaves an entry here. */
  readonly reasoning_trace: readonly string[];
  /** Length of goal after trim, in characters. */
  readonly goal_length: number;
  /** Vocabulary version used to produce this classification. */
  readonly vocabulary_version: string;
  /** Non-fabrication guarantee: "master_ai_engineer" is the author of this deterministic module. */
  readonly taught_by: "master_ai_engineer";
}

/** Enumerated refusal reasons. */
export type Nex1IntentRefusalKind =
  | "refused_empty_goal"
  | "refused_goal_too_short"
  | "refused_goal_too_long"
  | "refused_no_verb_recognised"
  | "refused_conflicting_verbs_equal_top";

export interface Nex1IntentRefused {
  readonly kind: "refused";
  readonly refusal: Nex1IntentRefusalKind;
  readonly reason: string;
  readonly reasoning_trace: readonly string[];
  readonly goal_length: number;
  readonly vocabulary_version: string;
  readonly taught_by: "master_ai_engineer";
}

export type Nex1IntentResult = Nex1IntentClassified | Nex1IntentRefused;

/** Bounded input constraints. */
export const NEX1_INTENT_MIN_GOAL_CHARS = 8;
export const NEX1_INTENT_MAX_GOAL_CHARS = 8000;

/** Top-N domain tokens to keep in the result. */
export const NEX1_INTENT_MAX_DOMAIN_TOKENS = 8;

/** Confidence bands (used for ambiguity flagging, not for hiding evidence). */
export const NEX1_INTENT_LOW_CONFIDENCE_BAND = 0.55;
