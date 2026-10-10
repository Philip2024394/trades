// src/lib/uk-postcode/__tests__/uk-postcode.test.ts
//
// Adversarial vitest suite for validateUkPostcode. Every assertion probes a
// specific value (no toBeDefined). Suite covers all six BS 7666 outward
// shapes, whitespace/casing normalisation, defensive non-string handling,
// unicode homoglyph rejection, and pathological input sizes.

import { describe, it, expect } from "vitest";
import { validateUkPostcode } from "../index";
import type { UkPostcodeValidationResult } from "../index";

const INVALID_SHAPE: UkPostcodeValidationResult = {
  valid: false,
  formatted: null,
  outward: null,
  inward: null,
};

describe("validateUkPostcode · happy path canonicalisation", () => {
  it("T1 · already canonical returns identity", () => {
    expect(validateUkPostcode("SW1A 1AA")).toEqual({
      valid: true,
      formatted: "SW1A 1AA",
      outward: "SW1A",
      inward: "1AA",
    });
  });

  it("T2 · lowercase no-space compacted form", () => {
    expect(validateUkPostcode("sw1a1aa")).toEqual({
      valid: true,
      formatted: "SW1A 1AA",
      outward: "SW1A",
      inward: "1AA",
    });
  });

  it("T3 · mixed case with surrounding whitespace", () => {
    expect(validateUkPostcode("  Sw1A  1aA  ")).toEqual({
      valid: true,
      formatted: "SW1A 1AA",
      outward: "SW1A",
      inward: "1AA",
    });
  });
});

describe("validateUkPostcode · all six BS 7666 outward shapes", () => {
  it("T8 · A9 (M1 1AA)", () => {
    expect(validateUkPostcode("M1 1AA")).toEqual({
      valid: true,
      formatted: "M1 1AA",
      outward: "M1",
      inward: "1AA",
    });
  });

  it("T9 · A99 (M60 1NW)", () => {
    expect(validateUkPostcode("M60 1NW")).toEqual({
      valid: true,
      formatted: "M60 1NW",
      outward: "M60",
      inward: "1NW",
    });
  });

  it("T10 · AA9 (CR2 6XH)", () => {
    expect(validateUkPostcode("CR2 6XH")).toEqual({
      valid: true,
      formatted: "CR2 6XH",
      outward: "CR2",
      inward: "6XH",
    });
  });

  it("T11 · AA99 (DN55 1PT)", () => {
    expect(validateUkPostcode("DN55 1PT")).toEqual({
      valid: true,
      formatted: "DN55 1PT",
      outward: "DN55",
      inward: "1PT",
    });
  });

  it("T12 · A9A (W1A 0AX)", () => {
    expect(validateUkPostcode("W1A 0AX")).toEqual({
      valid: true,
      formatted: "W1A 0AX",
      outward: "W1A",
      inward: "0AX",
    });
  });

  it("T13 · AA9A (EC1A 1BB)", () => {
    expect(validateUkPostcode("EC1A 1BB")).toEqual({
      valid: true,
      formatted: "EC1A 1BB",
      outward: "EC1A",
      inward: "1BB",
    });
  });
});

describe("validateUkPostcode · whitespace normalisation", () => {
  it("T14 · tab as separator collapses to single space", () => {
    expect(validateUkPostcode("SW1A\t1AA")).toEqual({
      valid: true,
      formatted: "SW1A 1AA",
      outward: "SW1A",
      inward: "1AA",
    });
  });

  it("T15 · double space collapses", () => {
    expect(validateUkPostcode("SW1A  1AA")).toEqual({
      valid: true,
      formatted: "SW1A 1AA",
      outward: "SW1A",
      inward: "1AA",
    });
  });

  it("E19 · newline separator collapses", () => {
    expect(validateUkPostcode("SW1A\n1AA")).toEqual({
      valid: true,
      formatted: "SW1A 1AA",
      outward: "SW1A",
      inward: "1AA",
    });
  });

  it("E19b · carriage return + linefeed collapses", () => {
    expect(validateUkPostcode("SW1A\r\n1AA")).toEqual({
      valid: true,
      formatted: "SW1A 1AA",
      outward: "SW1A",
      inward: "1AA",
    });
  });

  it("mix of spaces and tabs collapses", () => {
    expect(validateUkPostcode(" \tsw1a \t 1aa\t ")).toEqual({
      valid: true,
      formatted: "SW1A 1AA",
      outward: "SW1A",
      inward: "1AA",
    });
  });
});

