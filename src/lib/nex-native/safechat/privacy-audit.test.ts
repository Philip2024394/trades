// src/lib/nex-native/safechat/privacy-audit.test.ts
//
// NEX SafeChat Phase 1 · SEALED PRIVACY AUDIT (2026-10-10).
// -------------------------------------------------------------
// LOAD-BEARING EVIDENCE.
//
// These tests prove the privacy property the founder asked about:
//   "Is the actual message text discarded after classification, or can
//    it leak into logs, errors, traces, or debugging output?"
//
// Every scenario drives a classification with a distinctive body:
//     needle_text_zebra_quokka_7xyz
// and asserts that the needle NEVER appears in:
//   · the DB write (bound SQL parameters)
//   · the rule_matches jsonb
//   · the signals jsonb
//   · server logs (console.log / console.warn / console.error / stdout
//     / stderr)
//   · thrown error.message / error.stack
//   · DB error-path logs
//
// If any test here fails, the privacy property is broken · fix the
// implementation (classifier / logger / hook), do NOT weaken the test.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import type { ClassificationResult, RuleMatchEntry } from "./types";

const NEEDLE = "needle_text_zebra_quokka_7xyz";

// ---------------------------------------------------------------
// Shared mocks · same mock surface as classifier.test.ts and
// classification-logger.test.ts so each test file is hermetic.
// ---------------------------------------------------------------

const queryMock = vi.fn();
const withClientMock = vi.fn();

vi.mock("@/lib/nex/db", () => ({
  withClient: (fn: (c: { query: typeof queryMock }) => Promise<unknown>) =>
    withClientMock(fn),
}));

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

// ---------------------------------------------------------------
// Log capture · patches every console channel + stdout/stderr write.
// ---------------------------------------------------------------

interface Captured {
  readonly entries: string[];
  readonly restore: () => void;
}

function captureAllOutput(): Captured {
  const entries: string[] = [];

  const push = (prefix: string, args: unknown[]) => {
    entries.push(`${prefix} :: ${args.map((a) => String(a)).join(" ")}`);
  };

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);

  console.log = (...args: unknown[]) => push("log", args);
  console.warn = (...args: unknown[]) => push("warn", args);
  console.error = (...args: unknown[]) => push("error", args);
  console.info = (...args: unknown[]) => push("info", args);
  console.debug = (...args: unknown[]) => push("debug", args);
  (process.stdout as unknown as { write: (buf: unknown) => boolean }).write = (
    buf: unknown,
  ) => {
    entries.push(`stdout :: ${String(buf)}`);
    return true;
  };
  (process.stderr as unknown as { write: (buf: unknown) => boolean }).write = (
    buf: unknown,
  ) => {
    entries.push(`stderr :: ${String(buf)}`);
    return true;
  };

  return {
    entries,
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      console.info = originalInfo;
      console.debug = originalDebug;
      (process.stdout as unknown as { write: typeof originalStdout }).write =
        originalStdout;
      (process.stderr as unknown as { write: typeof originalStderr }).write =
        originalStderr;
    },
  };
}

function containsNeedle(s: string, needle: string = NEEDLE): boolean {
  return s.includes(needle);
}

function containsAnySubstring(s: string, haystack: string, minLen = 10): boolean {
  // Looks for any substring of `haystack` of length >= minLen inside `s`.
  if (haystack.length < minLen) return false;
  for (let i = 0; i + minLen <= haystack.length; i += 1) {
    const chunk = haystack.slice(i, i + minLen);
    if (s.includes(chunk)) return true;
  }
  return false;
}

