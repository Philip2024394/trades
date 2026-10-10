// DO NOT MODIFY. Frozen snapshot of safechat-rules-v1.1.0 for comparison.
// Any ruleset changes land in the active rules/*.ts files and bump the version.
// Frozen 2026-10-10 after Wave 1.
//
// Verbatim snapshot of src/lib/nex-native/safechat/rules/compose.ts as it
// stood at the end of Ruleset Tuning Wave 1 (v1.1.0). See the active file
// for the current (v1.1.1) implementation.

import type {
  ClassificationResult,
  ConversationSignals,
  PatternMatch,
  RiskLevel,
  RuleModuleOutput,
  SafechatRulesetVersion,
  VocabularyMatch,
} from "../../types";
import { SAFECHAT_CLASSIFIER_VERSION_V1_1_0 } from "../../types";

export function genericLevelTwoFromMatches(args: {
  readonly vocabulary: readonly VocabularyMatch[];
  readonly patterns: readonly PatternMatch[];
}): { level: RiskLevel; signals: readonly string[] } {
  const vocabCategories = new Set(args.vocabulary.map((v) => v.category));
  const patternSignals = new Set(args.patterns.map((p) => p.signalType));
  const sensitiveMatchCount = args.vocabulary.filter(
    (v) => v.category === "sexual_slang" || v.category === "coercion_indicator",
  ).length;

  const sigs: string[] = [];
  let fires = false;

  if (patternSignals.has("image_request")) {
    sigs.push("image_request");
    fires = true;
  }
  if (vocabCategories.has("explicit_sexual")) {
    sigs.push("explicit_sexual");
    fires = true;
  }
  if (vocabCategories.has("coercion_indicator")) {
    sigs.push("coercion_indicator");
    fires = true;
  }
  if (sensitiveMatchCount >= 2) {
    sigs.push("multiple_sensitive_matches");
    fires = true;
  }

  return { level: fires ? 2 : 0, signals: sigs };
}

export function composeResult(args: {
  readonly moduleOutputs: readonly RuleModuleOutput[];
  readonly vocabulary: readonly VocabularyMatch[];
  readonly patterns: readonly PatternMatch[];
  readonly signals: ConversationSignals;
  readonly languageDetected: string | null;
  readonly version?: SafechatRulesetVersion;
}): ClassificationResult & { readonly contributingSignalNames: readonly string[] } {
  const { moduleOutputs, vocabulary, patterns, signals, languageDetected } =
    args;

  const generic = genericLevelTwoFromMatches({ vocabulary, patterns });

  let maxLevel: RiskLevel = 0;
  for (const o of moduleOutputs) {
    if (o.contributedLevel > maxLevel) maxLevel = o.contributedLevel;
  }
  if (generic.level > maxLevel) maxLevel = generic.level;

  let rawConfidence = 0;
  for (const o of moduleOutputs) rawConfidence += o.contributedConfidence;
  if (generic.level > 0) rawConfidence += 0.4;
  rawConfidence +=
    (signals.repeated_pressure_after_refusal ? 0.3 : 0) +
    (signals.escalation_pattern ? 0.15 : 0) +
    (signals.time_pressure ? 0.1 : 0) +
    (signals.platform_switch_invitation ? 0.1 : 0);

  const finalConfidence = rawConfidence <= 0
    ? 0
    : rawConfidence >= 1
      ? 1
      : Math.round(rawConfidence * 1000) / 1000;

  const contributing: string[] = [];
  for (const o of moduleOutputs) {
    for (const s of o.contributingSignals) contributing.push(s);
  }
  for (const s of generic.signals) contributing.push(s);

  const ruleMatches = [
    ...vocabulary.map((v) => ({
      kind: "vocabulary" as const,
      id: v.termId,
      category: v.category,
      severity: v.severity,
      language: v.language,
      term: v.term,
    })),
    ...patterns.map((p) => ({
      kind: "pattern" as const,
      id: p.patternId,
      signalType: p.signalType,
      severity: p.severity,
      language: p.language,
      matchedText: p.matchedText,
    })),
  ];

  return {
    level: maxLevel,
    confidence: finalConfidence,
    ruleMatches,
    languageDetected,
    signals,
    classifierVersion: args.version ?? SAFECHAT_CLASSIFIER_VERSION_V1_1_0,
    contributingSignalNames: contributing,
  };
}
