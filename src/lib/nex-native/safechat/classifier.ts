// src/lib/nex-native/safechat/classifier.ts
//
// NEX SafeChat · the rules-based classifier.
// -------------------------------------------
// Pure server-only. Takes a message, loads the current vocabulary +
// pattern index for the configured languages, runs the aggregator, and
// emits a ClassificationResult.
//
// Doctrine (v1.1.1, 2026-10-10 Ruleset Tuning Wave 2):
//   · Phase 1 is INSTRUMENTATION ONLY · the classifier never blocks,
//     warns, alerts, or restricts. It only emits a structured result
//     the logger writes to the DB.
//   · This is RULES + VOCABULARY + PATTERNS. No ML. No vendor API.
//   · The classifier is now a THIN COMPOSER · all per-category decisions
//     live in rules/*.ts modules. See rules/README.md.
//   · simulated=TRUE and visibility_to_guardian=FALSE are enforced at
//     the logger layer · the classifier itself does not emit either
//     flag.
//
// Versioning:
//   · classifyMessage accepts an optional rulesetVersion parameter.
//     Default is v1.1.0 (preserves production behaviour · Wave 2 is
//     synthetic-evaluation-only per the founder's authorisation).
//     Pass "v1.0.0" to run the frozen baseline, "v1.1.0" to run the
//     frozen Wave-1 snapshot, "v1.1.1" to run the Wave-2 revision
//     (both used by evaluation runners for comparison).
//   · For back-compat, resolveLevel + computeConfidence are kept as
//     exports and delegate to the frozen v1.0.0 implementation. The
//     existing classifier.test.ts expectations are unchanged.

import "server-only";
import {
  loadVocabularyForLanguages,
  matchVocabulary,
  normaliseForMatch,
} from "./vocabulary-reader";
import { loadPatternsForLanguages, matchPatterns } from "./pattern-detector";
import { aggregateSignals } from "./conversation-signal-aggregator";
import {
  type ClassificationResult,
  type ConversationSignals,
  type PatternMatch,
  type PriorClassification,
  type RiskLevel,
  type RuleModuleContext,
  type RuleModuleOutput,
  type SafechatRulesetVersion,
  type VocabularyMatch,
  SAFECHAT_CLASSIFIER_VERSION_V1_0_0,
  SAFECHAT_CLASSIFIER_VERSION_V1_1_0,
  SAFECHAT_CLASSIFIER_VERSION_V1_1_1,
} from "./types";
import { applyRules as applyBaseRules } from "./rules/base-rules";
import { applyRules as applySecrecyRules } from "./rules/secrecy-request-rules";
import { applyRules as applyGroomingRules } from "./rules/grooming-pattern-rules";
import { applyRules as applyCoercionRules } from "./rules/coercion-pressure-rules";
import { composeResult } from "./rules/compose";
import {
  classifyWithFrozenV1_0_0,
  computeConfidenceFrozenV1_0_0,
  resolveLevelFrozenV1_0_0,
} from "./rules/_frozen-v1-0-0";
import { applyRules as applyBaseRulesV1_1_0 } from "./rules/_frozen-v1-1-0/base-rules";
import { applyRules as applySecrecyRulesV1_1_0 } from "./rules/_frozen-v1-1-0/secrecy-request-rules";
import { applyRules as applyGroomingRulesV1_1_0 } from "./rules/_frozen-v1-1-0/grooming-pattern-rules";
import { applyRules as applyCoercionRulesV1_1_0 } from "./rules/_frozen-v1-1-0/coercion-pressure-rules";
import { composeResult as composeResultV1_1_0 } from "./rules/_frozen-v1-1-0/compose";

/** Fallback languages the classifier always considers · ships with
 *  English + Bahasa Indonesia. Expansion requires an ethics review. */
export const PHASE_1_LANGUAGES: readonly string[] = ["en", "id"];

/** Deliberately simple language detector · looks for a few high-signal
 *  Indonesian stopwords and defaults to English otherwise. */
export function detectLanguageHeuristic(text: string): string | null {
  if (text.trim().length === 0) return null;
  const lower = text.toLowerCase();
  const indonesian = [
    "yang",
    "tidak",
    "jangan",
    "saya",
    "kamu",
    "aku",
    "kami",
    "bisa",
    "sudah",
    "akan",
    "dari",
    "dengan",
    "untuk",
    "siapa",
    "apa",
    "mau",
  ];
  const hit = indonesian.some((w) =>
    new RegExp(`(^|\\P{L})${w}(\\P{L}|$)`, "u").test(lower),
  );
  if (hit) return "id";
  return "en";
}

/** PURE RESOLVER · delegates to the FROZEN v1.0.0 implementation so the
 *  existing classifier.test.ts cases keep passing untouched. New rule
 *  tuning lives in the rules/*.ts modules (see rules/README.md). */
export function resolveLevel(args: {
  readonly vocabulary: readonly VocabularyMatch[];
  readonly patterns: readonly PatternMatch[];
  readonly signals: ConversationSignals;
}): RiskLevel {
  return resolveLevelFrozenV1_0_0(args);
}