describe("validateUkPostcode · rejects rubbish", () => {
  it("T4 · empty string", () => {
    expect(validateUkPostcode("")).toEqual(INVALID_SHAPE);
  });

  it("T22 · whitespace-only string", () => {
    expect(validateUkPostcode("     ")).toEqual(INVALID_SHAPE);
  });

  it("E11 · pure text rubbish", () => {
    expect(validateUkPostcode("HELLO WORLD")).toEqual(INVALID_SHAPE);
  });

  it("E12 · numeric-only", () => {
    expect(validateUkPostcode("12345")).toEqual(INVALID_SHAPE);
  });

  it("E13 · outward only missing inward", () => {
    expect(validateUkPostcode("SW1A")).toEqual(INVALID_SHAPE);
  });

  it("T7 · inward too long", () => {
    expect(validateUkPostcode("SW1A 1AAA")).toEqual(INVALID_SHAPE);
  });

  it("E14a · inward too short", () => {
    expect(validateUkPostcode("SW1A 1A")).toEqual(INVALID_SHAPE);
  });

  it("E14b · inward missing leading digit", () => {
    expect(validateUkPostcode("SW1A AAA")).toEqual(INVALID_SHAPE);
  });

  it("T21 · single letter", () => {
    expect(validateUkPostcode("S")).toEqual(INVALID_SHAPE);
  });

  it("E15b · trailing punctuation", () => {
    expect(validateUkPostcode("SW1A 1AA!")).toEqual(INVALID_SHAPE);
  });

  it("leading punctuation", () => {
    expect(validateUkPostcode("!SW1A 1AA")).toEqual(INVALID_SHAPE);
  });

  it("outward starts with a digit", () => {
    expect(validateUkPostcode("1SW1A 1AA")).toEqual(INVALID_SHAPE);
  });

  it("three-letter outward (over max)", () => {
    expect(validateUkPostcode("SWA1 1AA")).toEqual(INVALID_SHAPE);
  });

  it("outward missing digit", () => {
    expect(validateUkPostcode("SW 1AA")).toEqual(INVALID_SHAPE);
  });
});

describe("validateUkPostcode · GIR 0AA legacy rejection (documented)", () => {
  it("T5 · GIR 0AA is rejected", () => {
    expect(validateUkPostcode("GIR 0AA")).toEqual(INVALID_SHAPE);
  });

  it("lowercase gir 0aa is rejected", () => {
    expect(validateUkPostcode("gir 0aa")).toEqual(INVALID_SHAPE);
  });

  it("gir0aa (no space) is rejected", () => {
    expect(validateUkPostcode("gir0aa")).toEqual(INVALID_SHAPE);
  });
});

describe("validateUkPostcode · defensive non-string inputs (never throw)", () => {
  it("T6 · null", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateUkPostcode(null as any)).toEqual(INVALID_SHAPE);
  });

  it("undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateUkPostcode(undefined as any)).toEqual(INVALID_SHAPE);
  });

  it("T19 · number", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateUkPostcode(1234567 as any)).toEqual(INVALID_SHAPE);
  });

  it("boolean true", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateUkPostcode(true as any)).toEqual(INVALID_SHAPE);
  });

  it("T20a · plain object", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateUkPostcode({ postcode: "SW1A 1AA" } as any)).toEqual(INVALID_SHAPE);
  });

  it("T20b · array", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateUkPostcode(["SW1A 1AA"] as any)).toEqual(INVALID_SHAPE);
  });

  it("NaN", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateUkPostcode(Number.NaN as any)).toEqual(INVALID_SHAPE);
  });

  it("Symbol", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateUkPostcode(Symbol("SW1A 1AA") as any)).toEqual(INVALID_SHAPE);
  });

  it("does not throw for any of the above", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [null, undefined, 0, 1, true, false, {}, [], Number.NaN];
    for (const value of values) {
      expect(() => validateUkPostcode(value)).not.toThrow();
    }
  });
});

