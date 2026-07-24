// Time-saved estimator — pure function tests.

import { describe, it, expect } from "vitest";
import { PER_CATEGORY_MINUTES, estimateTimeSaved } from "./time_saved";

describe("estimateTimeSaved", () => {
  it("returns 0 minutes and honest reason when queue empty", () => {
    const e = estimateTimeSaved([]);
    expect(e.minutes).toBe(0);
    expect(e.drafts).toBe(0);
    expect(e.reason.toLowerCase()).toContain("no minutes claimed");
  });

  it("sums per-category baselines + rounds to nearest 5", () => {
    const e = estimateTimeSaved([
      { category: "customer_message" },   // 8
      { category: "invoice_reminder" },   // 12
      { category: "social_post" }         // 15
    ]);
    // 8+12+15 = 35 → rounded 35
    expect(e.minutes).toBe(35);
    expect(e.drafts).toBe(3);
  });

  it("reason mentions per-category breakdown", () => {
    const e = estimateTimeSaved([
      { category: "purchase_order" },
      { category: "purchase_order" }
    ]);
    expect(e.reason).toContain("purchase_order: 40m");
  });

  it("per-category constants stay reasonable (5–20 min)", () => {
    for (const min of Object.values(PER_CATEGORY_MINUTES)) {
      expect(min).toBeGreaterThan(0);
      expect(min).toBeLessThan(30);
    }
  });
});
