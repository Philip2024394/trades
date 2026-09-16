// src/lib/nex-agent/code-engine/capability-a-founder-intent/index.ts
//
// NEX1 · CAPABILITY A · Native Founder-Intent Classifier · public API.
// Deterministic · zero LLM · pure functions only.

export { classifyFounderIntent } from "./classifier";
export {
  VOCABULARY_VERSION,
  VERB_FAMILY_VARIANTS,
  DELIVERABLE_PHRASES,
  VERB_LEXEME_INDEX,
  TOOL_LEXEMES,
  FRAMEWORK_LEXEMES,
  CODE_CONCEPT_LEXEMES,
  LANGUAGE_LEXEMES,
  WELL_KNOWN_CONFIG_FILES,
  CODING_LEXEME_INDEX,
} from "./vocabulary";
export type { Nex1CodingCategory } from "./vocabulary";
export type {
  Nex1AmbiguityFlag,
  Nex1CodingConceptToken,
  Nex1DeliverableKind,
  Nex1DomainToken,
  Nex1FileReference,
  Nex1IntentClassified,
  Nex1IntentRefusalKind,
  Nex1IntentRefused,
  Nex1IntentResult,
  Nex1RequirementPhrase,
  Nex1TextSpan,
  Nex1VerbFamily,
  Nex1VerbHit,
} from "./types";
export {
  NEX1_INTENT_MIN_GOAL_CHARS,
  NEX1_INTENT_MAX_GOAL_CHARS,
  NEX1_INTENT_MAX_DOMAIN_TOKENS,
  NEX1_INTENT_LOW_CONFIDENCE_BAND,
} from "./types";
