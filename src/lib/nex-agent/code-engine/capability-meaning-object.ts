// src/lib/nex-agent/code-engine/capability-meaning-object.ts
//
// NEX · Phase 6 · Meaning Object · 2026-09-21.
// Founder-authorised as part of the "Meaning Construction & Generalisation" programme.
//
// PURPOSE
//
//   A first-class STRUCTURED representation of what the user means,
//   distinct from a keyword bag and distinct from a set of RecallKind
//   regex hits. The meaning object is what the meaning-construction
//   layer produces from language + head state and what downstream
//   capability selection consumes.
//
//   The Phase 6 audit (16 unseen turns · 14 outright failures) showed
//   that NEX today has no representation of "goal", "constraints",
//   "information_need" or "referents". This module names those fields
//   and gives them types.
//
// ANTI-CHEATING GUARANTEE
//
//   · This module is types + pure enums. Zero behaviour. Zero I/O.
//   · Adding a field is a governance action (TypeScript union change
//     breaks callers loudly).
//   · A meaning object with `confidence < 0.5` MUST NOT drive a
//     capability firing. Callers must honour that threshold.

// ── Goal · what the user is trying to accomplish ─────────────────────
//
// Deliberately small and human-scale. Not a taxonomy of every possible
// intent — a coarse map that downstream capability selection can key on.

export type MeaningGoal =
  | "get_current_fact"       // "what is X right now"
  | "compare"                // "which of X and Y ..."
  | "plan_travel"            // "we're thinking of going to X"
  | "get_recommendation"     // "should I / worth it / would you"
  | "find_place"             // "somewhere warm / somewhere quieter"
  | "get_explanation"        // "why / how did you"
  | "confirm_understanding"  // "you mean X / is that right"
  | "correct_state"          // "actually / no I mean / forget X"
  | "cancel_intent"          // "cancel / never mind / stop"
  | "recall_prior"           // "what did you find / what did we decide"
  | "investigate_code"       // "where is X defined"
  | "unknown";

// ── Domain · the world of knowledge the goal touches ─────────────────

export type MeaningDomain =
  | "weather"
  | "geography"
  | "travel"
  | "food"
  | "healthcare"
  | "legal"
  | "finance"
  | "construction"
  | "transport"
  | "code_investigation"
  | "unknown";

// ── Information need · what shape of answer the user expects ─────────

export type InformationNeed =
  | "factual_lookup"       // "what is X"
  | "comparison"           // "which of X and Y"
  | "recommendation"       // "should I / worth it"
  | "explanation"          // "why / how"
  | "action_advice"        // "would you go"
  | "count"                // "how many"
  | "cost"                 // "how much / price"
  | "distance"             // "how far"
  | "listing"              // "what are the options"
  | "acknowledgement"      // "ok / thanks"
  | "unknown";

// ── Question type ────────────────────────────────────────────────────

export type QuestionType =
  | "closed_wh"          // "what/when/where/who/which is X"
  | "yes_no"             // "is/does/should X"
  | "open_wh"            // "how do I / what would you"
  | "statement"          // "I want to X" (not a direct question)
  | "correction"         // "actually / I meant"
  | "continuation"       // "and what about X"
  | "cancel"
  | "greeting"
  | "unknown";

// ── Subject + Referent ───────────────────────────────────────────────

export interface MeaningSubject {
  readonly kind: "place" | "entity" | "topic" | "person" | "unresolved";
  readonly value: string;
  readonly evidence: "explicit_named" | "resolved_from_state" | "hypothetical" | "unresolved";
}

export interface MeaningReferent {
  readonly surface: string;                   // "there", "it", "that one"
  readonly resolved_kind: MeaningSubject["kind"] | "unresolved";
  readonly resolved_value: string | null;
  readonly bound_via: "active_subject" | "last_retrieval" | "candidate_list" | "unresolvable";
}

// ── Timeframe · reused from working memory ───────────────────────────
// Keeps the shape aligned with capability-conversation-context.ActiveTimeframe.

