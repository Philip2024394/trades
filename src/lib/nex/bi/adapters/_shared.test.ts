// Shared adapter helpers — pure functions.

import { describe, it, expect } from "vitest";
import { pctChange, windows } from "./_shared";

describe("pctChange", () => {
  it("returns null when either side is null", () => {
    expect(pctChange(null, 10)).toBeNull();
    expect(pctChange(10, null)).toBeNull();
  });
  it("returns null when prior is zero (avoid infinity/100%)", () => {
    expect(pctChange(5, 0)).toBeNull();
  });
  it("computes positive change", () => {
    expect(pctChange(120, 100)).toBe(20);
  });
  it("computes negative change", () => {
    expect(pctChange(80, 100)).toBe(-20);
  });
  it("rounds to 1 dp", () => {
    expect(pctChange(103, 100)).toBe(3);
    expect(pctChange(103.5, 100)).toBe(3.5);
  });
});

describe("windows", () => {
  it("splits current + prior lookback windows", () => {
    const now = new Date("2026-07-23T00:00:00Z");
    const w = windows(7, now);
    // Current window ends at now, starts 7 days earlier.
    expect(w.currentEnd).toBe("2026-07-23T00:00:00.000Z");
    expect(w.currentStart).toBe("2026-07-16T00:00:00.000Z");
    // Prior window ends 1ms before current start and spans another 7 days.
    expect(w.priorEnd.slice(0, 10)).toBe("2026-07-15");
    expect(w.priorStart.slice(0, 10)).toBe("2026-07-08");
  });
});