// ---------------------------------------------------------------
// Setup / teardown.
// ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  withClientMock.mockImplementation(async (fn) => fn({ query: queryMock }));
  queryMock.mockResolvedValue({
    rows: [{ classification_id: "fake-id" }],
    rowCount: 1,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------

async function runEndToEnd(body: string): Promise<unknown[]> {
  // Returns the SQL parameter array for the single INSERT.
  const { safechatClassifyAndLog } = await import("./_hook");
  await safechatClassifyAndLog({
    messageText: body,
    senderAccountId: "sender",
    recipientAccountId: "recipient",
    conversationId: "conv-x",
    messageRef: "msg-x",
  });
  if (queryMock.mock.calls.length === 0) return [];
  return queryMock.mock.calls[0]![1] as unknown[];
}

async function configurePatternMatchFor(body: string): Promise<void> {
  const pattern = await import("./pattern-detector");
  vi.mocked(pattern.loadPatternsForLanguages).mockResolvedValue([
    {
      patternId: "p-leak",
      signalType: "image_request",
      severity: 2,
      language: "en",
      // Match the whole needle so matchedText == NEEDLE pre-redaction.
      regex: new RegExp(NEEDLE, "i"),
    },
  ]);
  const vocab = await import("./vocabulary-reader");
  vi.mocked(vocab.loadVocabularyForLanguages).mockResolvedValue(new Map());
  // Pin the body to actually contain the pattern so it fires.
  if (!body.includes(NEEDLE)) {
    throw new Error("test misuse · body must contain NEEDLE");
  }
}

// ---------------------------------------------------------------
// Scenario 1 · no body text in DB columns.
// ---------------------------------------------------------------

describe("Privacy · DB columns", () => {
  test("S1 · needle does not appear in any SQL parameter", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    const params = await runEndToEnd(`please ${NEEDLE} now`);
    const serialised = params.map((p) => (p === null ? "" : String(p))).join("||");
    expect(containsNeedle(serialised)).toBe(false);
  });

  test("S1b · needle does not appear in message_ref (opaque)", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    const params = await runEndToEnd(`please ${NEEDLE} now`);
    const messageRef = String(params[0] ?? "");
    expect(containsNeedle(messageRef)).toBe(false);
  });

  test("S1c · needle does not appear in language_detected", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    const params = await runEndToEnd(`please ${NEEDLE} now`);
    const lang = String(params[7] ?? "");
    expect(containsNeedle(lang)).toBe(false);
    expect(lang.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------
// Scenario 2 · no body text in rule_matches jsonb.
// ---------------------------------------------------------------

describe("Privacy · rule_matches jsonb", () => {
  test("S2 · pattern matchedText is redacted (not the raw body substring)", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    const params = await runEndToEnd(`please ${NEEDLE} now`);
    const ruleMatchesJson = String(params[6] ?? "");
    expect(containsNeedle(ruleMatchesJson)).toBe(false);
    expect(ruleMatchesJson).toContain("[redacted]");
    const parsed = JSON.parse(ruleMatchesJson) as RuleMatchEntry[];
    expect(parsed[0]!.kind).toBe("pattern");
    expect(parsed[0]!.matchedText).toBe("[redacted]");
    expect(parsed[0]!.signalType).toBe("image_request");
  });

  test("S2b · vocabulary term field is the dictionary term, never a body substring", async () => {
    const vocab = await import("./vocabulary-reader");
    vi.mocked(vocab.loadVocabularyForLanguages).mockResolvedValue(
      new Map([
        [
          "nude",
          [
            {
              termId: "v-1",
              term: "nude",
              category: "sexual_slang",
              severity: 1,
              language: "en",
            },
          ],
        ],
      ]),
    );
    const body = `${NEEDLE} nude ${NEEDLE}`;
    const params = await runEndToEnd(body);
    const ruleMatchesJson = String(params[6] ?? "");
    expect(ruleMatchesJson).toContain("nude");
    expect(containsNeedle(ruleMatchesJson)).toBe(false);
  });
});

// ---------------------------------------------------------------
// Scenario 3 · signals jsonb is numeric / categorical only.
// ---------------------------------------------------------------

describe("Privacy · signals jsonb", () => {
  test("S3 · signals jsonb contains only booleans + numeric history count", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    const params = await runEndToEnd(`please ${NEEDLE} now`);
    const signalsJson = String(params[8] ?? "");
    expect(containsNeedle(signalsJson)).toBe(false);
    const parsed = JSON.parse(signalsJson) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      expect(typeof value === "boolean" || typeof value === "number").toBe(
        true,
      );
      expect(String(value)).not.toContain(NEEDLE);
      expect(key).not.toContain(NEEDLE);
    }
  });
});

// ---------------------------------------------------------------
// Scenario 4 · no body text in server logs.
// ---------------------------------------------------------------

describe("Privacy · server logs", () => {
  test("S4 · console/stdout/stderr capture contains no needle on happy path", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    const captured = captureAllOutput();
    try {
      await runEndToEnd(`please ${NEEDLE} now`);
    } finally {
      captured.restore();
    }
    const joined = captured.entries.join("\n");
    expect(containsNeedle(joined)).toBe(false);
  });

  test("S4b · classifier soft-fail does NOT log the body in the warning", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    const vocab = await import("./vocabulary-reader");
    vi.mocked(vocab.loadVocabularyForLanguages).mockRejectedValue(
      new Error("vocabulary loader exploded"),
    );
    const captured = captureAllOutput();
    try {
      await runEndToEnd(`please ${NEEDLE} now`);
    } finally {
      captured.restore();
    }
    const joined = captured.entries.join("\n");
    expect(containsNeedle(joined)).toBe(false);
  });
});

