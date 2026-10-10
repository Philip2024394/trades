// src/lib/nex-native/safechat/rules/secrecy-request-rules.test.ts

import { describe, expect, test } from "vitest";
import {
  applyRules,
  hasBenignCelebrationContext,
  hasBenignOrdinaryPrivacyContextId,
  hasSecrecySignal,
  SECRECY_REQUEST_MODULE_NAME,
} from "./secrecy-request-rules";
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

describe("secrecy-request-rules · helpers", () => {
  test("hasSecrecySignal · pattern match counts", () => {
    expect(hasSecrecySignal(ctx({ patterns: [p("secrecy_request", 3)] }))).toBe(
      true,
    );
  });

  test("hasSecrecySignal · vocab match counts", () => {
    expect(hasSecrecySignal(ctx({ vocab: [v("secrecy_request", 3)] }))).toBe(
      true,
    );
  });

  test("hasSecrecySignal · nothing fires on empty context", () => {
    expect(hasSecrecySignal(ctx({}))).toBe(false);
  });

  test("hasBenignCelebrationContext · birthday + surprise", () => {
    expect(hasBenignCelebrationContext("surprise party for dad")).toBe(true);
    expect(hasBenignCelebrationContext("birthday present for mum")).toBe(true);
    expect(hasBenignCelebrationContext("kejutan ulang tahun")).toBe(true);
  });

  test("hasBenignCelebrationContext · nothing in isolation", () => {
    expect(hasBenignCelebrationContext("don't tell anyone")).toBe(false);
  });
});

