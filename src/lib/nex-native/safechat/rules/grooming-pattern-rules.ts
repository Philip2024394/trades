// src/lib/nex-native/safechat/rules/grooming-pattern-rules.ts
//
// NEX SafeChat ruleset v1.1.1 · GROOMING_PATTERN rule module.
// --------------------------------------------------------------------
// WAVE 1 (v1.1.0 · 2026-10-10) · replaced the v1.0.0 hard-coded
//   image_request + grooming_indicator conjunction with a transparent
//   scoring function. Fixed 6/14 Level-3 misses on the v2 corpus.
// WAVE 2 (v1.1.1 · 2026-10-10) · targeted regression fix. The v1.0.0
//   baseline fired Level 3 for the exact conjunction `age_gap_disclosure
//   + meeting_arrangement`; v1.1.0's generic 2+2 scoring produced only
//   Level 2 (score = 4). This under-called 2/85 Level-3 items on the v2
//   corpus (one EN, one code-switched). v1.1.1 adds a NEW compositional
//   scoring component · `age_gap_meeting_combination` · that fires only
//   when BOTH age_gap_disclosure AND meeting_arrangement are present in
//   the same message. The bonus is +2 → total 6 → Level 3, matching the
//   v1.0.0 baseline. All other grooming scoring components are
//   unchanged. The frozen v1.1.0 snapshot at _frozen-v1-1-0/ preserves
//   the Wave 1 behaviour for regression detection.
//
// Doctrine (per founder authorisation 2026-10-10):
//   · The scoring function is DETERMINISTIC + DOCUMENTED. The weights
//     and thresholds are reviewable in docs/doctrine/nex-safechat-rules-v1-1-1-*.md.
//   · The score reflects "how many grooming indicators fire in or around
//     this message" · it is NOT a probability.
//   · Thresholds are tuned for v1.1.0 (unchanged in v1.1.1) and reviewed
//     when the next evaluation wave runs.
//
// Scoring (v1.1.1 · sealed in doctrine):
//   +2  age_gap_disclosure (explicit age difference revealed)
//   +2  gift_offer_with_sexual_frame
//   +2  platform_switch_invitation
//   +2  meeting_arrangement with age/privacy context
//   +2  age_gap_meeting_combination (NEW v1.1.1 · compositional bonus
//        when BOTH age_gap_disclosure AND meeting_arrangement fire in
//        the SAME message · restores v1.0.0 baseline Level 3)
//   +3  isolation_request ("just you and me", "nobody else needs to know")
//   +3  flattery_followed_by_request
//   +3  trust_building_language
//   +3  explicit_image_request
//   +3  secrecy_request paired with sexual context
//
// Thresholds (unchanged):
//   ≥ 6  → Level 3 (serious_risk)
//   3–5  → Level 2 (potentially_unsafe)
//   1–2  → Level 1 (sensitive)
//   0    → Level 0 (clean · module does not contribute)
//
// Privacy invariant:
//   · contributingSignals is the LABEL of each scoring component that
//     fired (e.g. "age_gap_disclosure") · never body text.

import type {
  RiskLevel,
  RuleModule,
  RuleModuleContext,
  RuleModuleOutput,
} from "../types";

export const GROOMING_PATTERN_MODULE_NAME = "grooming_pattern";

/** Scoring weight per contributing signal. Changing a weight is a
 *  ruleset change and MUST be reflected in the doctrine + fixture.
 *  v1.1.1 adds `age_gap_meeting_combination` (see module comment). */
export const GROOMING_SCORE_WEIGHTS = {
  age_gap_disclosure: 2,
  gift_offer_with_sexual_frame: 2,
  platform_switch_invitation: 2,
  meeting_arrangement_with_age_or_privacy_context: 2,
  age_gap_meeting_combination: 2,
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

/** Compute the grooming score for a message in context. Exposed for
 *  tests so weight / threshold decisions are directly auditable. */
export function computeGroomingScore(
  ctx: RuleModuleContext,
): GroomingScoreBreakdown {
  const components: string[] = [];
  let score = 0;

  // +3 · explicit image request (either as pattern or image_request vocab)
  if (hasPattern(ctx, "image_request") || hasVocab(ctx, "image_request")) {
    components.push("explicit_image_request");
    score += GROOMING_SCORE_WEIGHTS.explicit_image_request;
  }

  // +3 · isolation_request pattern
  if (hasPattern(ctx, "isolation_request")) {
    components.push("isolation_request");
    score += GROOMING_SCORE_WEIGHTS.isolation_request;
  }

  // +3 · flattery_followed_by_request pattern
  if (hasPattern(ctx, "flattery_followed_by_request")) {
    components.push("flattery_followed_by_request");
    score += GROOMING_SCORE_WEIGHTS.flattery_followed_by_request;
  }

  // +3 · trust_building_language pattern OR grooming_indicator vocab
  // (grooming_indicator vocab covers phrases like "our little secret",
  // "you're so mature" from the baseline seed · the dedicated
  // trust_building_language pattern is the v1.1.0 extension).
  if (
    hasPattern(ctx, "trust_building_language") ||
    hasVocab(ctx, "grooming_indicator")
  ) {
    components.push("trust_building_language");
    score += GROOMING_SCORE_WEIGHTS.trust_building_language;
  }

  // +3 · secrecy_request paired with sexual context (vocab or pattern)
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

  // +2 · age_gap_disclosure pattern
  if (hasPattern(ctx, "age_gap_disclosure")) {
    components.push("age_gap_disclosure");
    score += GROOMING_SCORE_WEIGHTS.age_gap_disclosure;
  }

  // +2 · gift_offer_with_sexual_frame pattern
  if (hasPattern(ctx, "gift_offer_with_sexual_frame")) {
    components.push("gift_offer_with_sexual_frame");
    score += GROOMING_SCORE_WEIGHTS.gift_offer_with_sexual_frame;
  }

  // +2 · platform_switch_invitation pattern
  if (hasPattern(ctx, "platform_switch_invitation")) {
    components.push("platform_switch_invitation");
    score += GROOMING_SCORE_WEIGHTS.platform_switch_invitation;
  }

  // +2 · meeting_arrangement combined with age / privacy context
  //      (age-gap pattern OR secrecy_request OR grooming_indicator)
  const meetingArrangementFired =
    hasPattern(ctx, "meeting_arrangement") ||
    hasVocab(ctx, "meeting_arrangement");
  if (meetingArrangementFired) {
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

  // +2 · v1.1.1 · age_gap_meeting_combination · fires ONLY when BOTH
  //      age_gap_disclosure AND meeting_arrangement are present in the
  //      SAME message. Restores the v1.0.0 baseline Level-3 escalation
  //      for the sealed age_gap_disclosure_meeting conjunction.
  //      Stacks on top of age_gap_disclosure (+2) and the
  //      meeting_arrangement_with_age_or_privacy_context (+2) scores to
  //      produce a total of 6 (= Level 3).
  if (hasPattern(ctx, "age_gap_disclosure") && meetingArrangementFired) {
    components.push("age_gap_meeting_combination");
    score += GROOMING_SCORE_WEIGHTS.age_gap_meeting_combination;
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
  // Monotonic in score · caps at 0.95. Not a probability.
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