/** Confidence proxy · delegates to the FROZEN v1.0.0 implementation. */
export function computeConfidence(args: {
  readonly vocabulary: readonly VocabularyMatch[];
  readonly patterns: readonly PatternMatch[];
  readonly signals: ConversationSignals;
}): number {
  return computeConfidenceFrozenV1_0_0(args);
}

export interface ClassifyMessageInput {
  readonly messageText: string;
  readonly senderAccountId: string;
  readonly recipientAccountId: string;
  readonly conversationId: string | null;
  readonly detectedLanguage?: string;
  /** Optional · which ruleset version to run. Default v1.1.0. */
  readonly rulesetVersion?: SafechatRulesetVersion;
  /** Optional · hermetic history injection for test / eval callers.
   *  When provided, the aggregator uses this instead of a DB read. */
  readonly injectedHistory?: readonly PriorClassification[];
}

/** Run every category module and collect their outputs. Exposed for
 *  the eval runner so it can call the composer with the same module
 *  wiring the production classifier uses. v1.1.1 is the ACTIVE path.
 *  v1.1.0 reads from the sealed _frozen-v1-1-0/ snapshot. */
export function applyAllRuleModules(
  ctx: RuleModuleContext,
): readonly RuleModuleOutput[] {
  return [
    applyBaseRules(ctx),
    applySecrecyRules(ctx),
    applyGroomingRules(ctx),
    applyCoercionRules(ctx),
  ];
}

/** v1.1.0 frozen path · wires the sealed _frozen-v1-1-0/ snapshot
 *  modules through the sealed composer so Wave-1 behaviour stays
 *  reproducible under version="safechat-rules-v1.1.0". */
export function applyAllRuleModulesV1_1_0Frozen(
  ctx: RuleModuleContext,
): readonly RuleModuleOutput[] {
  return [
    applyBaseRulesV1_1_0(ctx),
    applySecrecyRulesV1_1_0(ctx),
    applyGroomingRulesV1_1_0(ctx),
    applyCoercionRulesV1_1_0(ctx),
  ];
}

export async function classifyMessage(
  input: ClassifyMessageInput,
): Promise<ClassificationResult> {
  const text = typeof input.messageText === "string" ? input.messageText : "";
  const normalisedText = normaliseForMatch(text);
  const languageDetected =
    input.detectedLanguage ?? detectLanguageHeuristic(text);
  const languages = PHASE_1_LANGUAGES;
  const version: SafechatRulesetVersion =
    input.rulesetVersion ?? SAFECHAT_CLASSIFIER_VERSION_V1_1_0;

  const [vocabIndex, compiledPatterns, signals] = await Promise.all([
    loadVocabularyForLanguages(languages),
    loadPatternsForLanguages(languages),
    aggregateSignals({
      conversationId: input.conversationId,
      injectedHistory: input.injectedHistory,
    }),
  ]);

  const vocabulary = matchVocabulary({ normalisedText, languages, vocabIndex });
  const patterns = matchPatterns({ text, languages, compiled: compiledPatterns });

  if (version === SAFECHAT_CLASSIFIER_VERSION_V1_0_0) {
    return classifyWithFrozenV1_0_0({
      vocabulary,
      patterns,
      signals,
      languageDetected,
    });
  }

  const ctx: RuleModuleContext = {
    text,
    normalisedText,
    language: languageDetected ?? "en",
    vocabularyMatches: vocabulary,
    patternMatches: patterns,
    conversationSignals: signals,
  };

  if (version === SAFECHAT_CLASSIFIER_VERSION_V1_1_0) {
    // v1.1.0 FROZEN SNAPSHOT · uses the _frozen-v1-1-0/ modules so the
    // sealed Wave-1 behaviour is reproducible for comparison.
    const outputs = applyAllRuleModulesV1_1_0Frozen(ctx);
    const composed = composeResultV1_1_0({
      moduleOutputs: outputs,
      vocabulary,
      patterns,
      signals,
      languageDetected,
      version,
    });
    return {
      level: composed.level,
      confidence: composed.confidence,
      ruleMatches: composed.ruleMatches,
      languageDetected: composed.languageDetected,
      signals: composed.signals,
      classifierVersion: composed.classifierVersion,
    };
  }

  // Default · v1.1.1 ACTIVE composition.
  const outputs = applyAllRuleModules(ctx);
  const composed = composeResult({
    moduleOutputs: outputs,
    vocabulary,
    patterns,
    signals,
    languageDetected,
    version,
  });

  // Strip the extra contributingSignalNames before persisting · the
  // ClassificationResult surface stays the shape callers already rely
  // on. The names are still consumed by in-memory callers (e.g. the
  // eval runner) via the composer directly.
  return {
    level: composed.level,
    confidence: composed.confidence,
    ruleMatches: composed.ruleMatches,
    languageDetected: composed.languageDetected,
    signals: composed.signals,
    classifierVersion: composed.classifierVersion,
  };
}
