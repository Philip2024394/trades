// DO NOT MODIFY. Frozen snapshot of safechat-rules-v1.1.0 for comparison.
// Any ruleset changes land in the active rules/*.ts files and bump the version.
// Frozen 2026-10-10 after Wave 1.
//
// Verbatim snapshot of src/lib/nex-native/safechat/rules/base-rules.ts as it
// stood at the end of Ruleset Tuning Wave 1 (v1.1.0). See the active file
// for the current (v1.1.1) implementation.

import type {
  RuleModule,
  RuleModuleContext,
  RuleModuleOutput,
} from "../../types";

export const BASE_RULES_MODULE_NAME = "base";

export const applyRules: RuleModule = (
  ctx: RuleModuleContext,
): RuleModuleOutput => {
  const { vocabularyMatches: vocabulary, patternMatches: patterns } = ctx;

  const vocabCategories = new Set(vocabulary.map((v) => v.category));
  const highestVocabSeverity = vocabulary.reduce(
    (max, v) => (v.severity > max ? v.severity : max),
    0,
  );

  // Level 1 · sexual_slang severity 1 only, no patterns · "ordinary
  // slang in isolation" branch. Mirrors v1.0.0 exactly.
  if (
    vocabCategories.has("sexual_slang") &&
    patterns.length === 0 &&
    highestVocabSeverity <= 1
  ) {
    return {
      moduleName: BASE_RULES_MODULE_NAME,
      contributedLevel: 1,
      contributedConfidence: 0.15,
      contributingSignals: ["sexual_slang"],
    };
  }

  // Level 0 · nothing fired here. Other modules may still escalate.
  return {
    moduleName: BASE_RULES_MODULE_NAME,
    contributedLevel: 0,
    contributedConfidence: 0,
    contributingSignals: [],
  };
};
