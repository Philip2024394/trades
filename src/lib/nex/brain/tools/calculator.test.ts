// src/lib/nex/brain/tools/calculator.test.ts
//
// Stage 3.35 · Phase E · Calculator doctrine tests (Philip 2026-08-31).
//
// Locks:
//   · deterministic arithmetic (never LLM-guessed)
//   · reports operands + result so Reflection can re-verify
//   · returns computed:false with a REASON when the pattern doesn't fit
//   · never fabricates a numeric answer
//   · handles bilingual EN + ID numeric words (million/juta · k/ribu)
//   · division by zero refused, not fabricated as Infinity

import { describe, expect, it } from "vitest";
import { parseHumanNumber, runCalculator } from "./calculator";

describe("parseHumanNumber", () => {
  it("bare integers · '1000' → 1000", () => {
    expect(parseHumanNumber("1000")).toBe(1000);
  });
  it("comma thousands · '3,000,000' → 3000000", () => {
    expect(parseHumanNumber("3,000,000")).toBe(3_000_000);
  });
  it("EN million · '3 million' → 3000000", () => {
    expect(parseHumanNumber("3 million")).toBe(3_000_000);
  });
  it("ID juta · '3 juta' → 3000000", () => {
    expect(parseHumanNumber("3 juta")).toBe(3_000_000);
  });
  it("EN k · '500k' → 500000", () => {
    expect(parseHumanNumber("500k")).toBe(500_000);
  });
  it("ID ribu · '500 ribu' → 500000", () => {
    expect(parseHumanNumber("500 ribu")).toBe(500_000);
  });
  it("shorthand million · '2.5m' → 2500000", () => {
    expect(parseHumanNumber("2.5m")).toBe(2_500_000);
  });
  it("gibberish → undefined", () => {
    expect(parseHumanNumber("hello")).toBeUndefined();
  });
});

describe("runCalculator · percentage_of", () => {
  it("'what is 20% of 3 million' → 600000", () => {
    const r = runCalculator("what is 20% of 3 million");
    expect(r.computed).toBe(true);
    if (r.computed && r.op.kind === "percentage_of") {
      expect(r.op.percent).toBe(20);
      expect(r.op.of).toBe(3_000_000);
      expect(r.op.result).toBe(600_000);
      expect(r.displayResult).toBe("Rp 600.000");
    }
  });

  it("'hitung 20% dari 3 juta' (Indonesian) → 600000", () => {
    const r = runCalculator("hitung 20% dari 3 juta");
    expect(r.computed).toBe(true);
    if (r.computed && r.op.kind === "percentage_of") {
      expect(r.op.result).toBe(600_000);
      expect(r.replyText.id).toContain("Rp 600.000");
    }
  });

  it("'5 percent of 200' → 10 (non-currency display)", () => {
    const r = runCalculator("5 percent of 200");
    if (r.computed && r.op.kind === "percentage_of") {
      expect(r.op.result).toBe(10);
      expect(r.displayResult).toBe("10");
    }
  });
});

describe("runCalculator · binary operations", () => {
  it("'150 + 200' → 350", () => {
    const r = runCalculator("150 + 200");
    if (r.computed && r.op.kind === "addition") expect(r.op.result).toBe(350);
  });
  it("'150 - 200' → -50", () => {
    const r = runCalculator("150 - 200");
    if (r.computed && r.op.kind === "subtraction") expect(r.op.result).toBe(-50);
  });
  it("'6 * 7' → 42", () => {
    const r = runCalculator("6 * 7");
    if (r.computed && r.op.kind === "multiplication") expect(r.op.result).toBe(42);
  });
  it("'6 × 7' (unicode times) → 42", () => {
    const r = runCalculator("6 × 7");
    if (r.computed && r.op.kind === "multiplication") expect(r.op.result).toBe(42);
  });
  it("'10 / 2' → 5", () => {
    const r = runCalculator("10 / 2");
    if (r.computed && r.op.kind === "division") expect(r.op.result).toBe(5);
  });
});

describe("runCalculator · honest refusals", () => {
  it("division by zero → computed:false · division_by_zero (not fabricated Infinity)", () => {
    const r = runCalculator("10 / 0");
    expect(r.computed).toBe(false);
    if (!r.computed) expect(r.reason).toBe("division_by_zero");
  });

  it("no recognisable pattern → computed:false · no_operation_pattern", () => {
    const r = runCalculator("please compute the meaning of life");
    expect(r.computed).toBe(false);
    if (!r.computed) expect(r.reason).toBe("no_operation_pattern");
  });

  it("greeting → no_operation_pattern (never guesses)", () => {
    const r = runCalculator("hello there");
    expect(r.computed).toBe(false);
    if (!r.computed) expect(r.reason).toBe("no_operation_pattern");
  });
});

describe("runCalculator · reflection re-verification support", () => {
  it("percentage op exposes percent + of + result so Reflection can re-multiply", () => {
    const r = runCalculator("20% of 3000000");
    if (r.computed && r.op.kind === "percentage_of") {
      const recomputed = (r.op.percent / 100) * r.op.of;
      expect(recomputed).toBe(r.op.result);
    }
  });

  it("addition op exposes operands array", () => {
    const r = runCalculator("100 + 250");
    if (r.computed && r.op.kind === "addition") {
      expect(r.op.operands).toEqual([100, 250]);
      expect(r.op.operands.reduce((a, b) => a + b, 0)).toBe(r.op.result);
    }
  });
});
