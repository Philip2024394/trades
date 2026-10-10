// src/lib/nex-native/safechat/rules/_frozen-v1-1-0/_frozen.test.ts
//
// SEALED PARITY TEST · v1.1.0 frozen snapshot.
// --------------------------------------------
// Proves the frozen v1.1.0 rule modules keep producing stable outputs
// across hand-authored canonical inputs. If this file reads a modified
// frozen rule, the pinned numbers below will drift and the test will
// fail · which is the point. The frozen directory exists for
// comparison, so any accidental edit to _frozen-v1-1-0/ is caught here.
//
// Also sanity-checks that the frozen module exports are importable
// alongside the active ones (no shared-module collisions).
//
// Frozen 2026-10-10 at Ruleset Tuning Wave 2 start.

import { describe, expect, test } from "vitest";

import {
  applyRules as frozenBaseRules,
  BASE_RULES_MODULE_NAME as FROZEN_BASE_NAME,
} from "./base-rules";
import {
  applyRules as frozenSecrecyRules,
  SECRECY_REQUEST_MODULE_NAME as FROZEN_SECRECY_NAME,
} from "./secrecy-request-rules";
import {
  applyRules as frozenGroomingRules,
  computeGroomingScore as frozenComputeGroomingScore,
  GROOMING_LEVEL_THRESHOLDS as FROZEN_THRESHOLDS,
  GROOMING_PATTERN_MODULE_NAME as FROZEN_GROOMING_NAME,
  GROOMING_SCORE_WEIGHTS as FROZEN_WEIGHTS,
} from "./grooming-pattern-rules";
import {
  applyRules as frozenCoercionRules,
  COERCION_PRESSURE_MODULE_NAME as FROZEN_COERCION_NAME,
} from "./coercion-pressure-rules";
import { composeResult as frozenComposeResult } from "./compose";

// Also import the active modules · simply proves no collision at the
// loader level. We do NOT compare active to frozen here (the active
// implementation moves in v1.1.1+).
import { applyRules as activeBaseRules } from "../base-rules";
import { applyRules as activeSecrecyRules } from "../secrecy-request-rules";
import { applyRules as activeGroomingRules } from "../grooming-pattern-rules";
import { applyRules as activeCoercionRules } from "../coercion-pressure-rules";
import { composeResult as activeComposeResult } from "../compose";

import type {
  ConversationSignals,
  PatternMatch,
  RuleModuleContext,
  VocabularyMatch,
} from "../../types";

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
  language: string = "en",
): VocabularyMatch {
  return {
    termId: `v-${category}-${severity}`,
    term: category,
    category,
    severity,
    language,
  };
}

