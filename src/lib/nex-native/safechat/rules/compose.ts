// src/lib/nex-native/safechat/rules/compose.ts
//
// NEX SafeChat ruleset v1.1.0 · composition layer.
// ------------------------------------------------
// Takes outputs from every rule module and produces the final
// (level, confidence, contributingSignalNames) triple. The classifier
// turns this into a ClassificationResult.
//
// Doctrine:
//   · finalLevel = max(contributedLevel) across all modules.
//   · finalConfidence is a density-style blend (sum of weighted
//     contributedConfidence, capped at 1.0). It is NOT a probability.
//   · We also compute an "effective" generic Level-2 branch here
//     (not owned by any single category module) · it mirrors the
//     v1.0.0 "image_request / explicit_sexual / 2+ sensitive matches"
//     branch for messages that no category module escalated.

import type {
  ClassificationResult,
  ConversationSignals,
  PatternMatch,
  RiskLevel,
  RuleModuleOutput,
  SafechatRulesetVersion,
  VocabularyMatch,
} from "../types";
import { SAFECHAT_CLASSIFIER_VERSION_V1_1_0 } from "../types";

/** Compute the generic Level-2 fallback that is NOT owned by any
 *  single category module · preserves v1.0.0 behaviour for messages
 *  that fire isolated image_request / explicit_sexual / 2+ sensitive
 *  vocab matches without the richer grooming / coercion / secrecy
 *  context. */
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

/** Compose outputs from all rule modules into a final ClassificationResult.
 *
 *  classifierVersion is pinned to v1.1.0 · callers who want v1.0.0
 *  should route through _frozen-v1-0-0.ts instead of compose.ts. */
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

  // finalLevel = max across module outputs AND the generic branch.
  let maxLevel: RiskLevel = 0;
  for (const o of moduleOutputs) {
    if (o.contributedLevel > maxLevel) maxLevel = o.contributedLevel;
  }
  if (generic.level > maxLevel) maxLevel = generic.level;

  // Confidence · density blend. Clamp to [0, 1].
  let rawConfidence = 0;
  for (const o of moduleOutputs) rawConfidence += o.contributedConfidence;
  // Add a small amount for the generic-branch firing (preserves non-
  // zero confidence for messages that only the generic branch caught).
  if (generic.level > 0) rawConfidence += 0.4;
  // Signal-score blend (keeps v1.0.0 flavour).
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

  // Build ruleMatches from the raw vocabulary + pattern matches, same
  // shape as the baseline classifier produced.
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
