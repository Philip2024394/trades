// src/lib/nex-relevance/types.ts
//
// NEX1 · RELEVANCE DOCTRINE · type definitions.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Founder rules (2026-09-12):
//   · Not a stupid-question detector · a JUDGEMENT layer.
//   · NOT a binary answer/refuse machine · a spectrum of stances.
//   · Semantic-only outputs · phrasing unlocked · never canned templates.

/**
 * Nine categories NEX may classify a request into. The classifier picks ONE.
 * Multiple patterns may fire; the highest-severity category wins deterministically.
 */
export type RelevanceCategory =
  | "MEANINGFUL_TASK"         // has clear purpose · legitimate outcome
  | "BENIGN_TEST"             // short "say X" · "ping" · trivial · harmless
  | "CAPABILITY_TEST"         // "can you do X?" · legitimate probe of ability
  | "REPETITIVE_REQUEST"      // "say X 500 times" · repetition without purpose
  | "LOW_VALUE_REQUEST"       // technically possible · practically pointless
  | "NONSENSICAL_REQUEST"     // surreal · uninterpretable · not adversarial
  | "PROVOCATION"             // designed to elicit self-degradation or emotional response
  | "MANIPULATION_ATTEMPT"    // trap · disguised extraction · conditional-if-you-are-X
  | "AMBIGUOUS_REQUEST";      // intent unclear · needs a clarifying question

/**
 * Seven behavioural stances NEX may adopt · per founder spectrum (2026-09-12):
 *   low-value-but-harmless  → humour it briefly
 *   repetitive              → note the repetition
 *   computationally wasteful → recommend a better tool
 *   genuine capability test → perform it
 *   provocation             → remain calm
 *   manipulation            → identify manipulation
 *   dangerous / prohibited  → refuse
 *
 * Stances are set by the RelevanceResponseComposer · not the classifier alone.
 */
export type RelevanceStance =
  | "perform_briefly"           // benign · harmless · just do it once
  | "perform_with_note"         // do it · note the repetition or triviality
  | "redirect_to_better_tool"   // suggest a calculator / script / other surface
  | "perform_capability_test"   // demonstrate the capability efficiently
  | "remain_calm"               // provocation · do not affirm · do not lecture
  | "identify_manipulation"     // name the pattern · invite direct question
  | "invite_clarification"      // ambiguous · ask what they actually want
  | "refuse";                   // dangerous · prohibited · self-degrading

export interface RelevanceVerdict {
  readonly category: RelevanceCategory;
  readonly matched_rule_id: string | null;
  readonly evidence: string;                 // human-readable rationale · pointer format
  readonly stance: RelevanceStance;
  readonly purpose_bearing: boolean;          // did the utterance carry stated purpose?
  readonly rationale: string;                 // one sentence · why this stance
}

/**
 * Semantic slots for the response composer. Language Brain composes natural
 * variants at emission time · this is guidance, not phrasing.
 */
export interface RelevanceResponsePlan {
  readonly stance: RelevanceStance;
  readonly recognition: string;               // "recognise this as X"
  readonly position: string;                  // "state can · could-but-won't · will-if-purpose"
  readonly useful_offer: string;              // what NEX offers to do instead / next
  readonly optional_note: string | null;      // wit slot · null when inappropriate (provocation · manipulation)
  readonly evidence_pointers: readonly string[]; // RD-* rule ids · claim ids
  readonly semantic_only: true;
  readonly taught_by: "master_ai_engineer";
}
