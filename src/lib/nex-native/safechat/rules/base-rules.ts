// src/lib/nex-native/safechat/rules/base-rules.ts
//
// NEX SafeChat ruleset v1.1.0 · BASE rule module.
// -------------------------------------------------
// Owns the Level 0 ("clean") and Level 1 ("sensitive · isolated slang")
// branches of the resolver. The v1.0.0 baseline shipped these inside a
// single resolveLevel function; v1.1.0 splits them into their own
// module so category-specific modules (secrecy / grooming / coercion)
// can be reasoned about in isolation and the privacy audit can grep
// signal names rather than guess which file produced them.
//
// Doctrine:
//   · This module NEVER emits a Level >= 2 decision. Those are owned
//     by the category modules (grooming / secrecy / coercion) and the
//     v1.0.0 "generic" Level 2 branch, which lives in compose.ts.
//   · Returning Level 0 does NOT suppress other modules · compose.ts
//     takes the max across all modules.
//   · Signal names are category labels, never body text.
//
// Privacy invariant:
//   · contributingSignals is a list of VOCAB_CATEGORIES / SIGNAL_TYPES
//     strings, never a slice of the message body.

import type {
  RuleModule,
  RuleModuleContext,
  RuleModuleOutput,
} from "../types";

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
