// src/lib/nex-native/safechat/rules/coercion-pressure-rules.test.ts

import { describe, expect, test } from "vitest";
import {
  applyRules,
  COERCION_PRESSURE_DENSITY_THRESHOLD,
  COERCION_PRESSURE_MODULE_NAME,
} from "./coercion-pressure-rules";
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
    repeated_request_after_refusal: false,
    escalating_severity_pattern: false,
    pressure_density: 0,
    platform_switch_already_proposed: false,
    secrecy_already_requested: false,
    age_gap_already_disclosed: false,
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

function ctx(opts: {
  vocab?: readonly VocabularyMatch[];
  patterns?: readonly PatternMatch[];
  text?: string;
  signals?: ConversationSignals;
}): RuleModuleContext {
  const text = opts.text ?? "sample";
  return {
    text,
    normalisedText: text.toLowerCase(),
    language: "en",
    vocabularyMatches: opts.vocab ?? [],
    patternMatches: opts.patterns ?? [],
    conversationSignals: opts.signals ?? neutralSignals(),
  };
}

describe("coercion-pressure-rules · module shape", () => {
  test("module name is 'coercion_pressure'", () => {
    expect(applyRules(ctx({})).moduleName).toBe(COERCION_PRESSURE_MODULE_NAME);
  });

  test("no signals · Level 0, empty signals", () => {
    const out = applyRules(ctx({}));
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toEqual([]);
  });
});

describe("coercion-pressure-rules · single-message isolation", () => {
  test("coercion_indicator vocab alone (no history) → Level 2 preserved", () => {
    const out = applyRules(ctx({ vocab: [v("coercion_indicator", 2)] }));
    expect(out.contributedLevel).toBe(2);
    expect(out.contributingSignals).toContain("coercion_indicator_in_message");
  });

  test("history=0 → signals in struct do NOT escalate", () => {
    const sig = {
      ...neutralSignals(),
      // Pretend somehow these were set with no history · defensive.
      repeated_request_after_refusal: true,
      historyWindowCount: 0,
    };
    const out = applyRules(ctx({ signals: sig }));
    expect(out.contributedLevel).toBe(0);
  });
});

describe("coercion-pressure-rules · Level 3 branches require history", () => {
  test("repeated_request_after_refusal (new signal) → Level 3", () => {
    const sig = {
      ...neutralSignals(),
      historyWindowCount: 3,
      repeated_request_after_refusal: true,
    };
    const out = applyRules(ctx({ signals: sig }));
    expect(out.contributedLevel).toBe(3);
    expect(out.contributingSignals).toContain(
      "repeated_request_after_refusal",
    );
  });

  test("legacy repeated_pressure_after_refusal still escalates → Level 3", () => {
    const sig = {
      ...neutralSignals(),
      historyWindowCount: 3,
      repeated_pressure_after_refusal: true,
    };
    const out = applyRules(ctx({ signals: sig }));
    expect(out.contributedLevel).toBe(3);
  });

  test("pressure_density over threshold + sexual signal in message → Level 3", () => {
    const sig = {
      ...neutralSignals(),
      historyWindowCount: 10,
      pressure_density: COERCION_PRESSURE_DENSITY_THRESHOLD + 1,
    };
    const out = applyRules(
      ctx({ signals: sig, patterns: [p("image_request")] }),
    );
    expect(out.contributedLevel).toBe(3);
  });

  test("pressure_density over threshold ALONE (no sexual signal) → Level 0", () => {
    const sig = {
      ...neutralSignals(),
      historyWindowCount: 10,
      pressure_density: COERCION_PRESSURE_DENSITY_THRESHOLD + 1,
    };
    const out = applyRules(ctx({ signals: sig }));
    expect(out.contributedLevel).toBe(0);
  });

  test("platform_switch_already_proposed + meeting_arrangement message → Level 3", () => {
    const sig = {
      ...neutralSignals(),
      historyWindowCount: 2,
      platform_switch_already_proposed: true,
    };
    const out = applyRules(
      ctx({ signals: sig, patterns: [p("meeting_arrangement")] }),
    );
    expect(out.contributedLevel).toBe(3);
  });

  test("legacy platform_switch_invitation history + meeting_arrangement → Level 3", () => {
    const sig = {
      ...neutralSignals(),
      historyWindowCount: 2,
      platform_switch_invitation: true,
    };
    const out = applyRules(
      ctx({ signals: sig, patterns: [p("meeting_arrangement")] }),
    );
    expect(out.contributedLevel).toBe(3);
  });

  test("platform_switch history ALONE (no meeting in message) → Level 0", () => {
    const sig = {
      ...neutralSignals(),
      historyWindowCount: 2,
      platform_switch_already_proposed: true,
    };
    const out = applyRules(ctx({ signals: sig }));
    expect(out.contributedLevel).toBe(0);
  });
});

describe("coercion-pressure-rules · Level 2 escalating-severity branch", () => {
  test("escalating_severity + sexual signal in message → Level 2", () => {
    const sig = {
      ...neutralSignals(),
      historyWindowCount: 3,
      escalating_severity_pattern: true,
    };
    const out = applyRules(
      ctx({ signals: sig, vocab: [v("sexual_slang", 1)] }),
    );
    expect(out.contributedLevel).toBe(2);
  });

  test("escalating_severity ALONE (no in-message sexual) → Level 0", () => {
    const sig = {
      ...neutralSignals(),
      historyWindowCount: 3,
      escalating_severity_pattern: true,
    };
    const out = applyRules(ctx({ signals: sig }));
    expect(out.contributedLevel).toBe(0);
  });
});

describe("coercion-pressure-rules · privacy", () => {
  test("signals never contain body text", () => {
    const needle = "needle_body_xyz";
    const sig = {
      ...neutralSignals(),
      historyWindowCount: 2,
      repeated_request_after_refusal: true,
    };
    const out = applyRules(
      ctx({ signals: sig, text: `${needle} don't go` }),
    );
    for (const s of out.contributingSignals) {
      expect(s).not.toContain(needle);
    }
  });
});
