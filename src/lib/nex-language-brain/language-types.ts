// src/lib/nex-language-brain/language-types.ts
//
// NEX1 · LANGUAGE BRAIN v0 · type surface.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Independence discipline (constitutional):
//   · NO external LLM. NO cloud inference. NO vendor runtime.
//   · The bridge from human language → structured engineering goal is a
//     deterministic pattern registry + slot-filler + safety guard.
//   · The bridge MUST NEVER emit an engineering directive directly.
//     It emits a `Nex1IntentBridgeResult` that carries either
//     · a `structured_intent` for the engineering brain to consume, OR
//     · a `refused` verdict with a specific refusal class.
//
// Learning surface (deferred implementation · designed for later):
//   · Every recognised pattern is loaded from a JSON pattern registry.
//   · Every refusal is scored against a measurable rubric.
//   · New patterns are added to the registry when a teacher approves.
//   · Regression tests grow with the registry.

/** ISO-ish language tag · currently constrained to what the lab handles. */
export type Nex1LangTag = "en" | "id" | "mixed_en_id" | "unknown";

/** Every intent the bridge can emit is either a supported engineering intent
 *  or a specific refusal. Both are structured and auditable. */
export type Nex1RecognisedIntentKind =
  | "add_field_to_type"
  | "fix_failing_test"
  | "clarification_query"     // "what is X?" · read-only · engineering brain not invoked
  | "cancel_previous"         // "no wait · undo"
  | "acknowledge"             // "ok" · "yes" · pure conversational · no action
  // ── Programming communication (item 2 · v0) ──────────────────────
  // Recognises the KIND of engineering instruction · NEVER executes.
  | "modify_return_type"      // "make the getX function return a nullable string"
  | "rename_preserve_behaviour" // "rename computeTotal to calculateTotal without changing behaviour"
  | "make_field_optional"     // "make the priority field on Reservation optional"
  | "restrict_type_to_union"  // "the status field should only accept active pending archived"
  | "preserve_api_contract"   // "keep the loadUser API backwards compatible"
  | "add_purity_constraint";  // "don't mutate the input array"

export type Nex1IntentRefusalClass =
  | "refused_ambiguous"                     // multiple plausible intents · not enough evidence
  | "refused_underspecified"                // known intent but missing required slot(s)
  | "refused_unknown_intent"                // no pattern in the registry matched
  | "refused_unsafe_bypass_attempt"         // "ignore protected paths" · "bypass safety" · etc.
  | "refused_unsafe_secret_exfil_attempt"   // "email me the .env"
  | "refused_unsupported_language"          // language cannot be classified confidently
  | "refused_contradictory"                 // "add and remove the same field in one breath"
  | "refused_reference_unresolved"          // "change it back" · no prior context available
  | "refused_out_of_scope"                  // request outside the engineering brain's surface
  | "refused_potentially_destructive"       // "delete everything" · needs founder authority
  | "refused_low_confidence"                // pattern matched but confidence below threshold
  | "refused_language_lab_not_authorised";  // guard for capabilities not yet enabled

export interface Nex1LanguageInput {
  readonly utterance: string;
  readonly language_hint?: Nex1LangTag;         // optional caller hint; bridge still detects
  readonly prior_context?: readonly string[];    // recent utterances for reference resolution
  readonly user_id?: string;                     // for tenant-scoped learning later
}

/**
 * Successful intent recognition. Carries a structured goal (or a marker) that
 * downstream systems consume. NEVER carries executable code · always structured.
 */
export interface Nex1RecognisedIntent {
  readonly kind: Nex1RecognisedIntentKind;
  readonly detected_language: Nex1LangTag;
  readonly confidence: number;                   // 0..1
  readonly matched_pattern_id: string;           // which registry entry matched
  readonly slots: Readonly<Record<string, string>>;// extracted structured fields
  readonly rationale: string;                    // human-readable reason
  readonly taught_by: "master_ai_engineer";
}

export interface Nex1IntentRefusal {
  readonly refusal_class: Nex1IntentRefusalClass;
  readonly detected_language: Nex1LangTag;
  readonly reason: string;
  readonly recovered_slots?: Readonly<Record<string, string>>;
  readonly taught_by: "master_ai_engineer";
}

/**
 * A clarification request · emitted when two or more patterns match with
 * confidence within an ambiguity band AND they represent DIFFERENT intent
 * kinds. Instead of silently choosing the highest-confidence match or
 * silently refusing, the bridge returns a structured question the caller
 * can present to the user. Kept intentionally minimal for v0.
 */
export interface Nex1ClarificationRequest {
  readonly detected_language: Nex1LangTag;
  readonly candidates: readonly Nex1ClarificationCandidate[];
  readonly reason: string;
  readonly taught_by: "master_ai_engineer";
}

export interface Nex1ClarificationCandidate {
  readonly matched_pattern_id: string;
  readonly intent_kind: Nex1RecognisedIntentKind;
  readonly confidence: number;
  readonly slots: Readonly<Record<string, string>>;
  readonly summary: string; // human-readable "did you mean: rename X to Y?"
}

export type Nex1IntentBridgeResult =
  | { readonly ok: true; readonly intent: Nex1RecognisedIntent }
  | { readonly ok: false; readonly refusal: Nex1IntentRefusal }
  | { readonly ok: "clarify"; readonly clarification: Nex1ClarificationRequest };

/**
 * A single pattern entry in the deterministic registry. Kept small · human-
 * readable · versioned by inclusion order in a JSON file. Learning ADDs new
 * entries · it does not mutate existing ones (auditable growth).
 */
export interface Nex1LanguagePattern {
  readonly id: string;
  readonly language: Nex1LangTag;
  readonly intent_kind: Nex1RecognisedIntentKind;
  readonly regex: string;                        // named capture groups → slots
  readonly slot_defaults?: Readonly<Record<string, string>>;
  readonly required_slots: readonly string[];
  readonly confidence: number;                    // base confidence · registry-declared
  readonly example: string;                       // one canonical example (for docs + tests)
  readonly source: "seed" | "corrected" | "teacher_added";
}

export interface Nex1SafetyPattern {
  readonly id: string;
  readonly regex: string;
  readonly refusal_class: Nex1IntentRefusalClass;
  readonly reason: string;
  readonly source: "seed" | "teacher_added";
}

export interface Nex1LanguageRegistry {
  readonly version: string;
  readonly intent_patterns: readonly Nex1LanguagePattern[];
  readonly safety_patterns: readonly Nex1SafetyPattern[];
}
