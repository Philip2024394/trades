// src/lib/nex-native/safechat/rules/coercion-pressure-rules.ts
//
// NEX SafeChat ruleset v1.1.0 · COERCION_PRESSURE rule module (R3 fix).
// ---------------------------------------------------------------------
// Fixes the v1.0.0 gap where coercion-pressure signals require a
// multi-message conversation but the aggregator reads only the DB
// (classifier.test cannot drive history, so the eval runner cannot
// construct this evidence hermetically · 5/12 misses).
//
// This module reads EXCLUSIVELY from the ConversationSignals that the
// (extended) aggregator produced · it does NOT re-derive history. The
// aggregator now accepts an injectedHistory parameter so hermetic
// multi-message tests can wire up these signals without the DB. See
// conversation-signal-aggregator.ts.
//
// Doctrine (per founder authorisation 2026-10-10):
//   · repeated_request_after_refusal === true → always Level 3,
//     regardless of individual message content. This is the sealed
//     Level 3 branch mentioned in the baseline doctrine ("repeated
//     pressure after refusal") now wired to a conversation-level
//     signal that the eval runner can inject hermetically.
//   · pressure_density > threshold AND the current message contains
//     any sexual-category match → Level 3.
//   · platform_switch_already_proposed === true AND current message
//     matches meeting_arrangement → Level 3.
//   · Single-message classification (historyWindowCount === 0) does
//     NOT inherit coercion escalation. This preserves the base
//     invariant: "no history, no history-based escalation."
//   · Pure Level 2 fallback: coercion_indicator vocab in the current
//     message · existing baseline behaviour, preserved here.
//
// Privacy invariant:
//   · contributingSignals carries only signal names from the
//     ConversationSignals struct · never body text.

import type {
  RuleModule,
  RuleModuleContext,
  RuleModuleOutput,
} from "../types";

export const COERCION_PRESSURE_MODULE_NAME = "coercion_pressure";

/** Density threshold · requests per minute. Reviewable in doctrine. */
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

  // ---- Level 3 branches · all require history --------------------
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
      // Escalating severity alone doesn't go to Level 3 · but if
      // paired with an in-message sexual signal, it's Level 2.
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

  // ---- Single-message fallback · coercion_indicator vocab -------
  // Preserves the v1.0.0 behaviour: coercion_indicator vocab in a
  // single message is Level 2. We do NOT escalate this to Level 3
  // without multi-message evidence.
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