describe("validateUkPostcode · unicode homoglyph rejection", () => {
  it("T16 · Cyrillic А (U+0410) in place of Latin A", () => {
    // The first character is Cyrillic capital A, not Latin.
    expect(validateUkPostcode("СВ1А 1AA")).toEqual(INVALID_SHAPE);
  });

  it("Greek letter Α (U+0391) in outward", () => {
    expect(validateUkPostcode("SW1Α 1AA")).toEqual(INVALID_SHAPE);
  });

  it("fullwidth digits in inward", () => {
    // Fullwidth 1 (U+FF11) — not ASCII 0x31.
    expect(validateUkPostcode("SW1A １1AA")).toEqual(INVALID_SHAPE);
  });

  it("zero-width space inside otherwise-valid postcode", () => {
    expect(validateUkPostcode("SW1A​1AA")).toEqual(INVALID_SHAPE);
  });
});

describe("validateUkPostcode · extreme input sizes", () => {
  it("T17 · 10 000-char rubbish rejected in <100ms", () => {
    const junk = "A".repeat(10_000);
    const start = performance.now();
    const result = validateUkPostcode(junk);
    const elapsed = performance.now() - start;
    expect(result).toEqual(INVALID_SHAPE);
    expect(elapsed).toBeLessThan(100);
  });

  it("10 000 leading spaces before valid postcode still validates", () => {
    const padded = " ".repeat(10_000) + "SW1A 1AA";
    expect(validateUkPostcode(padded)).toEqual({
      valid: true,
      formatted: "SW1A 1AA",
      outward: "SW1A",
      inward: "1AA",
    });
  });

  it("valid postcode surrounded by many tabs & newlines validates", () => {
    const noisy = "\n\n\t\t   SW1A 1AA \t\t\r\n";
    expect(validateUkPostcode(noisy)).toEqual({
      valid: true,
      formatted: "SW1A 1AA",
      outward: "SW1A",
      inward: "1AA",
    });
  });
});

describe("validateUkPostcode · idempotency & invariants", () => {
  it("T18 · round-trip: formatted output is itself a valid canonical input", () => {
    const first = validateUkPostcode("sw1a1aa");
    expect(first.formatted).toBe("SW1A 1AA");
    const second = validateUkPostcode(first.formatted as string);
    expect(second).toEqual(first);
  });

  it("INVARIANT-2 · when valid, formatted === outward + ' ' + inward", () => {
    const inputs = ["M1 1AA", "M60 1NW", "CR2 6XH", "DN55 1PT", "W1A 0AX", "EC1A 1BB", "SW1A 1AA"];
    for (const input of inputs) {
      const result = validateUkPostcode(input);
      expect(result.valid).toBe(true);
      expect(result.formatted).toBe(`${result.outward} ${result.inward}`);
    }
  });

  it("INVARIANT-3 · when invalid, all three parts are null", () => {
    const inputs = ["", "   ", "HELLO", "SW1A", "SW1A 1AAA", "GIR 0AA", "12345"];
    for (const input of inputs) {
      const result = validateUkPostcode(input);
      expect(result.valid).toBe(false);
      expect(result.formatted).toBeNull();
      expect(result.outward).toBeNull();
      expect(result.inward).toBeNull();
    }
  });

  it("does not mutate input string", () => {
    const original = "  sW1a 1Aa  ";
    validateUkPostcode(original);
    expect(original).toBe("  sW1a 1Aa  ");
  });

  it("returns a new object each call (no shared mutable state)", () => {
    const a = validateUkPostcode("SW1A 1AA");
    const b = validateUkPostcode("SW1A 1AA");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("returns a new invalid object each call (invalid path)", () => {
    const a = validateUkPostcode("nope");
    const b = validateUkPostcode("nope");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("validateUkPostcode · real UK city sample", () => {
  it("accepts a batch of real postcodes and returns canonical forms", () => {
    const samples: Array<[string, string]> = [
      ["b33 8th", "B33 8TH"],
      ["l1 8jq", "L1 8JQ"],
      ["g2 3aa", "G2 3AA"],
      ["cf10 1ep", "CF10 1EP"],
      ["bt1 5gs", "BT1 5GS"],
      ["po16 7gz", "PO16 7GZ"],
    ];
    for (const [input, expectedFormatted] of samples) {
      const result = validateUkPostcode(input);
      expect(result.valid).toBe(true);
      expect(result.formatted).toBe(expectedFormatted);
    }
  });
});
