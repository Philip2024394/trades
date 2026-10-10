// src/lib/nex-native/safechat/rules/grooming-pattern-rules.test.ts

import { describe, expect, test } from "vitest";
import {
  applyRules,
  computeGroomingScore,
  GROOMING_LEVEL_THRESHOLDS,
  GROOMING_PATTERN_MODULE_NAME,
  GROOMING_SCORE_WEIGHTS,
} from "./grooming-pattern-rules";
import type {
  ConversationSignals,
  PatternMatch,
  RuleModuleContext,
  VocabularyMatch,
} from "../types";

function neutralSignals(): ConversationSignals {
  return {
    repeated_pressure_after_refusal: false,
    escalation_pattern: false,
    time_pressure: false,
    platform_switch_invitation: false,
    historyWindowCount: 0,
  };
}

function v(
  category: VocabularyMatch["category"],
  severity: VocabularyMatch["severity"] = 2,
): VocabularyMatch {
  return {
    termId: `v-${category}-${severity}`,
    term: category,
    category,
    severity,
    language: "en",
  };
}

function p(signalType: PatternMatch["signalType"]): PatternMatch {
  return {
    patternId: `p-${signalType}`,
    signalType,
    severity: 2,
    language: "en",
    matchedText: `[${signalType}]`,
  };
}

function ctx(
  vocab: readonly VocabularyMatch[] = [],
  patterns: readonly PatternMatch[] = [],
  text: string = "sample",
): RuleModuleContext {
  return {
    text,
    normalisedText: text.toLowerCase(),
    language: "en",
    vocabularyMatches: vocab,
    patternMatches: patterns,
    conversationSignals: neutralSignals(),
  };
}

describe("grooming-pattern-rules · weights are documented constants", () => {
  test("explicit_image_request weight is 3", () => {
    expect(GROOMING_SCORE_WEIGHTS.explicit_image_request).toBe(3);
  });
  test("age_gap_disclosure weight is 2", () => {
    expect(GROOMING_SCORE_WEIGHTS.age_gap_disclosure).toBe(2);
  });
  test("thresholds are 1 / 3 / 6", () => {
    expect(GROOMING_LEVEL_THRESHOLDS.level_1).toBe(1);
    expect(GROOMING_LEVEL_THRESHOLDS.level_2).toBe(3);
    expect(GROOMING_LEVEL_THRESHOLDS.level_3).toBe(6);
  });
});

describe("grooming-pattern-rules · scoring", () => {
  test("empty context · score 0", () => {
    const b = computeGroomingScore(ctx());
    expect(b.score).toBe(0);
    expect(b.components).toEqual([]);
  });

  test("image_request pattern alone · 3", () => {
    const b = computeGroomingScore(ctx([], [p("image_request")]));
    expect(b.score).toBe(3);
    expect(b.components).toContain("explicit_image_request");
  });

  test("age_gap alone · 2", () => {
    const b = computeGroomingScore(ctx([], [p("age_gap_disclosure")]));
    expect(b.score).toBe(2);
  });

  test("image_request + grooming_indicator vocab · 6 (crosses Level 3)", () => {
    const b = computeGroomingScore(
      ctx([v("grooming_indicator", 3)], [p("image_request")]),
    );
    expect(b.score).toBe(6);
    expect(b.components).toContain("explicit_image_request");
    expect(b.components).toContain("trust_building_language");
  });

  test("image_request + platform_switch · 5 (Level 2)", () => {
    const b = computeGroomingScore(
      ctx([], [p("image_request"), p("platform_switch_invitation")]),
    );
    expect(b.score).toBe(5);
  });

  test("secrecy + explicit_sexual · 3 (secrecy_with_sexual_context)", () => {
    const b = computeGroomingScore(
      ctx([v("secrecy_request", 3), v("explicit_sexual", 2)], []),
    );
    expect(b.components).toContain("secrecy_with_sexual_context");
    expect(b.score).toBe(3);
  });

  test("meeting_arrangement alone · 0", () => {
    const b = computeGroomingScore(ctx([], [p("meeting_arrangement")]));
    expect(b.score).toBe(0);
  });

  test("v1.1.1 · meeting_arrangement + age_gap_disclosure · 6 (combination bonus)", () => {
    // v1.1.0 behaviour: age_gap (+2) + meeting_arrangement_with_age_or_privacy_context (+2) = 4 → Level 2.
    // v1.1.1 adds age_gap_meeting_combination (+2) → total 6 → Level 3.
    // The frozen v1.1.0 snapshot at _frozen-v1-1-0/ keeps the Level 2
    // behaviour for comparison.
    const b = computeGroomingScore(
      ctx([], [p("meeting_arrangement"), p("age_gap_disclosure")]),
    );
    expect(b.score).toBe(6);
    expect(b.components).toContain(
      "meeting_arrangement_with_age_or_privacy_context",
    );
    expect(b.components).toContain("age_gap_disclosure");
    expect(b.components).toContain("age_gap_meeting_combination");
  });

  test("isolation_request · 3", () => {
    const b = computeGroomingScore(ctx([], [p("isolation_request")]));
    expect(b.score).toBe(3);
  });

  test("flattery_followed_by_request + trust_building_language · 3 + 3 = 6", () => {
    const b = computeGroomingScore(
      ctx(
        [],
        [p("flattery_followed_by_request"), p("trust_building_language")],
      ),
    );
    expect(b.score).toBe(6);
  });
});

