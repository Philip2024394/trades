// src/lib/nex-native/safechat/feature-flag.test.ts
//
// Hermetic unit tests for the SafeChat feature flags.
//
// Default-OFF privacy posture (sealed 2026-10-10 Privacy Audit):
//   · isSafeChatPhase1LoggingEnabled defaults to false.
//   · Only the literal string "true" turns logging on.
//   · Every other value — unset, "", "yes", "True", "1", "false",
//     garbage — must resolve to false.

import { afterEach, describe, expect, test } from "vitest";
import {
  isSafeChatPhase1LoggingEnabled,
  isSafeChatUserFacingEnabled,
} from "./feature-flag";

const ENV_KEYS = [
  "NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED",
  "NEX_SAFECHAT_USER_FACING_ENABLED",
] as const;

const original: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) original[k] = process.env[k];

afterEach(() => {
  for (const k of ENV_KEYS) {
    const v = original[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("isSafeChatPhase1LoggingEnabled", () => {
  test("defaults to OFF when env is unset", () => {
    delete process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED;
    expect(isSafeChatPhase1LoggingEnabled()).toBe(false);
  });

  test("stays OFF for arbitrary non-'true' values", () => {
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "yes";
    expect(isSafeChatPhase1LoggingEnabled()).toBe(false);
  });

  test("stays OFF for the string '1'", () => {
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "1";
    expect(isSafeChatPhase1LoggingEnabled()).toBe(false);
  });

  test("stays OFF for the empty string", () => {
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "";
    expect(isSafeChatPhase1LoggingEnabled()).toBe(false);
  });

  test("stays OFF for the string 'false'", () => {
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "false";
    expect(isSafeChatPhase1LoggingEnabled()).toBe(false);
  });

  test("enables ONLY on explicit 'true'", () => {
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "true";
    expect(isSafeChatPhase1LoggingEnabled()).toBe(true);
  });

  test("is case-sensitive: 'True' is still OFF", () => {
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "True";
    expect(isSafeChatPhase1LoggingEnabled()).toBe(false);
  });

  test("is case-sensitive: 'TRUE' is still OFF", () => {
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "TRUE";
    expect(isSafeChatPhase1LoggingEnabled()).toBe(false);
  });
});

describe("isSafeChatUserFacingEnabled", () => {
  test("defaults to OFF when env is unset", () => {
    delete process.env.NEX_SAFECHAT_USER_FACING_ENABLED;
    expect(isSafeChatUserFacingEnabled()).toBe(false);
  });

  test("stays OFF for arbitrary values", () => {
    process.env.NEX_SAFECHAT_USER_FACING_ENABLED = "yes";
    expect(isSafeChatUserFacingEnabled()).toBe(false);
  });

  test("enables ONLY on explicit 'true'", () => {
    process.env.NEX_SAFECHAT_USER_FACING_ENABLED = "true";
    expect(isSafeChatUserFacingEnabled()).toBe(true);
  });

  test("is case-sensitive: 'True' is still OFF", () => {
    process.env.NEX_SAFECHAT_USER_FACING_ENABLED = "True";
    expect(isSafeChatUserFacingEnabled()).toBe(false);
  });
});
