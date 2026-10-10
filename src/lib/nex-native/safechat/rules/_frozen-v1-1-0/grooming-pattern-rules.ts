// DO NOT MODIFY. Frozen snapshot of safechat-rules-v1.1.0 for comparison.
// Any ruleset changes land in the active rules/*.ts files and bump the version.
// Frozen 2026-10-10 after Wave 1.
//
// Verbatim snapshot of src/lib/nex-native/safechat/rules/grooming-pattern-rules.ts
// as it stood at the end of Ruleset Tuning Wave 1 (v1.1.0). See the active file
// for the current (v1.1.1) implementation.

import type {
  RiskLevel,
  RuleModule,
  RuleModuleContext,
  RuleModuleOutput,
} from "../../types";

export const GROOMING_PATTERN_MODULE_NAME = "grooming_pattern";

export const GROOMING_SCORE_WEIGHTS = {
  age_gap_disclosure: 2,
  gift_offer_with_sexual_frame: 2,
  platform_switch_invitation: 2,
  meeting_arrangement_with_age_or_privacy_context: 2,
  isolation_request: 3,
  flattery_followed_by_request: 3,
  trust_building_language: 3,
  explicit_image_request: 3,
  secrecy_with_sexual_context: 3,
} as const;

export const GROOMING_LEVEL_THRESHOLDS = {
  level_3: 6,
  level_2: 3,
  level_1: 1,
} as const;

export interface GroomingScoreBreakdown {
  readonly score: number;
  readonly components: readonly string[];
}

function hasVocab(ctx: RuleModuleContext, category: string): boolean {
  return ctx.vocabularyMatches.some((v) => v.category === category);
}
function hasPattern(ctx: RuleModuleContext, signal: string): boolean {
  return ctx.patternMatches.some((p) => p.signalType === signal);
}

export function computeGroomingScore(
  ctx: RuleModuleContext,
): GroomingScoreBreakdown {
  const components: string[] = [];
  let score = 0;

  if (hasPattern(ctx, "image_request") || hasVocab(ctx, "image_request")) {
    components.push("explicit_image_request");
    score += GROOMING_SCORE_WEIGHTS.explicit_image_request;
  }

  if (hasPattern(ctx, "isolation_request")) {
    components.push("isolation_request");
    score += GROOMING_SCORE_WEIGHTS.isolation_request;
  }

  if (hasPattern(ctx, "flattery_followed_by_request")) {
    components.push("flattery_followed_by_request");
    score += GROOMING_SCORE_WEIGHTS.flattery_followed_by_request;
  }

  if (
    hasPattern(ctx, "trust_building_language") ||
    hasVocab(ctx, "grooming_indicator")
  ) {
    components.push("trust_building_language");
    score += GROOMING_SCORE_WEIGHTS.trust_building_language;
  }

  const secrecyFired =
    hasVocab(ctx, "secrecy_request") || hasPattern(ctx, "secrecy_request");
  const sexualContext =
    hasVocab(ctx, "sexual_slang") ||
    hasVocab(ctx, "explicit_sexual") ||
    hasPattern(ctx, "image_request");
  if (secrecyFired && sexualContext) {
    components.push("secrecy_with_sexual_context");
    score += GROOMING_SCORE_WEIGHTS.secrecy_with_sexual_context;
  }

  if (hasPattern(ctx, "age_gap_disclosure")) {
    components.push("age_gap_disclosure");
    score += GROOMING_SCORE_WEIGHTS.age_gap_disclosure;
  }

  if (hasPattern(ctx, "gift_offer_with_sexual_frame")) {
    components.push("gift_offer_with_sexual_frame");
    score += GROOMING_SCORE_WEIGHTS.gift_offer_with_sexual_frame;
  }

  if (hasPattern(ctx, "platform_switch_invitation")) {
    components.push("platform_switch_invitation");
    score += GROOMING_SCORE_WEIGHTS.platform_switch_invitation;
  }

  if (hasPattern(ctx, "meeting_arrangement") || hasVocab(ctx, "meeting_arrangement")) {
    const ageOrPrivacyCtx =
      hasPattern(ctx, "age_gap_disclosure") ||
      hasPattern(ctx, "secrecy_request") ||
      hasVocab(ctx, "secrecy_request") ||
      hasVocab(ctx, "grooming_indicator");
    if (ageOrPrivacyCtx) {
      components.push("meeting_arrangement_with_age_or_privacy_context");
      score +=
        GROOMING_SCORE_WEIGHTS.meeting_arrangement_with_age_or_privacy_context;
    }
  }

  return { score, components };
}

function thresholdToLevel(score: number): RiskLevel {
  if (score >= GROOMING_LEVEL_THRESHOLDS.level_3) return 3;
  if (score >= GROOMING_LEVEL_THRESHOLDS.level_2) return 2;
  if (score >= GROOMING_LEVEL_THRESHOLDS.level_1) return 1;
  return 0;
}

function confidenceFromScore(score: number): number {
  if (score <= 0) return 0;
  const raw = Math.min(0.95, 0.1 + score * 0.1);
  return Math.round(raw * 1000) / 1000;
}

export const applyRules: RuleModule = (
  ctx: RuleModuleContext,
): RuleModuleOutput => {
  const breakdown = computeGroomingScore(ctx);
  const level = thresholdToLevel(breakdown.score);
  if (level === 0) {
    return {
      moduleName: GROOMING_PATTERN_MODULE_NAME,
      contributedLevel: 0,
      contributedConfidence: 0,
      contributingSignals: [],
    };
  }
  return {
    moduleName: GROOMING_PATTERN_MODULE_NAME,
    contributedLevel: level,
    contributedConfidence: confidenceFromScore(breakdown.score),
    contributingSignals: breakdown.components,
  };
};