describe("secrecy-request-rules · levels", () => {
  test("module name is 'secrecy_request'", () => {
    const out = applyRules(ctx({}));
    expect(out.moduleName).toBe(SECRECY_REQUEST_MODULE_NAME);
  });

  test("no secrecy signal → Level 0, no contribution", () => {
    const out = applyRules(ctx({}));
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toEqual([]);
  });

  test("BENIGN · secrecy + surprise party → Level 0 (founder guard)", () => {
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3)],
        text: "don't tell dad about the surprise party!",
      }),
    );
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toContain("benign_celebration_context");
  });

  test("BENIGN · Indonesian celebration framing → Level 0", () => {
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3, "id")],
        text: "jangan beritahu ibu tentang kejutan ulang tahun",
      }),
    );
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toContain("benign_celebration_context");
  });

  test("SENSITIVE · isolated secrecy without any other signal → Level 1", () => {
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3)],
        text: "this is just between us ok",
      }),
    );
    expect(out.contributedLevel).toBe(1);
    expect(out.contributingSignals).toEqual(["secrecy_request"]);
  });

  test("UNSAFE · secrecy + image_request pattern → Level 2 (potentially unsafe)", () => {
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3), p("image_request", 2)],
        text: "between us ok · send a pic",
      }),
    );
    expect(out.contributedLevel).toBe(2);
    expect(out.contributingSignals).toContain("sexual_context_in_message");
  });

  test("UNSAFE · secrecy + explicit_sexual vocab → Level 2", () => {
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3)],
        vocab: [v("explicit_sexual", 2)],
      }),
    );
    expect(out.contributedLevel).toBe(2);
  });

  test("SERIOUS · secrecy + image_request + grooming_indicator → Level 3", () => {
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3), p("image_request", 2)],
        vocab: [v("grooming_indicator", 3)],
      }),
    );
    expect(out.contributedLevel).toBe(3);
    expect(out.contributingSignals).toContain("grooming_indicator_in_message");
  });

  test("SERIOUS · secrecy + sexual + age_gap_disclosure → Level 3", () => {
    const out = applyRules(
      ctx({
        patterns: [
          p("secrecy_request", 3),
          p("image_request", 2),
          p("age_gap_disclosure", 3),
        ],
      }),
    );
    expect(out.contributedLevel).toBe(3);
  });

  test("SERIOUS · secrecy with history of pressure AND prior age_gap → Level 3", () => {
    const sig = {
      ...neutralSignals(),
      repeated_pressure_after_refusal: true,
      age_gap_already_disclosed: true,
    };
    const out = applyRules(
      ctx({ patterns: [p("secrecy_request", 3)], signals: sig }),
    );
    expect(out.contributedLevel).toBe(3);
    expect(out.contributingSignals).toContain("age_gap_in_history");
  });

  test("SERIOUS · secrecy with history pressure + prior platform switch → Level 3", () => {
    const sig = {
      ...neutralSignals(),
      repeated_pressure_after_refusal: true,
      platform_switch_invitation: true,
    };
    const out = applyRules(
      ctx({ patterns: [p("secrecy_request", 3)], signals: sig }),
    );
    expect(out.contributedLevel).toBe(3);
    expect(out.contributingSignals).toContain("platform_switch_in_history");
  });

  test("UNSAFE · secrecy with prior pressure alone (no age gap, no platform switch) → Level 2", () => {
    const sig = {
      ...neutralSignals(),
      repeated_pressure_after_refusal: true,
    };
    const out = applyRules(
      ctx({ patterns: [p("secrecy_request", 3)], signals: sig }),
    );
    expect(out.contributedLevel).toBe(2);
    expect(out.contributingSignals).toContain("sexual_context_in_history");
  });

  test("BENIGN · ordinary teenage privacy 'this is private, ok' with no secrecy_request match → Level 0", () => {
    const out = applyRules(
      ctx({ text: "this is private, ok?" }),
    );
    expect(out.contributedLevel).toBe(0);
  });

  test("PRIVACY · signals never contain body text", () => {
    const needle = "needle_body_xyz";
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3)],
        vocab: [v("grooming_indicator", 3)],
        text: `${needle} secret between us`,
      }),
    );
    for (const s of out.contributingSignals) {
      expect(s).not.toContain(needle);
    }
  });

  // -------------------------------------------------------------
  // v1.1.1 · regression anchors
  // -------------------------------------------------------------

  test("REGRESSION ANCHOR v1.1.1 · R2 · 'don't tell nan about the cake' is Level 0", () => {
    // v2-en-benign-lookalike-010 · the sealed Wave 1 regression item.
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3)],
        text: "don't tell nan about the cake we're hiding it for her 80th",
      }),
    );
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toContain("benign_celebration_context");
  });

  test("REGRESSION ANCHOR v1.1.1 · R2 · 'wrapping the present' idiom is Level 0", () => {
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3)],
        text: "don't tell mum we're wrapping the present downstairs",
      }),
    );
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toContain("benign_celebration_context");
  });

  test("REGRESSION ANCHOR v1.1.1 · R2 · retirement party idiom is Level 0", () => {
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3)],
        text: "don't tell grandpa it's a retirement party for him",
      }),
    );
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toContain("benign_celebration_context");
  });

  test("REGRESSION ANCHOR v1.1.1 · R3 · 'jangan bilang nilai kita' is Level 0", () => {
    // v2-id-benign-lookalike-008 · the sealed Wave 1 regression item.
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3, "id")],
        text: "temen dekat aku bilang jangan bilang nilai kita ke orang lain",
      }),
    );
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toContain("benign_ordinary_privacy_id");
  });

  test("REGRESSION ANCHOR v1.1.1 · R3 · 'urusan pribadi' is Level 0", () => {
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3, "id")],
        text: "jangan bilang siapa-siapa ini urusan pribadi aku",
      }),
    );
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toContain("benign_ordinary_privacy_id");
  });

  test("REGRESSION ANCHOR v1.1.1 · R3 · 'antara kita saja' is Level 0", () => {
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3, "id")],
        text: "jangan bilang orang lain, ini antara kita saja ya",
      }),
    );
    expect(out.contributedLevel).toBe(0);
    expect(out.contributingSignals).toContain("benign_ordinary_privacy_id");
  });

  test("REGRESSION ANCHOR v1.1.1 · R3 · ordinary-privacy whitelist does NOT suppress grooming context", () => {
    // Guard · if sexual/grooming context is present, ordinary-privacy
    // whitelist must NOT fire.
    const out = applyRules(
      ctx({
        patterns: [p("secrecy_request", 3, "id")],
        vocab: [v("grooming_indicator", 3, "id")],
        text: "jangan bilang nilai kita kirim foto sekarang",
      }),
    );
    expect(out.contributedLevel).toBe(3);
    expect(out.contributingSignals).not.toContain("benign_ordinary_privacy_id");
  });

  test("v1.1.1 · hasBenignOrdinaryPrivacyContextId helper", () => {
    expect(hasBenignOrdinaryPrivacyContextId("jangan bilang nilai kita")).toBe(
      true,
    );
    expect(hasBenignOrdinaryPrivacyContextId("ini urusan pribadi aja")).toBe(
      true,
    );
    expect(hasBenignOrdinaryPrivacyContextId("hello how are you")).toBe(false);
  });

  test("v1.1.1 · hasBenignCelebrationContext · new cake/wrap/tell-nan tokens", () => {
    expect(hasBenignCelebrationContext("about the cake we're hiding")).toBe(
      true,
    );
    expect(hasBenignCelebrationContext("don't tell nan about this")).toBe(
      true,
    );
    expect(hasBenignCelebrationContext("it's for her 80th")).toBe(true);
    expect(hasBenignCelebrationContext("hiding it for the surprise")).toBe(
      true,
    );
    expect(hasBenignCelebrationContext("wrapping the present")).toBe(true);
    // Negative control · "grandma died" is NOT a celebration framing.
    expect(hasBenignCelebrationContext("grandma died last year")).toBe(false);
  });
});