export interface MeaningTimeframe {
  readonly anchor: "today" | "tomorrow" | "date" | "weekend" | "next_week" | "next_weekend" | "last_week" | "this_week" | "this_month" | "next_month" | "later" | "soon" | "yesterday" | "morning" | "evening" | "night";
  readonly offset_days: number;
  readonly explicit_date_iso: string | null;
  readonly surface: string;
}

// ── Constraint · structural, additive, removable ─────────────────────

export type ConstraintKind =
  | "temperature_warmer"
  | "temperature_cooler"
  | "atmosphere_quiet"
  | "atmosphere_busy"
  | "distance_near"
  | "distance_far"
  | "budget_cheap"
  | "budget_luxury"
  | "with_family"
  | "with_kids"
  | "with_partner"
  | "solo"
  | "duration_short"
  | "duration_long"
  | "condition_dry"
  | "condition_rainy";

export interface MeaningConstraint {
  readonly kind: ConstraintKind;
  readonly surface: string;
  readonly introduced_turn: number;
}

// ── Correction shape ─────────────────────────────────────────────────

export type CorrectionKind =
  | "subject_correction"    // "actually, I meant Bali"
  | "goal_correction"       // "forget beaches, want relaxation"
  | "constraint_add"        // "and quiet"
  | "constraint_remove"     // "doesn't need to be quiet"
  | "topic_shift"           // switches to a new topic entirely
  | "cancellation"          // "cancel / stop / never mind"
  | "preference_update"     // "always show me the source"
  | "none";

export interface MeaningCorrection {
  readonly kind: CorrectionKind;
  readonly from_value: string | null;
  readonly to_value: string | null;
  readonly surface: string;
}

// ── The meaning object ───────────────────────────────────────────────

export interface NexMeaning {
  /** What the user is trying to accomplish. */
  readonly goal: MeaningGoal;
  /** The primary subject (place / entity / topic / person) — may be unresolved. */
  readonly subject: MeaningSubject | null;
  /** Secondary subjects when the user names multiple (e.g. "compare A and B"). */
  readonly subjects_all: readonly MeaningSubject[];
  /** Domain the goal + subject fall into. */
  readonly domain: MeaningDomain;
  /** Topic name for the working-memory bridge (matches Phase-5 active_topic). */
  readonly topic: string | null;
  /** Timeframe · null when not present in the utterance and not inheritable from state. */
  readonly timeframe: MeaningTimeframe | null;
  /** Constraints extracted from the utterance and merged with any accumulated. */
  readonly constraints: readonly MeaningConstraint[];
  /** Referents (deictic bindings) resolved from state. */
  readonly referents: readonly MeaningReferent[];
  /** Correction, if the utterance is a correction. */
  readonly correction: MeaningCorrection;
  /** The shape of answer the user wants. */
  readonly information_need: InformationNeed;
  /** The syntactic type. */
  readonly question_type: QuestionType;
  /** Composite confidence · downstream capability firing requires ≥ 0.5. */
  readonly confidence: number;
  /** Free-form basis for humans reading the trace. Bounded. */
  readonly evidence_basis: readonly string[];
}

// ── Helpers ──────────────────────────────────────────────────────────

export function emptyMeaning(): NexMeaning {
  return {
    goal: "unknown",
    subject: null,
    subjects_all: [],
    domain: "unknown",
    topic: null,
    timeframe: null,
    constraints: [],
    referents: [],
    correction: { kind: "none", from_value: null, to_value: null, surface: "" },
    information_need: "unknown",
    question_type: "unknown",
    confidence: 0,
    evidence_basis: [],
  };
}

export function emitMeaningTrace(m: NexMeaning): string {
  return `meaning · goal=${m.goal} · domain=${m.domain} · subject=${m.subject?.value ?? "null"}${m.subjects_all.length > 1 ? "(+" + (m.subjects_all.length - 1) + ")" : ""} · timeframe=${m.timeframe ? `${m.timeframe.anchor}+${m.timeframe.offset_days}d` : "null"} · info_need=${m.information_need} · qtype=${m.question_type} · constraints=${m.constraints.length} · referents=${m.referents.length} · correction=${m.correction.kind} · confidence=${m.confidence.toFixed(2)}`;
}
