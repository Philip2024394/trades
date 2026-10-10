// src/lib/nex-native/safechat/conversation-signal-aggregator.test.ts
//
// Hermetic unit tests for the aggregator. We test the pure derivation
// function directly to keep the test loop fast and DB-free.

import { describe, expect, test } from "vitest";
import {
  aggregateSignals,
  deriveSignals,
  detectEscalation,
  emptySignals,
  TIME_PRESSURE_THRESHOLD,
  type HistoryEntry,
} from "./conversation-signal-aggregator";
import type { RuleMatchEntry } from "./types";

const now = Date.now();
function at(offsetMs: number): string {
  return new Date(now + offsetMs).toISOString();
}

function h(
  level: number,
  matches: readonly RuleMatchEntry[] = [],
  offsetMs: number = 0,
): HistoryEntry {
  return { level, ruleMatches: matches, signals: {}, classifiedAt: at(offsetMs) };
}

describe("emptySignals", () => {
  test("all signals false, historyWindowCount=0", () => {
    const s = emptySignals();
    expect(s.repeated_pressure_after_refusal).toBe(false);
    expect(s.escalation_pattern).toBe(false);
    expect(s.time_pressure).toBe(false);
    expect(s.platform_switch_invitation).toBe(false);
    expect(s.historyWindowCount).toBe(0);
  });
});

describe("detectEscalation", () => {
  test("needs at least 3 entries", () => {
    expect(detectEscalation([2, 2])).toBe(false);
  });

  test("fires on strictly increasing tail ending >= 2", () => {
    expect(detectEscalation([0, 1, 2])).toBe(true);
    expect(detectEscalation([0, 2, 3])).toBe(true);
  });

  test("fires on flat tail ending >= 2", () => {
    expect(detectEscalation([2, 2, 2])).toBe(true);
  });

  test("ignores dips in the tail", () => {
    expect(detectEscalation([3, 2, 3])).toBe(false);
  });

  test("ignores low-level trends", () => {
    expect(detectEscalation([0, 1, 1])).toBe(false);
  });

  test("uses only the trailing 3", () => {
    expect(detectEscalation([3, 3, 0, 0, 0])).toBe(false);
    expect(detectEscalation([0, 0, 0, 2, 2])).toBe(true);
  });
});

describe("deriveSignals", () => {
  test("returns empty when no entries", () => {
    expect(deriveSignals([])).toEqual(emptySignals());
  });

  test("platform_switch_invitation when any history has it", () => {
    const s = deriveSignals([
      h(1, [
        { kind: "pattern", id: "p1", signalType: "platform_switch_invitation", severity: 2, language: "en", matchedText: "whatsapp" },
      ]),
    ]);
    expect(s.platform_switch_invitation).toBe(true);
  });

  test("repeated_pressure_after_refusal · coercion then image_request", () => {
    const s = deriveSignals([
      h(1, [{ kind: "vocabulary", id: "v1", category: "coercion_indicator", severity: 1, language: "en" }], -60_000),
      h(2, [{ kind: "pattern", id: "p1", signalType: "image_request", severity: 2, language: "en", matchedText: "send a pic" }], 0),
    ]);
    expect(s.repeated_pressure_after_refusal).toBe(true);
  });

  test("does NOT fire repeated_pressure_after_refusal when image_request precedes coercion", () => {
    const s = deriveSignals([
      h(2, [{ kind: "pattern", id: "p1", signalType: "image_request", severity: 2, language: "en", matchedText: "send a pic" }], -60_000),
      h(1, [{ kind: "vocabulary", id: "v1", category: "coercion_indicator", severity: 1, language: "en" }], 0),
    ]);
    expect(s.repeated_pressure_after_refusal).toBe(false);
  });

  test("escalation_pattern fires on 0,1,2 ascending", () => {
    const s = deriveSignals([
      h(0, [], -120_000),
      h(1, [], -60_000),
      h(2, [], 0),
    ]);
    expect(s.escalation_pattern).toBe(true);
  });

  test(`time_pressure fires at >= ${TIME_PRESSURE_THRESHOLD} entries`, () => {
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < TIME_PRESSURE_THRESHOLD; i++) entries.push(h(0, [], -1000 * i));
    expect(deriveSignals(entries).time_pressure).toBe(true);
  });

  test("time_pressure does not fire below threshold", () => {
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < TIME_PRESSURE_THRESHOLD - 1; i++) entries.push(h(0, [], -1000 * i));
    expect(deriveSignals(entries).time_pressure).toBe(false);
  });

  test("historyWindowCount reflects entries", () => {
    const entries = [h(0), h(0), h(0)];
    expect(deriveSignals(entries).historyWindowCount).toBe(3);
  });

  test("sorts entries chronologically before deriving signals", () => {
    // Entries supplied oldest-last · derivation still produces correct trend.
    const s = deriveSignals([h(2, [], 0), h(1, [], -60_000), h(0, [], -120_000)]);
    expect(s.escalation_pattern).toBe(true);
  });
});

describe("aggregateSignals · DB-less fallback", () => {
  test("returns emptySignals when conversationId is null", async () => {
    const s = await aggregateSignals({ conversationId: null });
    expect(s).toEqual(emptySignals());
  });
});

// -----------------------------------------------------------------
// v1.1.0 additions · injectedHistory + new signals.
// -----------------------------------------------------------------