describe("grooming-pattern-rules · levels", () => {
  test("module name is 'grooming_pattern'", () => {
    const out = applyRules(ctx());
    expect(out.moduleName).toBe(GROOMING_PATTERN_MODULE_NAME);
  });

  test("empty · Level 0, no signals", () => {
    const out = applyRules(ctx());
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toEqual([]);
  });

  test("Level 1 · age_gap alone (score 2 → wait, that's score 2 not 1)", () => {
    const out = applyRules(ctx([], [p("age_gap_disclosure")]));
    expect(out.contributedLevel).toBe(1);
    expect(out.contributingSignals).toContain("age_gap_disclosure");
  });

  test("Level 2 · image_request alone (score 3)", () => {
    const out = applyRules(ctx([], [p("image_request")]));
    expect(out.contributedLevel).toBe(2);
  });

  test("Level 3 · image_request + grooming_indicator (score 6)", () => {
    const out = applyRules(
      ctx([v("grooming_indicator", 3)], [p("image_request")]),
    );
    expect(out.contributedLevel).toBe(3);
  });

  test("REGRESSION ANCHOR v1.1.1 · age_gap + meeting_arrangement alone · Level 3", () => {
    // v2 corpus items v2-en-serious-013 and v2-mix-serious-004 are the
    // sealed anchors. v1.0.0 was Level 3; v1.1.0 regressed to Level 2;
    // v1.1.1 restores Level 3 via the age_gap_meeting_combination
    // scoring bonus. The two anchors are intentionally minimal: no
    // additional vocab or patterns, just the two pattern signals.
    const out = applyRules(
      ctx([], [p("age_gap_disclosure"), p("meeting_arrangement")]),
    );
    expect(out.contributedLevel).toBe(3);
    expect(out.contributingSignals).toContain("age_gap_meeting_combination");
  });

  test("REGRESSION ANCHOR v1.1.1 · meeting_arrangement vocab + age_gap · Level 3", () => {
    // Variant · meeting_arrangement arrives via vocab rather than
    // pattern (e.g. Indonesian 'ketemuan') · same escalation.
    const out = applyRules(
      ctx(
        [v("meeting_arrangement", 2, "id")],
        [p("age_gap_disclosure")],
      ),
    );
    expect(out.contributedLevel).toBe(3);
    expect(out.contributingSignals).toContain("age_gap_meeting_combination");
  });

  test("REGRESSION ANCHOR v1.1.1 · age_gap alone is still Level 1 (bonus only on combination)", () => {
    const out = applyRules(ctx([], [p("age_gap_disclosure")]));
    expect(out.contributedLevel).toBe(1);
    expect(out.contributingSignals).not.toContain("age_gap_meeting_combination");
  });

  test("REGRESSION ANCHOR v1.1.1 · meeting alone is still Level 0 (bonus only on combination)", () => {
    const out = applyRules(ctx([], [p("meeting_arrangement")]));
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).not.toContain("age_gap_meeting_combination");
  });

  test("Level 3 · 3 moderate indicators (score 6+)", () => {
    const out = applyRules(
      ctx(
        [],
        [
          p("image_request"),
          p("platform_switch_invitation"),
          p("age_gap_disclosure"),
        ],
      ),
    );
    expect(out.contributedLevel).toBe(3);
  });

  test("confidence rises with score and caps at 0.95", () => {
    const low = applyRules(ctx([], [p("age_gap_disclosure")]));
    const high = applyRules(
      ctx(
        [v("grooming_indicator", 3)],
        [
          p("image_request"),
          p("platform_switch_invitation"),
          p("age_gap_disclosure"),
          p("isolation_request"),
          p("flattery_followed_by_request"),
        ],
      ),
    );
    expect(high.contributedConfidence).toBeGreaterThan(low.contributedConfidence);
    expect(high.contributedConfidence).toBeLessThanOrEqual(0.95);
  });

  test("PRIVACY · signals never contain body text", () => {
    const needle = "needle_body_xyz";
    const out = applyRules(
      ctx(
        [v("grooming_indicator", 3)],
        [p("image_request")],
        `${needle} our little secret`,
      ),
    );
    for (const s of out.contributingSignals) {
      expect(s).not.toContain(needle);
    }
  });
});
