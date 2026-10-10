// src/lib/nex-native/safechat/rules/base-rules.test.ts

import { describe, expect, test } from "vitest";
import { applyRules, BASE_RULES_MODULE_NAME } from "./base-rules";
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
): PatternMatch {
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

describe("base-rules", () => {
  test("module name is 'base'", () => {
    const out = applyRules(ctx());
    expect(out.moduleName).toBe(BASE_RULES_MODULE_NAME);
  });

  test("empty context returns Level 0", () => {
    const out = applyRules(ctx());
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toEqual([]);
  });

  test("sexual_slang severity 1 alone returns Level 1", () => {
    const out = applyRules(ctx([v("sexual_slang", 1)]));
    expect(out.contributedLevel).toBe(1);
    expect(out.contributingSignals).toContain("sexual_slang");
  });

  test("sexual_slang severity 2 does NOT trigger Level 1 branch", () => {
    const out = applyRules(ctx([v("sexual_slang", 2)]));
    expect(out.contributedLevel).toBe(0);
  });

  test("sexual_slang + any pattern does NOT trigger Level 1 branch", () => {
    const out = applyRules(ctx([v("sexual_slang", 1)], [p("image_request")]));
    expect(out.contributedLevel).toBe(0);
  });

  test("explicit_sexual alone does NOT escalate here (owned by compose)", () => {
    const out = applyRules(ctx([v("explicit_sexual", 2)]));
    expect(out.contributedLevel).toBe(0);
  });

  test("never emits body text in signals", () => {
    const out = applyRules(
      ctx([v("sexual_slang", 1)], [], "nasty body with needle_text_xyz"),
    );
    for (const sig of out.contributingSignals) {
      expect(sig).not.toContain("needle_text_xyz");
      expect(sig).not.toContain("body");
    }
  });
});
