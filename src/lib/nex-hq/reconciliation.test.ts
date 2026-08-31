// src/lib/nex-hq/reconciliation.test.ts · Philip 2026-08-29.
//
// Unit tests for the pure classifier · no DB required. Integration path
// (checkReconciliation with a live pool) is exercised in the nightly job.

import { describe, it, expect } from "vitest";
import { classifyReconciliation, DEFAULT_LOWER_BOUND, DEFAULT_UPPER_BOUND } from "./reconciliation";

const perTable = [
  { table: "nex.food_business",          delta: 100 },
  { table: "nex.accommodation_business", delta: 50 },
  { table: "nex.service_business",       delta: 0 },
  { table: "nex.mp_seller",              delta: 0 },
];

const base = {
  perTable, windowHours: 24,
  lowerBound: DEFAULT_LOWER_BOUND,
  upperBound: DEFAULT_UPPER_BOUND,
};

describe("classifyReconciliation", () => {
  it("passes when reported and actual are both zero (quiet window)", () => {
    const r = classifyReconciliation({
      ...base, reportedRecordsNew: 0, actualDirectoryDelta: 0,
      perTable: perTable.map((t) => ({ ...t, delta: 0 })),
    });
    expect(r.pass).toBe(true);
    expect(r.ratio).toBeNull();
    expect(r.reason).toContain("quiet window");
  });

  it("fails when reported > 0 but actual is 0", () => {
    const r = classifyReconciliation({
      ...base, reportedRecordsNew: 500, actualDirectoryDelta: 0,
      perTable: perTable.map((t) => ({ ...t, delta: 0 })),
    });
    expect(r.pass).toBe(false);
    expect(r.ratio).toBeNull();
    expect(r.reason).toContain("did not grow");
  });

  it("passes when ratio is exactly 1.0 (perfect reconciliation)", () => {
    const r = classifyReconciliation({
      ...base, reportedRecordsNew: 150, actualDirectoryDelta: 150,
    });
    expect(r.pass).toBe(true);
    expect(r.ratio).toBe(1.0);
  });

  it("passes when ratio sits inside the bounds (e.g. 1.12 for live-fleet variance)", () => {
    // Live fleet numbers (Philip 2026-08-29): 21,085 reported vs ~18,700 actual = 1.128.
    const r = classifyReconciliation({
      ...base, reportedRecordsNew: 21085, actualDirectoryDelta: 18700,
    });
    expect(r.pass).toBe(true);
    expect(r.ratio).toBeCloseTo(1.128, 2);
    expect(r.reason).toContain("within");
  });

  it("fails on under-reconciliation (walkers inserting without incrementing records_new)", () => {
    // The pre-fix suspicion · walkers claim 375, actual growth 2,725 → ratio 0.14.
    const r = classifyReconciliation({
      ...base, reportedRecordsNew: 375, actualDirectoryDelta: 2725,
    });
    expect(r.pass).toBe(false);
    expect(r.ratio).toBeCloseTo(0.138, 2);
    expect(r.reason).toContain("under-reconciliation");
  });

  it("fails on over-reconciliation (records_new inflated well past actual growth)", () => {
    const r = classifyReconciliation({
      ...base, reportedRecordsNew: 3000, actualDirectoryDelta: 1000,
    });
    expect(r.pass).toBe(false);
    expect(r.ratio).toBe(3.0);
    expect(r.reason).toContain("over-reconciliation");
  });

  it("passes at the lower bound (0.9)", () => {
    const r = classifyReconciliation({
      ...base, reportedRecordsNew: 90, actualDirectoryDelta: 100,
    });
    expect(r.pass).toBe(true);
    expect(r.ratio).toBe(0.9);
  });

  it("passes at the upper bound (1.5)", () => {
    const r = classifyReconciliation({
      ...base, reportedRecordsNew: 150, actualDirectoryDelta: 100,
    });
    expect(r.pass).toBe(true);
    expect(r.ratio).toBe(1.5);
  });

  it("fails just outside the upper bound (1.51)", () => {
    const r = classifyReconciliation({
      ...base, reportedRecordsNew: 151, actualDirectoryDelta: 100,
    });
    expect(r.pass).toBe(false);
  });

  it("carries per-table deltas through to the result", () => {
    const r = classifyReconciliation({
      ...base, reportedRecordsNew: 150, actualDirectoryDelta: 150,
    });
    expect(r.perTable).toEqual(perTable);
    expect(r.perTable.find((t) => t.table === "nex.food_business")?.delta).toBe(100);
  });
});
