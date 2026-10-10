// src/lib/nex-native/safechat/rules/_frozen-v1-0-0.test.ts
//
// NEX SafeChat Phase 1 · frozen baseline guard tests.
// ----------------------------------------------------
// The frozen v1.0.0 file is a byte-level snapshot of the baseline
// resolver + confidence functions. These tests prove:
//   (1) the frozen functions produce the same levels the baseline
//       classifier produces for every representative input shape
//       covered by classifier.test.ts,
//   (2) the frozen classifier result carries classifierVersion
//       "safechat-rules-v1.0.0" verbatim.

import { describe, expect, test } from "vitest";
import {
  classifyWithFrozenV1_0_0,
  computeConfidenceFrozenV1_0_0,
  resolveLevelFrozenV1_0_0,
} from "./_frozen-v1-0-0";
import type {
  ConversationSignals,
  PatternMatch,
  VocabularyMatch,
} from "../types";

function neutral(): ConversationSignals {
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
  severity: VocabularyMatch["severity"] = 1,
): VocabularyMatch {
  return {
    termId: `v-${category}-${severity}`,
    term: category,
    category,
    severity,
    language: "en",
  };
}
function p(
  signalType: PatternMatch["signalType"],
  severity: PatternMatch["severity"] = 2,
): PatternMatch {
  return {
    patternId: `p-${signalType}`,
    signalType,
    severity,
    language: "en",
    matchedText: `[${signalType}]`,
  };
}

describe("_frozen-v1-0-0 · parity with sealed baseline", () => {
  test("Level 0 · clean", () => {
    expect(
      resolveLevelFrozenV1_0_0({
        vocabulary: [],
        patterns: [],
        signals: neutral(),
      }),
    ).toBe(0);
  });

  test("Level 1 · sexual_slang severity 1 + no patterns", () => {
    expect(
      resolveLevelFrozenV1_0_0({
        vocabulary: [v("sexual_slang", 1)],
        patterns: [],
        signals: neutral(),
      }),
    ).toBe(1);
  });

  test("Level 2 · image_request pattern alone", () => {
    expect(
      resolveLevelFrozenV1_0_0({
        vocabulary: [],
        patterns: [p("image_request", 2)],
        signals: neutral(),
      }),
    ).toBe(2);
  });

  test("Level 2 · explicit_sexual vocab alone", () => {
    expect(
      resolveLevelFrozenV1_0_0({
        vocabulary: [v("explicit_sexual", 2)],
        patterns: [],
        signals: neutral(),
      }),
    ).toBe(2);
  });

  test("Level 2 · two sensitive-category matches", () => {
    expect(
      resolveLevelFrozenV1_0_0({
        vocabulary: [v("sexual_slang", 1), v("coercion_indicator", 2)],
        patterns: [],
        signals: neutral(),
      }),
    ).toBe(2);
  });

  test("Level 3 · image_request + grooming_indicator", () => {
    expect(
      resolveLevelFrozenV1_0_0({
        vocabulary: [v("grooming_indicator", 3)],
        patterns: [p("image_request", 2)],
        signals: neutral(),
      }),
    ).toBe(3);
  });

  test("Level 3 · meeting_arrangement + age_gap_disclosure", () => {
    expect(
      resolveLevelFrozenV1_0_0({
        vocabulary: [],
        patterns: [p("meeting_arrangement", 2), p("age_gap_disclosure", 3)],
        signals: neutral(),
      }),
    ).toBe(3);
  });

  test("Level 3 · repeated_pressure_after_refusal signal", () => {
    expect(
      resolveLevelFrozenV1_0_0({
        vocabulary: [],
        patterns: [],
        signals: { ...neutral(), repeated_pressure_after_refusal: true },
      }),
    ).toBe(3);
  });

  test("sexual_slang severity 2 does NOT trigger Level 1", () => {
    expect(
      resolveLevelFrozenV1_0_0({
        vocabulary: [v("sexual_slang", 2)],
        patterns: [],
        signals: neutral(),
      }),
    ).toBe(0);
  });
});

describe("_frozen-v1-0-0 · confidence parity", () => {
  test("empty → 0", () => {
    expect(
      computeConfidenceFrozenV1_0_0({
        vocabulary: [],
        patterns: [],
        signals: neutral(),
      }),
    ).toBe(0);
  });

  test("rises with signals + matches", () => {
    const c = computeConfidenceFrozenV1_0_0({
      vocabulary: [v("explicit_sexual", 2)],
      patterns: [p("image_request", 2)],
      signals: { ...neutral(), repeated_pressure_after_refusal: true },
    });
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  test("caps at 1.0", () => {
    const c = computeConfidenceFrozenV1_0_0({
      vocabulary: [
        v("explicit_sexual", 3),
        v("grooming_indicator", 3),
        v("coercion_indicator", 3),
      ],
      patterns: [
        p("image_request", 3),
        p("meeting_arrangement", 3),
        p("age_gap_disclosure", 3),
      ],
      signals: {
        ...neutral(),
        repeated_pressure_after_refusal: true,
        escalation_pattern: true,
        time_pressure: true,
        platform_switch_invitation: true,
      },
    });
    expect(c).toBe(1);
  });
});

describe("_frozen-v1-0-0 · ClassificationResult shape", () => {
  test("classifierVersion is literally 'safechat-rules-v1.0.0'", () => {
    const r = classifyWithFrozenV1_0_0({
      vocabulary: [],
      patterns: [],
      signals: neutral(),
      languageDetected: "en",
    });
    expect(r.classifierVersion).toBe("safechat-rules-v1.0.0");
  });

  test("ruleMatches carry the same vocab + pattern entries", () => {
    const r = classifyWithFrozenV1_0_0({
      vocabulary: [v("explicit_sexual", 2)],
      patterns: [p("image_request", 2)],
      signals: neutral(),
      languageDetected: "en",
    });
    expect(r.ruleMatches).toHaveLength(2);
    expect(r.ruleMatches[0]?.kind).toBe("vocabulary");
    expect(r.ruleMatches[1]?.kind).toBe("pattern");
  });
});