function p(
  signalType: PatternMatch["signalType"],
  severity: PatternMatch["severity"] = 2,
  language: string = "en",
): PatternMatch {
  return {
    patternId: `p-${signalType}`,
    signalType,
    severity,
    language,
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

describe("_frozen-v1-1-0 · module names are stable", () => {
  test("base module name", () => {
    expect(FROZEN_BASE_NAME).toBe("base");
  });
  test("secrecy module name", () => {
    expect(FROZEN_SECRECY_NAME).toBe("secrecy_request");
  });
  test("grooming module name", () => {
    expect(FROZEN_GROOMING_NAME).toBe("grooming_pattern");
  });
  test("coercion module name", () => {
    expect(FROZEN_COERCION_NAME).toBe("coercion_pressure");
  });
});

describe("_frozen-v1-1-0 · grooming constants are pinned", () => {
  test("weights", () => {
    expect(FROZEN_WEIGHTS.age_gap_disclosure).toBe(2);
    expect(FROZEN_WEIGHTS.meeting_arrangement_with_age_or_privacy_context).toBe(2);
    expect(FROZEN_WEIGHTS.explicit_image_request).toBe(3);
  });
  test("thresholds", () => {
    expect(FROZEN_THRESHOLDS.level_1).toBe(1);
    expect(FROZEN_THRESHOLDS.level_2).toBe(3);
    expect(FROZEN_THRESHOLDS.level_3).toBe(6);
  });
});

describe("_frozen-v1-1-0 · 10 canonical inputs · levels pinned", () => {
  // 1 · empty · base returns Level 0
  test("1 · empty context · base Level 0", () => {
    expect(frozenBaseRules(ctx({})).contributedLevel).toBe(0);
  });

  // 2 · sexual_slang severity 1 only · base Level 1
  test("2 · sexual_slang s=1 only · base Level 1", () => {
    expect(
      frozenBaseRules(ctx({ vocab: [v("sexual_slang", 1)] })).contributedLevel,
    ).toBe(1);
  });

  // 3 · secrecy + surprise party · secrecy Level 0 (benign)
  test("3 · secrecy + 'surprise party' · secrecy Level 0", () => {
    const out = frozenSecrecyRules(
      ctx({
        patterns: [p("secrecy_request", 3)],
        text: "don't tell dad about the surprise party",
      }),
    );
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toContain("benign_celebration_context");
  });

  // 4 · isolated secrecy · secrecy Level 1
  test("4 · isolated secrecy · secrecy Level 1", () => {
    const out = frozenSecrecyRules(
      ctx({
        patterns: [p("secrecy_request", 3)],
        text: "just between us ok",
      }),
    );
    expect(out.contributedLevel).toBe(1);
  });

  // 5 · secrecy + image_request · secrecy Level 2
  test("5 · secrecy + image_request · secrecy Level 2", () => {
    const out = frozenSecrecyRules(
      ctx({
        patterns: [p("secrecy_request", 3), p("image_request", 2)],
      }),
    );
    expect(out.contributedLevel).toBe(2);
  });

  // 6 · age_gap + meeting · grooming score 4 → Level 2 (THIS IS THE
  // v1.1.0 BEHAVIOUR being frozen · v1.1.1 adds a combination bonus that
  // escalates this to Level 3; the frozen snapshot must stay at Level 2
  // forever.)
  test("6 · age_gap + meeting · frozen grooming Level 2 (score 4)", () => {
    const breakdown = frozenComputeGroomingScore(
      ctx({ patterns: [p("age_gap_disclosure"), p("meeting_arrangement")] }),
    );
    expect(breakdown.score).toBe(4);
    const out = frozenGroomingRules(
      ctx({ patterns: [p("age_gap_disclosure"), p("meeting_arrangement")] }),
    );
    expect(out.contributedLevel).toBe(2);
  });

  // 7 · image_request + grooming_indicator · grooming Level 3 (score 6)
  test("7 · image_request + grooming_indicator · grooming Level 3", () => {
    const out = frozenGroomingRules(
      ctx({
        vocab: [v("grooming_indicator", 3)],
        patterns: [p("image_request")],
      }),
    );
    expect(out.contributedLevel).toBe(3);
  });

  // 8 · coercion_indicator vocab · coercion Level 2 fallback
  test("8 · coercion_indicator vocab · coercion Level 2", () => {
    const out = frozenCoercionRules(
      ctx({ vocab: [v("coercion_indicator", 2)] }),
    );
    expect(out.contributedLevel).toBe(2);
  });

  // 9 · repeated_request_after_refusal with history · coercion Level 3
  test("9 · repeated_request_after_refusal · coercion Level 3", () => {
    const sigs = {
      ...neutralSignals(),
      historyWindowCount: 3,
      repeated_request_after_refusal: true,
    };
    const out = frozenCoercionRules(ctx({ signals: sigs }));
    expect(out.contributedLevel).toBe(3);
  });

  // 10 · composeResult takes max across modules · age_gap+meeting
  //      still composes to Level 2 under frozen v1.1.0.
  test("10 · composeResult pins age_gap+meeting to Level 2", () => {
    const context = ctx({
      patterns: [p("age_gap_disclosure"), p("meeting_arrangement")],
    });
    const outs = [
      frozenBaseRules(context),
      frozenSecrecyRules(context),
      frozenGroomingRules(context),
      frozenCoercionRules(context),
    ];
    const composed = frozenComposeResult({
      moduleOutputs: outs,
      vocabulary: context.vocabularyMatches,
      patterns: context.patternMatches,
      signals: context.conversationSignals,
      languageDetected: context.language,
    });
    expect(composed.level).toBe(2);
    expect(composed.classifierVersion).toBe("safechat-rules-v1.1.0");
  });
});

describe("_frozen-v1-1-0 · co-exists with active modules", () => {
  test("active + frozen both importable, module names match", () => {
    const context = ctx({});
    expect(activeBaseRules(context).moduleName).toBe(
      frozenBaseRules(context).moduleName,
    );
    expect(activeSecrecyRules(context).moduleName).toBe(
      frozenSecrecyRules(context).moduleName,
    );
    expect(activeGroomingRules(context).moduleName).toBe(
      frozenGroomingRules(context).moduleName,
    );
    expect(activeCoercionRules(context).moduleName).toBe(
      frozenCoercionRules(context).moduleName,
    );
    // active composeResult + frozen composeResult are both callable.
    const activeOut = activeComposeResult({
      moduleOutputs: [],
      vocabulary: [],
      patterns: [],
      signals: context.conversationSignals,
      languageDetected: null,
    });
    const frozenOut = frozenComposeResult({
      moduleOutputs: [],
      vocabulary: [],
      patterns: [],
      signals: context.conversationSignals,
      languageDetected: null,
    });
    expect(activeOut.level).toBe(0);
    expect(frozenOut.level).toBe(0);
  });
});
