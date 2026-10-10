// DO NOT MODIFY. Frozen snapshot of safechat-rules-v1.1.0 for comparison.
// Any ruleset changes land in the active rules/*.ts files and bump the version.
// Frozen 2026-10-10 after Wave 1.
//
// Verbatim snapshot of src/lib/nex-native/safechat/rules/coercion-pressure-rules.ts
// as it stood at the end of Ruleset Tuning Wave 1 (v1.1.0). See the active file
// for the current (v1.1.1) implementation.

import type {
  RuleModule,
  RuleModuleContext,
  RuleModuleOutput,
} from "../../types";

export const COERCION_PRESSURE_MODULE_NAME = "coercion_pressure";

export const COERCION_PRESSURE_DENSITY_THRESHOLD = 1.0;

function hasVocab(ctx: RuleModuleContext, category: string): boolean {
  return ctx.vocabularyMatches.some((v) => v.category === category);
}
function hasPattern(ctx: RuleModuleContext, signal: string): boolean {
  return ctx.patternMatches.some((p) => p.signalType === signal);
}
function hasAnySexualSignal(ctx: RuleModuleContext): boolean {
  return (
    hasVocab(ctx, "sexual_slang") ||
    hasVocab(ctx, "explicit_sexual") ||
    hasVocab(ctx, "grooming_indicator") ||
    hasVocab(ctx, "image_request") ||
    hasPattern(ctx, "image_request")
  );
}

export const applyRules: RuleModule = (
  ctx: RuleModuleContext,
): RuleModuleOutput => {
  const sigs = ctx.conversationSignals;
  const signals: string[] = [];

  const hasHistory = (sigs.historyWindowCount ?? 0) > 0;

  if (hasHistory) {
    if (
      sigs.repeated_request_after_refusal === true ||
      sigs.repeated_pressure_after_refusal === true
    ) {
      signals.push("repeated_request_after_refusal");
      return {
        moduleName: COERCION_PRESSURE_MODULE_NAME,
        contributedLevel: 3,
        contributedConfidence: 0.9,
        contributingSignals: signals,
      };
    }

    const density = typeof sigs.pressure_density === "number"
      ? sigs.pressure_density
      : 0;
    if (
      density > COERCION_PRESSURE_DENSITY_THRESHOLD &&
      hasAnySexualSignal(ctx)
    ) {
      signals.push("pressure_density_over_threshold");
      signals.push("sexual_signal_in_current_message");
      return {
        moduleName: COERCION_PRESSURE_MODULE_NAME,
        contributedLevel: 3,
        contributedConfidence: 0.85,
        contributingSignals: signals,
      };
    }

    if (
      (sigs.platform_switch_already_proposed === true ||
        sigs.platform_switch_invitation) &&
      (hasPattern(ctx, "meeting_arrangement") ||
        hasVocab(ctx, "meeting_arrangement"))
    ) {
      signals.push("platform_switch_in_history");
      signals.push("meeting_arrangement_in_message");
      return {
        moduleName: COERCION_PRESSURE_MODULE_NAME,
        contributedLevel: 3,
        contributedConfidence: 0.8,
        contributingSignals: signals,
      };
    }

    if (sigs.escalating_severity_pattern === true || sigs.escalation_pattern) {
      if (hasAnySexualSignal(ctx)) {
        signals.push("escalating_severity_pattern");
        signals.push("sexual_signal_in_current_message");
        return {
          moduleName: COERCION_PRESSURE_MODULE_NAME,
          contributedLevel: 2,
          contributedConfidence: 0.55,
          contributingSignals: signals,
        };
      }
    }
  }

  if (hasVocab(ctx, "coercion_indicator")) {
    signals.push("coercion_indicator_in_message");
    return {
      moduleName: COERCION_PRESSURE_MODULE_NAME,
      contributedLevel: 2,
      contributedConfidence: 0.45,
      contributingSignals: signals,
    };
  }

  return {
    moduleName: COERCION_PRESSURE_MODULE_NAME,
    contributedLevel: 0,
    contributedConfidence: 0,
    contributingSignals: [],
  };
};