describe("deriveSignals · v1.1.0 new signals", () => {
  test("repeated_request_after_refusal · refusal then image_request", () => {
    const s = deriveSignals([
      h(
        0,
        [
          {
            kind: "pattern",
            id: "p-ref",
            signalType: "refusal_language",
            severity: 1,
            language: "en",
            matchedText: "[refusal_language]",
          },
        ],
        -120_000,
      ),
      h(
        2,
        [
          {
            kind: "pattern",
            id: "p-img",
            signalType: "image_request",
            severity: 2,
            language: "en",
            matchedText: "[image_request]",
          },
        ],
        0,
      ),
    ]);
    expect(s.repeated_request_after_refusal).toBe(true);
  });

  test("repeated_request_after_refusal · does NOT fire when request precedes refusal", () => {
    const s = deriveSignals([
      h(
        2,
        [
          {
            kind: "pattern",
            id: "p-img",
            signalType: "image_request",
            severity: 2,
            language: "en",
            matchedText: "[image_request]",
          },
        ],
        -120_000,
      ),
      h(
        0,
        [
          {
            kind: "pattern",
            id: "p-ref",
            signalType: "refusal_language",
            severity: 1,
            language: "en",
            matchedText: "[refusal_language]",
          },
        ],
        0,
      ),
    ]);
    expect(s.repeated_request_after_refusal).toBe(false);
  });

  test("pressure_density > 0 when request-shaped messages are present", () => {
    const s = deriveSignals([
      h(
        2,
        [
          {
            kind: "pattern",
            id: "p1",
            signalType: "image_request",
            severity: 2,
            language: "en",
            matchedText: "[image_request]",
          },
        ],
        -120_000,
      ),
      h(
        2,
        [
          {
            kind: "pattern",
            id: "p2",
            signalType: "image_request",
            severity: 2,
            language: "en",
            matchedText: "[image_request]",
          },
        ],
        -60_000,
      ),
      h(
        2,
        [
          {
            kind: "pattern",
            id: "p3",
            signalType: "image_request",
            severity: 2,
            language: "en",
            matchedText: "[image_request]",
          },
        ],
        0,
      ),
    ]);
    expect(s.pressure_density ?? 0).toBeGreaterThan(0);
  });

  test("pressure_density is 0 when no request-shaped messages", () => {
    const s = deriveSignals([h(0, [], -60_000), h(0, [], 0)]);
    expect(s.pressure_density ?? 0).toBe(0);
  });

  test("secrecy_already_requested tracks historical secrecy pattern", () => {
    const s = deriveSignals([
      h(
        1,
        [
          {
            kind: "pattern",
            id: "p",
            signalType: "secrecy_request",
            severity: 3,
            language: "en",
            matchedText: "[secrecy_request]",
          },
        ],
      ),
    ]);
    expect(s.secrecy_already_requested).toBe(true);
  });

  test("age_gap_already_disclosed tracks historical age_gap pattern", () => {
    const s = deriveSignals([
      h(
        1,
        [
          {
            kind: "pattern",
            id: "p",
            signalType: "age_gap_disclosure",
            severity: 3,
            language: "en",
            matchedText: "[age_gap_disclosure]",
          },
        ],
      ),
    ]);
    expect(s.age_gap_already_disclosed).toBe(true);
  });

  test("platform_switch_already_proposed equals the legacy field", () => {
    const s = deriveSignals([
      h(
        1,
        [
          {
            kind: "pattern",
            id: "p",
            signalType: "platform_switch_invitation",
            severity: 2,
            language: "en",
            matchedText: "[platform_switch_invitation]",
          },
        ],
      ),
    ]);
    expect(s.platform_switch_already_proposed).toBe(true);
    expect(s.platform_switch_invitation).toBe(true);
  });

  test("escalating_severity_pattern mirrors escalation_pattern", () => {
    const s = deriveSignals([
      h(0, [], -120_000),
      h(1, [], -60_000),
      h(2, [], 0),
    ]);
    expect(s.escalating_severity_pattern).toBe(true);
    expect(s.escalation_pattern).toBe(true);
  });

  test("emptySignals carries all new fields as neutral", () => {
    const e = emptySignals();
    expect(e.repeated_request_after_refusal).toBe(false);
    expect(e.escalating_severity_pattern).toBe(false);
    expect(e.pressure_density).toBe(0);
    expect(e.platform_switch_already_proposed).toBe(false);
    expect(e.secrecy_already_requested).toBe(false);
    expect(e.age_gap_already_disclosed).toBe(false);
  });
});

describe("aggregateSignals · injectedHistory hermetic path", () => {
  test("injectedHistory takes precedence over conversationId · no DB read", async () => {
    const prior = [
      {
        level: 1 as const,
        ruleMatches: [
          {
            kind: "pattern" as const,
            id: "p-ref",
            signalType: "refusal_language" as const,
            severity: 1 as const,
            language: "en",
            matchedText: "[refusal_language]",
          },
        ],
        classifiedAt: new Date(now - 120_000).toISOString(),
      },
      {
        level: 2 as const,
        ruleMatches: [
          {
            kind: "pattern" as const,
            id: "p-img",
            signalType: "image_request" as const,
            severity: 2 as const,
            language: "en",
            matchedText: "[image_request]",
          },
        ],
        classifiedAt: new Date(now).toISOString(),
      },
    ];
    const s = await aggregateSignals({
      conversationId: "conv-x",
      injectedHistory: prior,
    });
    expect(s.repeated_request_after_refusal).toBe(true);
    expect(s.historyWindowCount).toBe(2);
  });

  test("injectedHistory=[] returns empty signals", async () => {
    const s = await aggregateSignals({
      conversationId: "conv-x",
      injectedHistory: [],
    });
    expect(s).toEqual(emptySignals());
  });
});
