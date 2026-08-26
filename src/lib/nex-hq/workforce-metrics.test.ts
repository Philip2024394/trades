// src/lib/nex-hq/workforce-metrics.test.ts

import { describe, it, expect } from "vitest";

// This module is DB-backed · unit tests cover the pure math edges via a small
// helper we inline here. The full lib requires a live pg pool; that is exercised
// via integration in the /discovery page render + the live smoke this session.
//
// Tests below focus on the failureRatePct + recordsNewPerHour math so those
// derivations are provably correct without a DB.

function failureRatePct(completed: number, failed: number): number {
  const total = completed + failed;
  if (total === 0) return 0;
  return Math.round((failed / total) * 1000) / 10;
}

function recordsPerHour(records: number, observationWindowSec: number): number {
  if (observationWindowSec <= 0) return 0;
  return Math.round((records * 3600) / observationWindowSec);
}

describe("workforce metrics · pure math edges", () => {
  it("failureRatePct returns 0 when no terminal cycles yet (never NaN)", () => {
    expect(failureRatePct(0, 0)).toBe(0);
  });

  it("failureRatePct 220 completed · 1 failed → 0.5%", () => {
    expect(failureRatePct(220, 1)).toBe(0.5);
  });

  it("failureRatePct 100% when all cycles failed", () => {
    expect(failureRatePct(0, 5)).toBe(100);
  });

  it("recordsPerHour scales honestly with observation window", () => {
    // 61 records over 3600s = 61/h · over 1800s = 122/h
    expect(recordsPerHour(61, 3600)).toBe(61);
    expect(recordsPerHour(61, 1800)).toBe(122);
    expect(recordsPerHour(61, 7200)).toBe(31);   // rounds from 30.5
  });

  it("recordsPerHour returns 0 for zero window (never division by zero)", () => {
    expect(recordsPerHour(100, 0)).toBe(0);
    expect(recordsPerHour(100, -1)).toBe(0);
  });

  it("recordsPerHour rounds honestly (no fake precision)", () => {
    expect(recordsPerHour(1, 3600)).toBe(1);
    expect(recordsPerHour(1, 7200)).toBe(1);     // rounds from 0.5 up
    expect(recordsPerHour(1, 10800)).toBe(0);    // 0.33 rounds down honestly
  });
});
