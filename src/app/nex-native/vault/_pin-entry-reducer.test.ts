// src/app/nex-native/vault/_pin-entry-reducer.test.ts
//
// Pure reducer coverage for the Vault PIN entry state machine.
// Node-env vitest · no DOM required.

import { describe, expect, it } from "vitest";
import {
  initialPinState,
  reducePinState,
  isSubmittable,
  digitCount,
  PIN_LENGTH,
} from "./_pin-entry-reducer";

describe("initialPinState", () => {
  it("starts entering with empty digits", () => {
    expect(initialPinState()).toEqual({ kind: "entering", digits: "" });
  });
});

describe("reducePinState · digit input", () => {
  it("appends a digit to the current digits", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "digit", value: "1" });
    expect(s1).toEqual({ kind: "entering", digits: "1" });
  });

  it("appends multiple digits in order", () => {
    let s = initialPinState();
    for (const d of "1234") s = reducePinState(s, { kind: "digit", value: d });
    expect(s).toEqual({ kind: "entering", digits: "1234" });
  });

  it("caps digits at PIN_LENGTH", () => {
    let s = initialPinState();
    for (const d of "1234567890") s = reducePinState(s, { kind: "digit", value: d });
    expect(digitCount(s)).toBe(PIN_LENGTH);
  });

  it("ignores non-digit input", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "digit", value: "a" });
    expect(s1).toEqual({ kind: "entering", digits: "" });
    const s2 = reducePinState(s1, { kind: "digit", value: "." });
    expect(s2).toEqual({ kind: "entering", digits: "" });
    const s3 = reducePinState(s2, { kind: "digit", value: " " });
    expect(s3).toEqual({ kind: "entering", digits: "" });
  });

  it("ignores empty-string digit input", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "digit", value: "" });
    expect(s1).toEqual({ kind: "entering", digits: "" });
  });

  it("ignores multi-char input in digit event", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "digit", value: "12" });
    expect(s1).toEqual({ kind: "entering", digits: "" });
  });

  it("does not accept digits while submitting", () => {
    const s0 = { kind: "submitting" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "digit", value: "7" });
    expect(s1).toEqual(s0);
  });
});

describe("reducePinState · backspace", () => {
  it("removes the last digit", () => {
    const s0 = { kind: "entering" as const, digits: "1234" };
    const s1 = reducePinState(s0, { kind: "backspace" });
    expect(s1).toEqual({ kind: "entering", digits: "123" });
  });

  it("is a no-op on empty digits", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "backspace" });
    expect(s1).toEqual({ kind: "entering", digits: "" });
  });

  it("does not alter state while submitting", () => {
    const s0 = { kind: "submitting" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "backspace" });
    expect(s1).toEqual(s0);
  });
});

describe("reducePinState · setDigits", () => {
  it("replaces the digits with a cleaned numeric subset", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "setDigits", digits: "1a2b3c" });
    expect(s1).toEqual({ kind: "entering", digits: "123" });
  });

  it("truncates to PIN_LENGTH", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "setDigits", digits: "1234567890" });
    expect(s1).toEqual({ kind: "entering", digits: "123456" });
  });

  it("clears when provided an all-non-digit string", () => {
    const s0 = { kind: "entering" as const, digits: "123" };
    const s1 = reducePinState(s0, { kind: "setDigits", digits: "abc" });
    expect(s1).toEqual({ kind: "entering", digits: "" });
  });
});

describe("reducePinState · submit", () => {
  it("transitions to submitting when exactly PIN_LENGTH digits are entered", () => {
    const s0 = { kind: "entering" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "submit" });
    expect(s1).toEqual({ kind: "submitting", digits: "123456" });
  });

  it("ignores submit when fewer than PIN_LENGTH digits are entered", () => {
    const s0 = { kind: "entering" as const, digits: "12345" };
    const s1 = reducePinState(s0, { kind: "submit" });
    expect(s1).toEqual(s0);
  });

  it("ignores submit when state is already submitting", () => {
    const s0 = { kind: "submitting" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "submit" });
    expect(s1).toEqual(s0);
  });

  it("ignores submit when state is incorrect (post-reject)", () => {
    const s0 = { kind: "incorrect" as const, digits: "" };
    const s1 = reducePinState(s0, { kind: "submit" });
    expect(s1).toEqual(s0);
  });
});

describe("reducePinState · reject", () => {
  it("incorrect rejection clears digits and shows incorrect state", () => {
    const s0 = { kind: "submitting" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "reject", reason: "incorrect" });
    expect(s1).toEqual({ kind: "incorrect", digits: "" });
  });

  it("unavailable rejection enters terminal unavailable state", () => {
    const s0 = { kind: "submitting" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "reject", reason: "unavailable" });
    expect(s1).toEqual({ kind: "unavailable" });
  });
});

describe("reducePinState · unavailable terminal state", () => {
  it("ignores digit, backspace, submit, reject events", () => {
    const s0: ReturnType<typeof initialPinState> = { kind: "unavailable" };
    expect(reducePinState(s0, { kind: "digit", value: "1" })).toEqual(s0);
    expect(reducePinState(s0, { kind: "backspace" })).toEqual(s0);
    expect(reducePinState(s0, { kind: "submit" })).toEqual(s0);
    expect(reducePinState(s0, { kind: "reject", reason: "incorrect" })).toEqual(s0);
    expect(
      reducePinState(s0, { kind: "setDigits", digits: "123456" }),
    ).toEqual(s0);
  });

  it("allows reset to return to initial state", () => {
    const s0: ReturnType<typeof initialPinState> = { kind: "unavailable" };
    expect(reducePinState(s0, { kind: "reset" })).toEqual(initialPinState());
  });
});

describe("reducePinState · reset", () => {
  it("returns to initial state from any non-unavailable state", () => {
    const states = [
      { kind: "entering" as const, digits: "123" },
      { kind: "submitting" as const, digits: "123456" },
      { kind: "incorrect" as const, digits: "" },
    ];
    for (const s of states) {
      expect(reducePinState(s, { kind: "reset" })).toEqual(initialPinState());
    }
  });
});

describe("isSubmittable", () => {
  it("returns true only for entering with exactly PIN_LENGTH digits", () => {
    expect(isSubmittable({ kind: "entering", digits: "123456" })).toBe(true);
  });

  it("returns false for shorter digit counts", () => {
    expect(isSubmittable({ kind: "entering", digits: "12345" })).toBe(false);
    expect(isSubmittable({ kind: "entering", digits: "" })).toBe(false);
  });

  it("returns false for non-entering states", () => {
    expect(isSubmittable({ kind: "submitting", digits: "123456" })).toBe(false);
    expect(isSubmittable({ kind: "incorrect", digits: "" })).toBe(false);
    expect(isSubmittable({ kind: "unavailable" })).toBe(false);
  });
});

describe("digitCount", () => {
  it("reports the current digit length for digit-bearing states", () => {
    expect(digitCount({ kind: "entering", digits: "123" })).toBe(3);
    expect(digitCount({ kind: "submitting", digits: "123456" })).toBe(6);
    expect(digitCount({ kind: "incorrect", digits: "" })).toBe(0);
  });

  it("reports 0 for terminal unavailable state", () => {
    expect(digitCount({ kind: "unavailable" })).toBe(0);
  });
});
