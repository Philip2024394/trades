// src/lib/nex-native/safechat/types.ts
//
// NEX SafeChat Phase 1 · shared types.
// -----------------------------------------
// Phase 1 is INSTRUMENTATION ONLY · zero user-facing effect.
// All classifications are written with simulated=TRUE and
// visibility_to_guardian=FALSE. See doctrine
// docs/doctrine/nex-safechat-phase-1-simulated-2026-10-10.md.

/** Classifier version string · bumped when the ruleset changes
 *  materially. Used to retire old log rows without a schema change.
 *
 *  v1.0.0 (sealed 2026-10-10) · initial Phase 1 instrumentation ruleset.
 *  v1.1.0 (2026-10-10 Ruleset Tuning Wave 1) · adds category-specific
 *          rule modules for secrecy_request, grooming_pattern (score-based),
 *          and coercion_pressure (conversation-signal path). The frozen
 *          v1.0.0 logic lives at rules/_frozen-v1-0-0.ts for comparison.
 *          Frozen snapshot: rules/_frozen-v1-1-0/.
 *  v1.1.1 (2026-10-10 Ruleset Tuning Wave 2) · targeted regression
 *          fixes vs v1.1.0 · (a) age_gap_disclosure + meeting_arrangement
 *          combination bonus restores the baseline Level-3 escalation,
 *          (b) extended benign-celebration whitelist for English surprise
 *          phrasings, (c) extended Indonesian benign-privacy whitelist. */
export const SAFECHAT_CLASSIFIER_VERSION_V1_0_0 = "safechat-rules-v1.0.0" as const;
export const SAFECHAT_CLASSIFIER_VERSION_V1_1_0 = "safechat-rules-v1.1.0" as const;
export const SAFECHAT_CLASSIFIER_VERSION_V1_1_1 = "safechat-rules-v1.1.1" as const;
/** Legacy constant · retained verbatim as "safechat-rules-v1.0.0" so
 *  the evaluation runner (R-CORPUS scope) that currently reads this
 *  symbol does NOT break mid-wave. New callers should import
 *  SAFECHAT_DEFAULT_CLASSIFIER_VERSION or pass an explicit
 *  rulesetVersion to classifyMessage. */
export const SAFECHAT_CLASSIFIER_VERSION = SAFECHAT_CLASSIFIER_VERSION_V1_0_0;
/** Default classifier version · what new callers get when they don't
 *  pass an explicit rulesetVersion. The sealed peer-message-service
 *  hook keeps using the default. Wave 2 preserves v1.1.0 as the default
 *  so no production behaviour changes without an explicit opt-in · the
 *  wave is synthetic-evaluation-only per the founder's authorisation. */
export const SAFECHAT_DEFAULT_CLASSIFIER_VERSION = SAFECHAT_CLASSIFIER_VERSION_V1_1_0;
export type SafechatRulesetVersion =
  | typeof SAFECHAT_CLASSIFIER_VERSION_V1_0_0
  | typeof SAFECHAT_CLASSIFIER_VERSION_V1_1_0
  | typeof SAFECHAT_CLASSIFIER_VERSION_V1_1_1;

/** The sealed category taxonomy for vocabulary terms. Structure-neutral
 *  (no vendor identifiers). Mirrored in the DB CHECK constraint on
 *  nex.safechat_vocabulary_term.category. */
export const VOCAB_CATEGORIES = [
  "sexual_slang",
  "explicit_sexual",
  "violence",
  "self_harm",
  "drugs",
  "grooming_indicator",
  "coercion_indicator",
  "image_request",
  "secrecy_request",
  "meeting_arrangement",
] as const;
export type VocabCategory = (typeof VOCAB_CATEGORIES)[number];

/** The sealed signal-type taxonomy for pattern matches. Mirrored in
 *  the DB CHECK constraint on nex.safechat_pattern.signal_type.
 *
 *  v1.1.0 (2026-10-10) adds four new signal types used by the
 *  category-specific rule modules. The DB CHECK constraint is extended
 *  idempotently by the v1-1-0 seed migration. */
