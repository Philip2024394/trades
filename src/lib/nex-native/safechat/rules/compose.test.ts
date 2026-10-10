// src/lib/nex-native/safechat/rules/compose.test.ts

import { describe, expect, test } from "vitest";
import { composeResult, genericLevelTwoFromMatches } from "./compose";
import type {
  ConversationSignals,
  PatternMatch,
  RuleModuleOutput,
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
    termId: `v-${category}`,
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
function out(
  moduleName: string,
  level: 0 | 1 | 2 | 3,
  confidence: number,
  signals: readonly string[] = [],
): RuleModuleOutput {
  return {
    moduleName,
    contributedLevel: level,
    contributedConfidence: confidence,
    contributingSignals: signals,
  };
}

describe("genericLevelTwoFromMatches · preserves v1.0.0 branch", () => {
  test("empty · Level 0, no signals", () => {
    const r = genericLevelTwoFromMatches({ vocabulary: [], patterns: [] });
    expect(r.level).toBe(0);
    expect(r.signals).toEqual([]);
  });

  test("image_request pattern → Level 2", () => {
    const r = genericLevelTwoFromMatches({
      vocabulary: [],
      patterns: [p("image_request")],
    });
    expect(r.level).toBe(2);
    expect(r.signals).toContain("image_request");
  });

  test("explicit_sexual vocab → Level 2", () => {
    const r = genericLevelTwoFromMatches({
      vocabulary: [v("explicit_sexual", 2)],
      patterns: [],
    });
    expect(r.level).toBe(2);
  });

  test("two sensitive-category matches → Level 2", () => {
    const r = genericLevelTwoFromMatches({
      vocabulary: [v("sexual_slang", 1), v("coercion_indicator", 2)],
      patterns: [],
    });
    expect(r.level).toBe(2);
    expect(r.signals).toContain("multiple_sensitive_matches");
  });
});

describe("composeResult · max-level composition", () => {
  test("highest module level wins · 0,2,1 → 2", () => {
    const result = composeResult({
      moduleOutputs: [
        out("base", 0, 0),
        out("grooming_pattern", 2, 0.5, ["explicit_image_request"]),
        out("secrecy_request", 1, 0.1),
      ],
      vocabulary: [],
      patterns: [],
      signals: neutralSignals(),
      languageDetected: "en",
    });
    expect(result.level).toBe(2);
  });

  test("Level 3 from any module wins", () => {
    const result = composeResult({
      moduleOutputs: [out("coercion_pressure", 3, 0.9)],
      vocabulary: [],
      patterns: [],
      signals: neutralSignals(),
      languageDetected: "en",
    });
    expect(result.level).toBe(3);
  });

  test("generic branch catches image_request even when no module escalates", () => {
    const result = composeResult({
      moduleOutputs: [
        out("base", 0, 0),
        out("grooming_pattern", 0, 0),
        out("secrecy_request", 0, 0),
        out("coercion_pressure", 0, 0),
      ],
      vocabulary: [],
      patterns: [p("image_request")],
      signals: neutralSignals(),
      languageDetected: "en",
    });
    expect(result.level).toBe(2);
  });

  test("empty everywhere → Level 0", () => {
    const result = composeResult({
      moduleOutputs: [],
      vocabulary: [],
      patterns: [],
      signals: neutralSignals(),
      languageDetected: "en",
    });
    expect(result.level).toBe(0);
    expect(result.confidence).toBe(0);
  });

  test("confidence is monotone-ish and capped at 1", () => {
    const result = composeResult({
      moduleOutputs: [
        out("base", 1, 0.15),
        out("grooming_pattern", 3, 0.95),
        out("secrecy_request", 2, 0.55),
        out("coercion_pressure", 3, 0.9),
      ],
      vocabulary: [],
      patterns: [],
      signals: {
        ...neutralSignals(),
        repeated_pressure_after_refusal: true,
        escalation_pattern: true,
        time_pressure: true,
        platform_switch_invitation: true,
      },
      languageDetected: "en",
    });
    expect(result.confidence).toBe(1);
  });

  test("classifierVersion defaults to v1.1.0", () => {
    const result = composeResult({
      moduleOutputs: [],
      vocabulary: [],
      patterns: [],
      signals: neutralSignals(),
      languageDetected: "en",
    });
    expect(result.classifierVersion).toBe("safechat-rules-v1.1.0");
  });

  test("ruleMatches shape preserved from vocabulary + pattern matches", () => {
    const result = composeResult({
      moduleOutputs: [],
      vocabulary: [v("sexual_slang", 1)],
      patterns: [p("image_request")],
      signals: neutralSignals(),
      languageDetected: "en",
    });
    expect(result.ruleMatches).toHaveLength(2);
    const vocab = result.ruleMatches.find((m) => m.kind === "vocabulary");
    const patt = result.ruleMatches.find((m) => m.kind === "pattern");
    expect(vocab?.category).toBe("sexual_slang");
    expect(patt?.signalType).toBe("image_request");
  });

  test("PRIVACY · contributingSignalNames never carry body text", () => {
    const needle = "needle_body_xyz";
    const result = composeResult({
      moduleOutputs: [
        out("grooming_pattern", 3, 0.9, ["explicit_image_request"]),
      ],
      vocabulary: [],
      patterns: [p("image_request")],
      signals: neutralSignals(),
      languageDetected: "en",
    });
    for (const s of result.contributingSignalNames) {
      expect(s).not.toContain(needle);
    }
  });
});
