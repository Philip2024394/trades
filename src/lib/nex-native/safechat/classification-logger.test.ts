// src/lib/nex-native/safechat/classification-logger.test.ts
//
// Hermetic tests for the classification logger. We stub @/lib/nex/db
// so no actual DB is touched. The tests verify:
//   · simulated=TRUE and visibility_to_guardian=FALSE are passed
//     through to every INSERT (load-bearing invariants).
//   · The call wire shape matches the SQL (12 params).
//   · DB failures are swallowed and the logger returns written=false
//     without throwing.
//   · PRIVACY · rule_matches pattern entries have matchedText redacted
//     before INSERT (sealed 2026-10-10 Privacy Audit).

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  SAFECHAT_SIMULATED_PHASE_1,
  SAFECHAT_VISIBILITY_TO_GUARDIAN_PHASE_1,
  SAFECHAT_REDACTED_MATCHED_TEXT,
  redactRuleMatchesForPersistence,
} from "./classification-logger";
import type { ClassificationResult, RuleMatchEntry } from "./types";

const queryMock = vi.fn();
const withClientMock = vi.fn();

vi.mock("@/lib/nex/db", () => ({
  withClient: (fn: (c: { query: typeof queryMock }) => Promise<unknown>) =>
    withClientMock(fn),
}));