export const SIGNAL_TYPES = [
  "image_request",
  "coercion_followup",
  "secrecy_request",
  "meeting_arrangement",
  "platform_switch_invitation",
  "repeated_pressure_after_refusal",
  "gift_offer_with_sexual_frame",
  "age_gap_disclosure",
  // v1.1.0 additions:
  "flattery_followed_by_request",
  "trust_building_language",
  "isolation_request",
  "refusal_language",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

/** Severity · low, medium, high. Shared by vocabulary + patterns. */
export type Severity = 1 | 2 | 3;

/** Risk-level enum used by the classifier + logger.
 *  0 = clean · 1 = sensitive · 2 = potentially_unsafe · 3 = serious_risk */
export type RiskLevel = 0 | 1 | 2 | 3;

/** A single vocabulary match from the current message. */
export interface VocabularyMatch {
  readonly termId: string;
  readonly term: string;
  readonly category: VocabCategory;
  readonly severity: Severity;
  readonly language: string;
}

/** A single pattern match from the current message. */
export interface PatternMatch {
  readonly patternId: string;
  readonly signalType: SignalType;
  readonly severity: Severity;
  readonly language: string;
  readonly matchedText: string;
}

/** Conversation-level signals produced by the aggregator.
 *
 *  v1.1.0 additions carry the conversation-level signal path for
 *  coercion_pressure. All new fields are OPTIONAL at the type level so
 *  historical rows parsed back from the DB continue to type-check;
 *  the aggregator always emits them (as false / 0) on fresh calls. */
export interface ConversationSignals {
  readonly repeated_pressure_after_refusal: boolean;
  readonly escalation_pattern: boolean;
  readonly time_pressure: boolean;
  readonly platform_switch_invitation: boolean;
  /** How many classifications we looked at in the window · 0 means we
   *  had no history (or no conversation id). */
  readonly historyWindowCount: number;
  // v1.1.0 additions (optional for back-compat with historic jsonb rows):
  readonly repeated_request_after_refusal?: boolean;
  readonly escalating_severity_pattern?: boolean;
  readonly pressure_density?: number;
  readonly platform_switch_already_proposed?: boolean;
  readonly secrecy_already_requested?: boolean;
  readonly age_gap_already_disclosed?: boolean;
}

/** Shape of a serialisable rule match stored in the DB jsonb column. */
export interface RuleMatchEntry {
  readonly kind: "vocabulary" | "pattern";
  readonly id: string;
  readonly category?: VocabCategory;
  readonly signalType?: SignalType;
  readonly severity: Severity;
  readonly language: string;
  readonly term?: string;
  readonly matchedText?: string;
}

/** Final classification result returned by the classifier.
 *
 *  classifierVersion reflects the ruleset version that produced this
 *  result (v1.0.0 or v1.1.0). The sealed logger writes it verbatim. */
export interface ClassificationResult {
  readonly level: RiskLevel;
  readonly confidence: number;
  readonly ruleMatches: readonly RuleMatchEntry[];
  readonly languageDetected: string | null;
  readonly signals: ConversationSignals;
  readonly classifierVersion: SafechatRulesetVersion;
}

// -----------------------------------------------------------------
// Rule modules (v1.1.0) · each category owns its own rules file.
// -----------------------------------------------------------------

/** Everything a rule module needs to make a per-message decision. The
 *  module is pure · it only reads this context and returns an output. */
export interface RuleModuleContext {
  readonly text: string;
  readonly normalisedText: string;
  readonly language: string;
  readonly vocabularyMatches: readonly VocabularyMatch[];
  readonly patternMatches: readonly PatternMatch[];
  readonly conversationSignals: ConversationSignals;
}

/** One module's contribution. Composition in compose.ts takes a list
 *  of these and resolves the final level + confidence. */
export interface RuleModuleOutput {
  readonly moduleName: string;
  readonly contributedLevel: RiskLevel;
  readonly contributedConfidence: number;
  /** Signal names only · NEVER body text. Enforced by privacy audit. */
  readonly contributingSignals: readonly string[];
}

export type RuleModule = (ctx: RuleModuleContext) => RuleModuleOutput;

// -----------------------------------------------------------------
// Conversation history (v1.1.0) · injectable prior classification.
// -----------------------------------------------------------------

/** One prior classification in the conversation history window. The
 *  aggregator accepts an array of these for hermetic multi-message
 *  tests · the production path reads the DB and converts rows to this
 *  shape before deriving signals. */
export interface PriorClassification {
  readonly level: RiskLevel;
  readonly ruleMatches: readonly RuleMatchEntry[];
  readonly classifiedAt: string;
}

/** Compiled pattern · what the pattern-detector keeps in memory. */
export interface CompiledPattern {
  readonly patternId: string;
  readonly signalType: SignalType;
  readonly severity: Severity;
  readonly language: string;
  readonly regex: RegExp;
}

/** Row shape returned when we read a vocabulary row for compilation. */
export interface VocabularyRow {
  readonly termId: string;
  readonly term: string;
  readonly normalisedTerm: string;
  readonly category: VocabCategory;
  readonly severity: Severity;
  readonly language: string;
}

/** Row shape returned when we read a pattern row for compilation. */
export interface PatternRow {
  readonly patternId: string;
  readonly patternDescription: string;
  readonly patternRegex: string;
  readonly language: string;
  readonly signalType: SignalType;
  readonly severity: Severity;
}