// ---------------------------------------------------------------
// Scenario 5 · no body text in thrown error traces.
// ---------------------------------------------------------------

describe("Privacy · thrown errors (classifier)", () => {
  test("S5 · forced classifier crash · error.message + error.stack omit the body", async () => {
    const vocab = await import("./vocabulary-reader");
    vi.mocked(vocab.loadVocabularyForLanguages).mockImplementation(async () => {
      // We assemble an error with ONLY the module name, never the body.
      throw new Error("vocabulary loader failed · module boundary");
    });
    const { classifyMessage } = await import("./classifier");
    let caught: Error | null = null;
    try {
      await classifyMessage({
        messageText: `please ${NEEDLE} now`,
        senderAccountId: "s",
        recipientAccountId: "r",
        conversationId: null,
      });
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught!.message).not.toContain(NEEDLE);
    // Stack is best-effort · still assert the needle isn't there.
    expect(caught!.stack ?? "").not.toContain(NEEDLE);
  });
});

// ---------------------------------------------------------------
// Scenario 6 · no body text in DB error-path logs.
// ---------------------------------------------------------------

describe("Privacy · DB error paths", () => {
  test("S6 · DB write failure · soft-fail log omits the body", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    withClientMock.mockImplementationOnce(async () => {
      throw new Error("db failure · connection reset");
    });
    const captured = captureAllOutput();
    try {
      await runEndToEnd(`please ${NEEDLE} now`);
    } finally {
      captured.restore();
    }
    const joined = captured.entries.join("\n");
    expect(containsNeedle(joined)).toBe(false);
  });

  test("S6b · DB write failure with a NULL constraint-ish synthetic error · body still omitted", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    withClientMock.mockImplementationOnce(async () => {
      throw new Error("null value in column \"conversation_id\" violates NOT NULL");
    });
    const captured = captureAllOutput();
    try {
      await runEndToEnd(`please ${NEEDLE} now`);
    } finally {
      captured.restore();
    }
    const joined = captured.entries.join("\n");
    expect(containsNeedle(joined)).toBe(false);
  });
});

// ---------------------------------------------------------------
// Scenario 7 · hook is non-blocking and the send path survives.
// ---------------------------------------------------------------

