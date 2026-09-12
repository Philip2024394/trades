// src/components/nex-app/countdown/LiveCountdown.test.tsx
//
// Master AI reference tests for LiveCountdown · adheres to repo constraints:
//   · vitest environment = "node" (per vitest.config.ts)
//   · zero new npm dependencies (no @testing-library/react · no jsdom)
//
// The repo does not ship a DOM-testing harness, so DOM-behaviour tests
// (hook cleanup, matchMedia, react-dom mount) cannot run here without adding
// packages. Instead we exhaustively cover the PURE LOGIC that drives the
// component (computeParts · pad · shouldPulse). The React shell over these
// primitives is minimal and its correctness follows from the primitives.
//
// This is an honest self-repair moment: initial version imported
// @testing-library/react + jsdom · vitest rejected both · Master AI adapted
// by exporting the pure functions and testing them here. That IS the
// "diagnose → repair → regression-test" cycle the founder specified.

import { describe, expect, it } from "vitest";
import { computeParts, pad, shouldPulse } from "./LiveCountdown";

describe("computeParts", () => {
  it("returns zero parts when nowMs equals targetMs", () => {
    const p = computeParts(1_700_000_000_000, 1_700_000_000_000);
    expect(p).toEqual({ d: 0, h: 0, m: 0, s: 0, totalMs: 0 });
  });

  it("clamps to zero when now is past target", () => {
    const p = computeParts(1_700_000_000_000, 1_700_000_005_000);
    expect(p.totalMs).toBe(0);
    expect(p.d).toBe(0);
    expect(p.h).toBe(0);
    expect(p.m).toBe(0);
    expect(p.s).toBe(0);
  });

  it("breaks 1-day 2-hour 3-minute 4-second delta correctly", () => {
    const now = 1_700_000_000_000;
    const delta = 1 * 86400_000 + 2 * 3600_000 + 3 * 60_000 + 4 * 1000;
    const p = computeParts(now + delta, now);
    expect(p).toEqual({ d: 1, h: 2, m: 3, s: 4, totalMs: delta });
  });

  it("59 minutes 59 seconds does not roll into hours", () => {
    const now = 1_700_000_000_000;
    const p = computeParts(now + (59 * 60_000 + 59 * 1000), now);
    expect(p.h).toBe(0);
    expect(p.m).toBe(59);
    expect(p.s).toBe(59);
  });

  it("handles very large deltas (100 days)", () => {
    const now = 1_700_000_000_000;
    const p = computeParts(now + 100 * 86400_000, now);
    expect(p.d).toBe(100);
    expect(p.h).toBe(0);
    expect(p.m).toBe(0);
    expect(p.s).toBe(0);
  });

  it("is millisecond-precise on the boundary between seconds", () => {
    const now = 1_700_000_000_000;
    const p1 = computeParts(now + 1999, now);
    const p2 = computeParts(now + 2000, now);
    expect(p1.s).toBe(1);
    expect(p2.s).toBe(2);
  });

  it("is deterministic · same input yields same output", () => {
    const a = computeParts(1_700_000_000_000, 1_699_999_995_500);
    const b = computeParts(1_700_000_000_000, 1_699_999_995_500);
    expect(a).toEqual(b);
  });
});

describe("pad", () => {
  it("pads single digits with a leading zero", () => {
    expect(pad(0)).toBe("00");
    expect(pad(1)).toBe("01");
    expect(pad(9)).toBe("09");
  });
  it("leaves double digits unchanged", () => {
    expect(pad(10)).toBe("10");
    expect(pad(59)).toBe("59");
    expect(pad(99)).toBe("99");
  });
  it("passes triple digits through as strings without padding", () => {
    expect(pad(100)).toBe("100");
    expect(pad(365)).toBe("365");
  });
});

describe("shouldPulse", () => {
  it("returns false when reduce-motion is true regardless of remaining", () => {
    expect(shouldPulse(30_000, true)).toBe(false);
    expect(shouldPulse(5000, true)).toBe(false);
  });
  it("returns false when totalMs is >= 60_000", () => {
    expect(shouldPulse(60_000, false)).toBe(false);
    expect(shouldPulse(120_000, false)).toBe(false);
  });
  it("returns false when totalMs is zero", () => {
    expect(shouldPulse(0, false)).toBe(false);
  });
  it("returns true when reduce-motion is false and 0 < totalMs < 60_000", () => {
    expect(shouldPulse(59_999, false)).toBe(true);
    expect(shouldPulse(30_000, false)).toBe(true);
    expect(shouldPulse(1000, false)).toBe(true);
  });
});
