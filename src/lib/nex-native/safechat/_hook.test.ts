// src/lib/nex-native/safechat/_hook.test.ts
//
// Hermetic tests for the SafeChat orchestrator.
// Load-bearing: the hook MUST NOT throw out, regardless of what the
// classifier or logger do.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const classifyMessageMock = vi.fn();
const logClassificationMock = vi.fn();

vi.mock("./classifier", () => ({
  classifyMessage: (...args: unknown[]) => classifyMessageMock(...args),
}));

vi.mock("./classification-logger", () => ({
  logClassification: (...args: unknown[]) => logClassificationMock(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("safechatClassifyAndLog", () => {
  const defaultInput = {
    messageText: "hello",
    senderAccountId: "s",
    recipientAccountId: "r",
    conversationId: "c",
    messageRef: "m",
  };

  test("happy path · calls classifier then logger", async () => {
    classifyMessageMock.mockResolvedValue({
      level: 0,
      confidence: 0,
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
    });
    logClassificationMock.mockResolvedValue({ written: true, classificationId: "abc" });

    const { safechatClassifyAndLog } = await import("./_hook");
    await expect(safechatClassifyAndLog(defaultInput)).resolves.toBeUndefined();

    expect(classifyMessageMock).toHaveBeenCalledTimes(1);
    expect(logClassificationMock).toHaveBeenCalledTimes(1);
  });

  test("swallows classifier crash and does not throw", async () => {
    classifyMessageMock.mockRejectedValue(new Error("classifier blew up"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { safechatClassifyAndLog } = await import("./_hook");
    await expect(safechatClassifyAndLog(defaultInput)).resolves.toBeUndefined();
    expect(logClassificationMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  test("swallows logger crash and does not throw", async () => {
    classifyMessageMock.mockResolvedValue({
      level: 0,
      confidence: 0,
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
    });
    logClassificationMock.mockRejectedValue(new Error("db down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { safechatClassifyAndLog } = await import("./_hook");
    await expect(safechatClassifyAndLog(defaultInput)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  test("passes conversationId null through transparently", async () => {
    classifyMessageMock.mockResolvedValue({
      level: 0,
      confidence: 0,
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
    });
    logClassificationMock.mockResolvedValue({ written: true, classificationId: "abc" });

    const { safechatClassifyAndLog } = await import("./_hook");
    await safechatClassifyAndLog({ ...defaultInput, conversationId: null });

    expect(classifyMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: null }),
    );
    expect(logClassificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: null }),
    );
  });
});