function baseClassification(): ClassificationResult {
  return {
    level: 2,
    confidence: 0.5,
    ruleMatches: [],
    languageDetected: "en",
    signals: {
      repeated_pressure_after_refusal: false,
      escalation_pattern: false,
      time_pressure: false,
      platform_switch_invitation: false,
      historyWindowCount: 0,
    },
    classifierVersion: "safechat-rules-v1.0.0",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  withClientMock.mockImplementation(async (fn) => {
    return fn({ query: queryMock });
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Phase 1 invariants (compile-time constants)", () => {
  test("SAFECHAT_SIMULATED_PHASE_1 is literally true", () => {
    expect(SAFECHAT_SIMULATED_PHASE_1).toBe(true);
  });

  test("SAFECHAT_VISIBILITY_TO_GUARDIAN_PHASE_1 is literally false", () => {
    expect(SAFECHAT_VISIBILITY_TO_GUARDIAN_PHASE_1).toBe(false);
  });

  test("SAFECHAT_REDACTED_MATCHED_TEXT is the sealed sentinel", () => {
    expect(SAFECHAT_REDACTED_MATCHED_TEXT).toBe("[redacted]");
  });
});

describe("redactRuleMatchesForPersistence", () => {
  test("replaces matchedText on pattern entries", () => {
    const entries: RuleMatchEntry[] = [
      {
        kind: "pattern",
        id: "p1",
        signalType: "image_request",
        severity: 2,
        language: "en",
        matchedText: "send me a nude pic right now",
      },
    ];
    const result = redactRuleMatchesForPersistence(entries);
    expect(result[0]!.matchedText).toBe("[redacted]");
    expect(result[0]!.id).toBe("p1");
    expect(result[0]!.signalType).toBe("image_request");
  });

  test("leaves vocabulary entries unchanged", () => {
    const entries: RuleMatchEntry[] = [
      {
        kind: "vocabulary",
        id: "v1",
        category: "sexual_slang",
        severity: 1,
        language: "en",
        term: "boobs",
      },
    ];
    const result = redactRuleMatchesForPersistence(entries);
    expect(result[0]!.term).toBe("boobs");
    expect(result[0]!.kind).toBe("vocabulary");
  });

  test("returns empty array for empty input", () => {
    expect(redactRuleMatchesForPersistence([])).toEqual([]);
  });

  test("handles pattern entries with no matchedText field", () => {
    const entries: RuleMatchEntry[] = [
      {
        kind: "pattern",
        id: "p1",
        signalType: "image_request",
        severity: 2,
        language: "en",
      },
    ];
    const result = redactRuleMatchesForPersistence(entries);
    expect(result[0]).toEqual(entries[0]);
  });

  test("preserves order of entries", () => {
    const entries: RuleMatchEntry[] = [
      { kind: "vocabulary", id: "v1", category: "sexual_slang", severity: 1, language: "en", term: "x" },
      { kind: "pattern", id: "p1", signalType: "image_request", severity: 2, language: "en", matchedText: "send a pic" },
      { kind: "vocabulary", id: "v2", category: "drugs", severity: 2, language: "en", term: "y" },
    ];
    const result = redactRuleMatchesForPersistence(entries);
    expect(result[0]!.id).toBe("v1");
    expect(result[1]!.id).toBe("p1");
    expect(result[1]!.matchedText).toBe("[redacted]");
    expect(result[2]!.id).toBe("v2");
  });
});

describe("logClassification", () => {
  test("writes a row and returns the classification id", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ classification_id: "abc-123" }],
      rowCount: 1,
    });
    const { logClassification } = await import("./classification-logger");
    const r = await logClassification({
      messageRef: "msg:abc",
      senderAccountId: "sender",
      recipientAccountId: "recipient",
      conversationId: "conv-1",
      classification: baseClassification(),
    });
    expect(r.written).toBe(true);
    expect(r.classificationId).toBe("abc-123");
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  test("passes simulated=TRUE and visibility_to_guardian=FALSE as parameters 10 and 11", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ classification_id: "id" }], rowCount: 1 });
    const { logClassification } = await import("./classification-logger");
    await logClassification({
      messageRef: "msg",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      classification: baseClassification(),
    });
    const call = queryMock.mock.calls[0]!;
    const params = call[1] as unknown[];
    // SQL positional parameters:
    //   10 = visibility_to_guardian
    //   11 = simulated
    expect(params[9]).toBe(false);
    expect(params[10]).toBe(true);
  });

  test("every log call sends exactly 12 parameters", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ classification_id: "id" }], rowCount: 1 });
    const { logClassification } = await import("./classification-logger");
    await logClassification({
      messageRef: "msg",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      classification: baseClassification(),
    });
    const call = queryMock.mock.calls[0]!;
    const params = call[1] as unknown[];
    expect(params).toHaveLength(12);
  });

  test("passes conversationId null when provided null", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ classification_id: "id" }], rowCount: 1 });
    const { logClassification } = await import("./classification-logger");
    await logClassification({
      messageRef: "msg",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      classification: baseClassification(),
    });
    const params = queryMock.mock.calls[0]![1] as unknown[];
    expect(params[3]).toBe(null);
  });

  test("stringifies rule_matches and signals as JSON", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ classification_id: "id" }], rowCount: 1 });
    const { logClassification } = await import("./classification-logger");
    const classification = baseClassification();
    (classification as unknown as { ruleMatches: unknown[] }).ruleMatches = [
      { kind: "vocabulary", id: "t1", category: "drugs", severity: 2, language: "en", term: "drugs" },
    ];
    await logClassification({
      messageRef: "msg",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      classification,
    });
    const params = queryMock.mock.calls[0]![1] as unknown[];
    // Param 7 (index 6) = rule_matches jsonb · must be a JSON string.
    expect(typeof params[6]).toBe("string");
    expect(JSON.parse(params[6] as string)).toHaveLength(1);
    // Param 9 (index 8) = signals jsonb · must be a JSON string.
    expect(typeof params[8]).toBe("string");
  });

  test("passes classifier_version from the classification result", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ classification_id: "id" }], rowCount: 1 });
    const { logClassification } = await import("./classification-logger");
    await logClassification({
      messageRef: "msg",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      classification: baseClassification(),
    });
    const params = queryMock.mock.calls[0]![1] as unknown[];
    expect(params[11]).toBe("safechat-rules-v1.0.0");
  });

  test("swallows DB errors and returns written=false", async () => {
    withClientMock.mockImplementationOnce(async () => {
      throw new Error("db down");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { logClassification } = await import("./classification-logger");
    const r = await logClassification({
      messageRef: "msg",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      classification: baseClassification(),
    });
    expect(r.written).toBe(false);
    expect(r.classificationId).toBe(null);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("returns written=false when withClient yields null (pool unavailable)", async () => {
    withClientMock.mockImplementationOnce(async () => null);
    const { logClassification } = await import("./classification-logger");
    const r = await logClassification({
      messageRef: "msg",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      classification: baseClassification(),
    });
    expect(r.written).toBe(false);
    expect(r.classificationId).toBe(null);
  });

  test("PRIVACY · redacts pattern matchedText before INSERT", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ classification_id: "id" }], rowCount: 1 });
    const { logClassification } = await import("./classification-logger");
    const classification = baseClassification();
    (classification as unknown as { ruleMatches: RuleMatchEntry[] }).ruleMatches = [
      {
        kind: "pattern",
        id: "p1",
        signalType: "image_request",
        severity: 2,
        language: "en",
        // This literal substring would be a body-text leak if persisted.
        matchedText: "needle_text_zebra_quokka_7xyz send a pic",
      },
    ];
    await logClassification({
      messageRef: "msg",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      classification,
    });
    const params = queryMock.mock.calls[0]![1] as unknown[];
    const ruleMatchesJson = params[6] as string;
    expect(ruleMatchesJson).not.toContain("needle_text_zebra_quokka_7xyz");
    expect(ruleMatchesJson).toContain("[redacted]");
    const parsed = JSON.parse(ruleMatchesJson) as RuleMatchEntry[];
    expect(parsed[0]!.matchedText).toBe("[redacted]");
    expect(parsed[0]!.signalType).toBe("image_request");
  });

  test("PRIVACY · leaves vocabulary term unchanged (dictionary term, not body text)", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ classification_id: "id" }], rowCount: 1 });
    const { logClassification } = await import("./classification-logger");
    const classification = baseClassification();
    (classification as unknown as { ruleMatches: RuleMatchEntry[] }).ruleMatches = [
      {
        kind: "vocabulary",
        id: "v1",
        category: "sexual_slang",
        severity: 1,
        language: "en",
        term: "dictionary_term",
      },
    ];
    await logClassification({
      messageRef: "msg",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      classification,
    });
    const params = queryMock.mock.calls[0]![1] as unknown[];
    const ruleMatchesJson = params[6] as string;
    expect(ruleMatchesJson).toContain("dictionary_term");
  });

  test("PRIVACY · error-path soft-fail log does NOT include the input payload", async () => {
    withClientMock.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { logClassification } = await import("./classification-logger");
    const classification = baseClassification();
    (classification as unknown as { ruleMatches: RuleMatchEntry[] }).ruleMatches = [
      {
        kind: "pattern",
        id: "p1",
        signalType: "image_request",
        severity: 2,
        language: "en",
        matchedText: "needle_text_zebra_quokka_7xyz",
      },
    ];
    await logClassification({
      messageRef: "msg",
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
      classification,
    });
    const captured = warnSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(captured).not.toContain("needle_text_zebra_quokka_7xyz");
    warnSpy.mockRestore();
  });
});
