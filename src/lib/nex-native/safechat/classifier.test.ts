// src/lib/nex-native/safechat/classifier.test.ts
//
// Hermetic unit tests for the SafeChat classifier. We test the three
// pure functions (resolveLevel + computeConfidence + language
// detection) directly, and the classifier integration path with
// mocked dependencies.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  computeConfidence,
  detectLanguageHeuristic,
  PHASE_1_LANGUAGES,
  resolveLevel,
} from "./classifier";
import type {
  ConversationSignals,
  PatternMatch,
  VocabularyMatch,
} from "./types";

function v(
  category: VocabularyMatch["category"],
  severity: VocabularyMatch["severity"] = 1,
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

function neutral(): ConversationSignals {
  return {
    repeated_pressure_after_refusal: false,
    escalation_pattern: false,
    time_pressure: false,
    platform_switch_invitation: false,
    historyWindowCount: 0,
  };
}

describe("PHASE_1_LANGUAGES", () => {
  test("ships with English and Bahasa Indonesia only", () => {
    expect(PHASE_1_LANGUAGES).toEqual(["en", "id"]);
  });
});

describe("detectLanguageHeuristic", () => {
  test("defaults to English for empty-ish text", () => {
    expect(detectLanguageHeuristic("hello world")).toBe("en");
  });

  test("returns null for empty text", () => {
    expect(detectLanguageHeuristic("")).toBe(null);
    expect(detectLanguageHeuristic("   ")).toBe(null);
  });

  test("detects Indonesian from stopword", () => {
    expect(detectLanguageHeuristic("saya tidak tahu")).toBe("id");
    expect(detectLanguageHeuristic("jangan bilang siapa-siapa")).toBe("id");
  });

  test("does not false-positive on English containing short tokens", () => {
    expect(detectLanguageHeuristic("I was there yesterday")).toBe("en");
  });
});

describe("resolveLevel", () => {
  test("level 0 · clean", () => {
    expect(resolveLevel({ vocabulary: [], patterns: [], signals: neutral() })).toBe(0);
  });

  test("level 1 · only sexual_slang severity 1 with no patterns", () => {
    const level = resolveLevel({
      vocabulary: [v("sexual_slang", 1)],
      patterns: [],
      signals: neutral(),
    });
    expect(level).toBe(1);
  });

  test("level 2 · image_request pattern alone", () => {
    const level = resolveLevel({
      vocabulary: [],
      patterns: [p("image_request", 2)],
      signals: neutral(),
    });
    expect(level).toBe(2);
  });

  test("level 2 · explicit_sexual vocabulary alone", () => {
    const level = resolveLevel({
      vocabulary: [v("explicit_sexual", 2)],
      patterns: [],
      signals: neutral(),
    });
    expect(level).toBe(2);
  });

  test("level 2 · two sensitive-category matches", () => {
    const level = resolveLevel({
      vocabulary: [v("sexual_slang", 1), v("coercion_indicator", 2)],
      patterns: [],
      signals: neutral(),
    });
    expect(level).toBe(2);
  });

  test("level 3 · image_request + grooming_indicator vocab", () => {
    const level = resolveLevel({
      vocabulary: [v("grooming_indicator", 3)],
      patterns: [p("image_request", 2)],
      signals: neutral(),
    });
    expect(level).toBe(3);
  });

  test("level 3 · meeting_arrangement + age_gap_disclosure patterns", () => {
    const level = resolveLevel({
      vocabulary: [],
      patterns: [p("meeting_arrangement", 2), p("age_gap_disclosure", 3)],
      signals: neutral(),
    });
    expect(level).toBe(3);
  });

  test("level 3 · repeated_pressure_after_refusal signal (even with no new matches)", () => {
    const level = resolveLevel({
      vocabulary: [],
      patterns: [],
      signals: { ...neutral(), repeated_pressure_after_refusal: true },
    });
    expect(level).toBe(3);
  });

  test("sexual_slang severity > 1 escalates past level 1", () => {
    // Only one sensitive-category match of severity 2 · sexual_slang
    // alone with severity > 1 should NOT trigger level 1 (which is
    // reserved for severity-1-only). Expect level 0 since no other
    // level-2 trigger fires.
    const level = resolveLevel({
      vocabulary: [v("sexual_slang", 2)],
      patterns: [],
      signals: neutral(),
    });
    expect(level).toBe(0);
  });
});

describe("computeConfidence", () => {
  test("0 when nothing matched", () => {
    expect(computeConfidence({ vocabulary: [], patterns: [], signals: neutral() })).toBe(0);
  });

  test("rises with pattern + signal + vocabulary", () => {
    const score = computeConfidence({
      vocabulary: [v("explicit_sexual", 2)],
      patterns: [p("image_request", 2)],
      signals: { ...neutral(), repeated_pressure_after_refusal: true },
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test("caps at 1.0", () => {
    const bigVocab = [v("explicit_sexual", 3), v("grooming_indicator", 3), v("coercion_indicator", 3)];
    const bigPatterns = [p("image_request", 3), p("meeting_arrangement", 3), p("age_gap_disclosure", 3)];
    const score = computeConfidence({
      vocabulary: bigVocab,
      patterns: bigPatterns,
      signals: {
        ...neutral(),
        repeated_pressure_after_refusal: true,
        escalation_pattern: true,
        time_pressure: true,
        platform_switch_invitation: true,
      },
    });
    expect(score).toBe(1);
  });
});

// -----------------------------------------------------------------
// Integration · classifyMessage with mocked loaders + aggregator.
// -----------------------------------------------------------------

vi.mock("./vocabulary-reader", async () => {
  const actual = await vi.importActual<typeof import("./vocabulary-reader")>(
    "./vocabulary-reader",
  );
  return {
    ...actual,
    loadVocabularyForLanguages: vi.fn(async () => new Map()),
  };
});

vi.mock("./pattern-detector", async () => {
  const actual = await vi.importActual<typeof import("./pattern-detector")>(
    "./pattern-detector",
  );
  return {
    ...actual,
    loadPatternsForLanguages: vi.fn(async () => []),
  };
});

vi.mock("./conversation-signal-aggregator", async () => {
  const actual = await vi.importActual<typeof import("./conversation-signal-aggregator")>(
    "./conversation-signal-aggregator",
  );
  return {
    ...actual,
    aggregateSignals: vi.fn(async () => ({
      repeated_pressure_after_refusal: false,
      escalation_pattern: false,
      time_pressure: false,
      platform_switch_invitation: false,
      historyWindowCount: 0,
    })),
  };
});

describe("classifyMessage · integration", () => {
  const vocabModule = () => import("./vocabulary-reader");
  const patternModule = () => import("./pattern-detector");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns level 0 clean when loaders are empty", async () => {
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "hello how are you",
      senderAccountId: "sender",
      recipientAccountId: "recipient",
      conversationId: null,
      rulesetVersion: "safechat-rules-v1.0.0",
    });
    expect(result.level).toBe(0);
    expect(result.ruleMatches).toEqual([]);
    expect(result.classifierVersion).toBe("safechat-rules-v1.0.0");
  });

  test("returns level 1 for mild slang", async () => {
    const vocab = await vocabModule();
    vi.mocked(vocab.loadVocabularyForLanguages).mockResolvedValue(
      new Map([
        [
          "boobs",
          [{ termId: "v-slang", term: "boobs", category: "sexual_slang", severity: 1, language: "en" }],
        ],
      ]),
    );
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "boobs",
      senderAccountId: "sender",
      recipientAccountId: "recipient",
      conversationId: null,
    });
    expect(result.level).toBe(1);
    expect(result.ruleMatches).toHaveLength(1);
  });

  test("returns level 2 when image_request pattern fires", async () => {
    const pattern = await patternModule();
    vi.mocked(pattern.loadPatternsForLanguages).mockResolvedValue([
      {
        patternId: "p-img",
        signalType: "image_request",
        severity: 2,
        language: "en",
        regex: /send\s+a\s+pic/i,
      },
    ]);
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "send a pic please",
      senderAccountId: "sender",
      recipientAccountId: "recipient",
      conversationId: null,
    });
    expect(result.level).toBe(2);
  });

  test("v1.1.0 is the default classifier version", async () => {
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "hello",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
    });
    expect(result.classifierVersion).toBe("safechat-rules-v1.1.0");
  });

  test("v1.0.0 explicit · can still be requested", async () => {
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "hello",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      rulesetVersion: "safechat-rules-v1.0.0",
    });
    expect(result.classifierVersion).toBe("safechat-rules-v1.0.0");
  });

  test("v1.1.0 · benign secrecy with surprise party is NOT escalated to Level 3", async () => {
    const pattern = await patternModule();
    vi.mocked(pattern.loadPatternsForLanguages).mockResolvedValue([
      {
        patternId: "p-sec",
        signalType: "secrecy_request",
        severity: 3,
        language: "en",
        regex: /don[’']?t\s+tell/i,
      },
    ]);
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "don't tell dad about the surprise party!",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
    });
    expect(result.level).toBeLessThan(2);
  });

  test("v1.1.0 · isolated secrecy without supporting evidence is Level 1 (not Level 3)", async () => {
    const pattern = await patternModule();
    vi.mocked(pattern.loadPatternsForLanguages).mockResolvedValue([
      {
        patternId: "p-sec",
        signalType: "secrecy_request",
        severity: 3,
        language: "en",
        regex: /don[’']?t\s+tell/i,
      },
    ]);
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "don't tell anyone about our chat",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
    });
    expect(result.level).toBe(1);
    expect(result.level).toBeLessThan(3);
  });

  test("v1.1.0 · injectedHistory with refusal→request raises coercion to Level 3", async () => {
    const pattern = await patternModule();
    vi.mocked(pattern.loadPatternsForLanguages).mockResolvedValue([
      {
        patternId: "p-img",
        signalType: "image_request",
        severity: 2,
        language: "en",
        regex: /send\s+a\s+pic/i,
      },
    ]);
    // Switch the aggregator mock to the REAL derivation path for this
    // test · we need the injectedHistory→derive wiring.
    const aggregatorMod = await vi.importActual<
      typeof import("./conversation-signal-aggregator")
    >("./conversation-signal-aggregator");
    const aggregator = await import("./conversation-signal-aggregator");
    vi.mocked(aggregator.aggregateSignals).mockImplementationOnce(
      aggregatorMod.aggregateSignals,
    );

    const { classifyMessage } = await import("./classifier");
    const nowIso = new Date().toISOString();
    const earlierIso = new Date(Date.now() - 120_000).toISOString();
    const result = await classifyMessage({
      messageText: "send a pic now",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: "conv-x",
      injectedHistory: [
        {
          level: 0,
          classifiedAt: earlierIso,
          ruleMatches: [
            {
              kind: "pattern",
              id: "p-ref",
              signalType: "refusal_language",
              severity: 1,
              language: "en",
              matchedText: "[refusal_language]",
            },
          ],
        },
        {
          level: 2,
          classifiedAt: nowIso,
          ruleMatches: [
            {
              kind: "pattern",
              id: "p-img-prev",
              signalType: "image_request",
              severity: 2,
              language: "en",
              matchedText: "[image_request]",
            },
          ],
        },
      ],
    });
    expect(result.level).toBe(3);
  });

  test("v1.1.1 explicit · can be requested", async () => {
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "hello",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      rulesetVersion: "safechat-rules-v1.1.1",
    });
    expect(result.classifierVersion).toBe("safechat-rules-v1.1.1");
  });

  test("v1.1.1 · age_gap + meeting_arrangement escalates to Level 3 (regression fix)", async () => {
    const pattern = await patternModule();
    vi.mocked(pattern.loadPatternsForLanguages).mockResolvedValue([
      {
        patternId: "p-age",
        signalType: "age_gap_disclosure",
        severity: 3,
        language: "en",
        regex: /i'm\s+\d{2}\s+(and|,)\s+you're\s+\d{1,2}/i,
      },
      {
        patternId: "p-meet",
        signalType: "meeting_arrangement",
        severity: 2,
        language: "en",
        regex: /(let's|wanna)\s+meet(\s+up)?/i,
      },
    ]);
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "i'm 30 and you're 15 let's meet up somewhere quiet",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      rulesetVersion: "safechat-rules-v1.1.1",
    });
    expect(result.level).toBe(3);
  });

  test("v1.1.0 frozen · age_gap + meeting stays at Level 2 (pre-fix behaviour)", async () => {
    const pattern = await patternModule();
    vi.mocked(pattern.loadPatternsForLanguages).mockResolvedValue([
      {
        patternId: "p-age",
        signalType: "age_gap_disclosure",
        severity: 3,
        language: "en",
        regex: /i'm\s+\d{2}\s+(and|,)\s+you're\s+\d{1,2}/i,
      },
      {
        patternId: "p-meet",
        signalType: "meeting_arrangement",
        severity: 2,
        language: "en",
        regex: /(let's|wanna)\s+meet(\s+up)?/i,
      },
    ]);
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "i'm 30 and you're 15 let's meet up somewhere quiet",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      rulesetVersion: "safechat-rules-v1.1.0",
    });
    expect(result.level).toBe(2);
    expect(result.classifierVersion).toBe("safechat-rules-v1.1.0");
  });

  test("v1.1.1 · 'don't tell nan about the cake' stays at Level 0 (R2 fix)", async () => {
    const pattern = await patternModule();
    vi.mocked(pattern.loadPatternsForLanguages).mockResolvedValue([
      {
        patternId: "p-sec",
        signalType: "secrecy_request",
        severity: 3,
        language: "en",
        regex: /don[’']?t\s+tell/i,
      },
    ]);
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "don't tell nan about the cake we're hiding it for her 80th",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      rulesetVersion: "safechat-rules-v1.1.1",
    });
    expect(result.level).toBe(0);
  });

  test("returns level 3 when image_request + grooming_indicator fire", async () => {
    const vocab = await vocabModule();
    const pattern = await patternModule();
    vi.mocked(vocab.loadVocabularyForLanguages).mockResolvedValue(
      new Map([
        [
          "our little secret",
          [
            {
              termId: "v-groom",
              term: "our little secret",
              category: "grooming_indicator",
              severity: 3,
              language: "en",
            },
          ],
        ],
      ]),
    );
    vi.mocked(pattern.loadPatternsForLanguages).mockResolvedValue([
      {
        patternId: "p-img",
        signalType: "image_request",
        severity: 2,
        language: "en",
        regex: /send\s+a\s+pic/i,
      },
    ]);
    const { classifyMessage } = await import("./classifier");
    const result = await classifyMessage({
      messageText: "our little secret · send a pic",
      senderAccountId: "sender",
      recipientAccountId: "recipient",
      conversationId: null,
    });
    expect(result.level).toBe(3);
  });
});