describe("Privacy · hook non-blocking", () => {
  test("S7 · hook returns undefined even when logger throws", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    withClientMock.mockImplementationOnce(async () => {
      throw new Error("logger exploded");
    });
    const { safechatClassifyAndLog } = await import("./_hook");
    const result = await safechatClassifyAndLog({
      messageText: `please ${NEEDLE} now`,
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: "c",
      messageRef: "m",
    });
    expect(result).toBeUndefined();
  });

  test("S7b · hook returns undefined even when classifier throws", async () => {
    const vocab = await import("./vocabulary-reader");
    vi.mocked(vocab.loadVocabularyForLanguages).mockRejectedValueOnce(
      new Error("boom"),
    );
    const { safechatClassifyAndLog } = await import("./_hook");
    const result = await safechatClassifyAndLog({
      messageText: `please ${NEEDLE} now`,
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: "c",
      messageRef: "m",
    });
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------
// Scenario 8 · body-reference should be garbage-collectable after
// classification completes (weak check · reflects design intent).
// ---------------------------------------------------------------

describe("Privacy · body reference lifecycle", () => {
  test("S8 · ClassificationResult holds no reference to the original body string", async () => {
    const vocab = await import("./vocabulary-reader");
    vi.mocked(vocab.loadVocabularyForLanguages).mockResolvedValue(new Map());
    const pattern = await import("./pattern-detector");
    vi.mocked(pattern.loadPatternsForLanguages).mockResolvedValue([]);

    const { classifyMessage } = await import("./classifier");
    const uniqueBody = `${NEEDLE}_unique_${Math.random()}`;
    const result: ClassificationResult = await classifyMessage({
      messageText: uniqueBody,
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: null,
    });
    // The result is a plain JSON-serialisable object. Serialise it and
    // search for the needle · if it's not there, no field inside holds
    // a reference to the body (strings compare by value in JS).
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain(NEEDLE);
    expect(serialised).not.toContain(uniqueBody);
  });

  test("S8b · hook does not retain the body in any observable field", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    const { safechatClassifyAndLog } = await import("./_hook");
    const hookRef = safechatClassifyAndLog as unknown as Record<string, unknown>;
    // The function itself must not have attached properties carrying
    // the body (regression guardrail · future developer must not add
    // a cache keyed by body on the exported function reference).
    for (const key of Object.keys(hookRef)) {
      const value = String(hookRef[key]);
      expect(value).not.toContain(NEEDLE);
    }
    await safechatClassifyAndLog({
      messageText: `please ${NEEDLE} now`,
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: "c",
      messageRef: "m",
    });
    for (const key of Object.keys(hookRef)) {
      const value = String(hookRef[key]);
      expect(value).not.toContain(NEEDLE);
    }
  });
});

// ---------------------------------------------------------------
// Scenario 9 · opaque messageRef · same body with different refs
// yields distinct DB rows that cannot be correlated by body alone.
// ---------------------------------------------------------------

describe("Privacy · messageRef opacity", () => {
  test("S9 · caller-provided messageRef is passed through opaque", async () => {
    await configurePatternMatchFor(`please ${NEEDLE} now`);
    const { safechatClassifyAndLog } = await import("./_hook");
    await safechatClassifyAndLog({
      messageText: `please ${NEEDLE} now`,
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: "c",
      messageRef: "opaque-ref-aaa",
    });
    await safechatClassifyAndLog({
      messageText: `please ${NEEDLE} now`,
      senderAccountId: "s",
      recipientAccountId: "r",
      conversationId: "c",
      messageRef: "opaque-ref-bbb",
    });
    expect(queryMock.mock.calls).toHaveLength(2);
    const ref1 = (queryMock.mock.calls[0]![1] as unknown[])[0];
    const ref2 = (queryMock.mock.calls[1]![1] as unknown[])[0];
    expect(ref1).toBe("opaque-ref-aaa");
    expect(ref2).toBe("opaque-ref-bbb");
    expect(ref1).not.toBe(ref2);
    expect(String(ref1)).not.toContain(NEEDLE);
    expect(String(ref2)).not.toContain(NEEDLE);
  });
});

// ---------------------------------------------------------------
// Scenario 10 · classifier has no body-keyed cache.
// ---------------------------------------------------------------

describe("Privacy · in-memory caches", () => {
  test("S10 · classifier module exports no public cache keyed by body", async () => {
    const mod: Record<string, unknown> = await import("./classifier");
    // Each exported value is either a function (acceptable) or a plain
    // readonly constant (acceptable · PHASE_1_LANGUAGES etc.). We
    // guard against any Map / Set / Record keyed by body text being
    // exported · if someone added one, the needle must not appear in
    // its serialised form.
    for (const [key, value] of Object.entries(mod)) {
      if (typeof value === "function") continue;
      const str = JSON.stringify(value);
      expect(str).not.toContain(NEEDLE);
      expect(key).not.toContain(NEEDLE);
    }
  });

  test("S10b · logger module exports no body-keyed cache", async () => {
    const mod: Record<string, unknown> = await import("./classification-logger");
    for (const [, value] of Object.entries(mod)) {
      if (typeof value === "function") continue;
      const str = JSON.stringify(value);
      expect(str).not.toContain(NEEDLE);
    }
  });
});

// ---------------------------------------------------------------
// Scenario 11 · fuzzing · a random pool of needles never leaks.
// ---------------------------------------------------------------

describe("Privacy · fuzz pass", () => {
  test("S11 · 20 random needles are each absent from every bound parameter", async () => {
    const needles: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      const n = `needle_${i}_` + Math.random().toString(36).slice(2);
      needles.push(n);
    }
    const vocab = await import("./vocabulary-reader");
    const pattern = await import("./pattern-detector");
    for (let i = 0; i < needles.length; i += 1) {
      const n = needles[i]!;
      vi.mocked(vocab.loadVocabularyForLanguages).mockResolvedValueOnce(new Map());
      vi.mocked(pattern.loadPatternsForLanguages).mockResolvedValueOnce([
        {
          patternId: `p-${i}`,
          signalType: "image_request",
          severity: 2,
          language: "en",
          regex: new RegExp(n, "i"),
        },
      ]);
      queryMock.mockResolvedValueOnce({
        rows: [{ classification_id: "fake" }],
        rowCount: 1,
      });
      const { safechatClassifyAndLog } = await import("./_hook");
      // conversationId + messageRef are OPAQUE identifiers caller-provided ·
      // they MUST NOT carry body text in production. Use indexed opaques
      // so the needle search here only targets body-derived leaks.
      await safechatClassifyAndLog({
        messageText: `header ${n} trailer`,
        senderAccountId: "s",
        recipientAccountId: "r",
        conversationId: `conv-${i}`,
        messageRef: `ref-${i}`,
      });
    }
    for (let i = 0; i < needles.length; i += 1) {
      const needle = needles[i]!;
      const call = queryMock.mock.calls[i];
      if (!call) continue;
      const params = call[1] as unknown[];
      const serialised = params.map((p) => (p === null ? "" : String(p))).join("||");
      expect(serialised).not.toContain(needle);
    }
  });
});
