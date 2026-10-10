// src/lib/nex-native/safechat/rules/_frozen-v1-0-0.ts
//
// NEX SafeChat classifier · FROZEN BASELINE · v1.0.0
// ---------------------------------------------------
// This file is a verbatim snapshot of the Phase 1 baseline resolver +
// confidence functions as they shipped on 2026-10-10 (classifier
// version safechat-rules-v1.0.0).
//
// DO NOT MODIFY.
//
// It exists so the Ruleset Tuning Wave 1 revision (v1.1.0) can run
// side-by-side comparisons via the evaluation runner (R-CORPUS owns
// the corpus + runner · we own the frozen baseline + revised rules).
// New rule changes land in rules/*.ts files (NOT here) and bump the
// ruleset version to v1.1.0+ in types.ts.
//
// INVARIANT: the output of resolveLevelFrozenV1_0_0 + computeConfidenceFrozenV1_0_0
// must be byte-identical to the output of classifier.ts::resolveLevel +
// classifier.ts::computeConfidence as they stood at the 2026-10-10 freeze.

import type {
  ClassificationResult,
  ConversationSignals,
  PatternMatch,
  RiskLevel,
  SafechatRulesetVersion,
  VocabularyMatch,
} from "../types";
import { SAFECHAT_CLASSIFIER_VERSION_V1_0_0 } from "../types";

/** Pure resolver · translates the raw match set into a RiskLevel.
 *  FROZEN BASELINE · v1.0.0 · 2026-10-10. */
export function resolveLevelFrozenV1_0_0(args: {
  readonly vocabulary: readonly VocabularyMatch[];
  readonly patterns: readonly PatternMatch[];
  readonly signals: ConversationSignals;
}): RiskLevel {
  const { vocabulary, patterns, signals } = args;

  const vocabCategories = new Set(vocabulary.map((v) => v.category));
  const patternSignals = new Set(patterns.map((p) => p.signalType));
  const highestVocabSeverity = vocabulary.reduce(
    (max, v) => (v.severity > max ? v.severity : max),
    0,
  );
  const sensitiveMatchCount = vocabulary.filter(
    (v) =>
      v.category === "sexual_slang" || v.category === "coercion_indicator",
  ).length;

  // Level 3 · serious_risk
  //  · image_request pattern + grooming_indicator vocab
  //  · meeting_arrangement pattern + age_gap_disclosure pattern
  //  · repeated_pressure_after_refusal signal
  if (
    (patternSignals.has("image_request") &&
      vocabCategories.has("grooming_indicator")) ||
    (patternSignals.has("meeting_arrangement") &&
      patternSignals.has("age_gap_disclosure")) ||
    signals.repeated_pressure_after_refusal
  ) {
    return 3;
  }

  // Level 2 · potentially_unsafe
  //  · image_request pattern
  //  · explicit_sexual vocabulary
  //  · >= 2 sensitive-category vocabulary matches
  //  · coercion_indicator vocabulary
  if (
    patternSignals.has("image_request") ||
    vocabCategories.has("explicit_sexual") ||
    sensitiveMatchCount >= 2 ||
    vocabCategories.has("coercion_indicator")
  ) {
    return 2;
  }

  // Level 1 · sensitive
  //  · only sexual_slang severity 1 and no patterns
  if (
    vocabCategories.has("sexual_slang") &&
    patterns.length === 0 &&
    highestVocabSeverity <= 1
  ) {
    return 1;
  }

  // Level 0 · clean
  return 0;
}

/** Compute a 0..1 confidence proxy. FROZEN BASELINE · v1.0.0 · 2026-10-10. */
export function computeConfidenceFrozenV1_0_0(args: {
  readonly vocabulary: readonly VocabularyMatch[];
  readonly patterns: readonly PatternMatch[];
  readonly signals: ConversationSignals;
}): number {
  const { vocabulary, patterns, signals } = args;
  const vocabScore = vocabulary.reduce((acc, v) => acc + v.severity, 0) * 0.1;
  const patternScore = patterns.reduce((acc, p) => acc + p.severity, 0) * 0.15;
  const signalScore =
    (signals.repeated_pressure_after_refusal ? 0.3 : 0) +
    (signals.escalation_pattern ? 0.15 : 0) +
    (signals.time_pressure ? 0.1 : 0) +
    (signals.platform_switch_invitation ? 0.1 : 0);
  const raw = vocabScore + patternScore + signalScore;
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return Math.round(raw * 1000) / 1000;
}

/** Compose a ClassificationResult using ONLY the frozen v1.0.0 rules.
 *  Mirrors the shape the sealed baseline classifier returned. */
export function classifyWithFrozenV1_0_0(args: {
  readonly vocabulary: readonly VocabularyMatch[];
  readonly patterns: readonly PatternMatch[];
  readonly signals: ConversationSignals;
  readonly languageDetected: string | null;
}): ClassificationResult {
  const level = resolveLevelFrozenV1_0_0(args);
  const confidence = computeConfidenceFrozenV1_0_0(args);
  const ruleMatches = [
    ...args.vocabulary.map((v) => ({
      kind: "vocabulary" as const,
      id: v.termId,
      category: v.category,
      severity: v.severity,
      language: v.language,
      term: v.term,
    })),
    ...args.patterns.map((p) => ({
      kind: "pattern" as const,
      id: p.patternId,
      signalType: p.signalType,
      severity: p.severity,
      language: p.language,
      matchedText: p.matchedText,
    })),
  ];
  const version: SafechatRulesetVersion = SAFECHAT_CLASSIFIER_VERSION_V1_0_0;
  return {
    level,
    confidence,
    ruleMatches,
    languageDetected: args.languageDetected,
    signals: args.signals,
    classifierVersion: version,
  };
}
