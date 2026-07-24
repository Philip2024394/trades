// Affordability check — yes / stretch / no / unknown decision matrix.

import { describe, it, expect } from "vitest";
import { checkAffordability } from "./affordability";
import type { CashflowSnapshot } from "../md/types";

function cf(overrides: Partial<CashflowSnapshot> = {}): CashflowSnapshot {
  return {
    currency: "GBP", computed_at: "x",
    buckets: [
      { end_date: "d1", inflow_pence: 0, outflow_pence: 0, net_pence: 1_000_000 },
      { end_date: "d2", inflow_pence: 0, outflow_pence: 0, net_pence: 500_000 },
      { end_date: "d3", inflow_pence: 0, outflow_pence: 0, net_pence: 300_000 }
    ],
    horizon_pence: 1_800_000, outstanding_now_pence: 200_000, overdue_now_pence: 0,
    pipeline_weighted_pence: 500_000, warnings: [], evidence: { source: "t", tables: [], computed_at: "x" },
    ...overrides
  };
}

describe("checkAffordability", () => {
  it("returns unknown when no cash-flow data available", () => {
    const a = checkAffordability({ purchase_label: "van", purchase_pence: 500_000, cashflow: null });
    expect(a.verdict).toBe("unknown");
    expect(a.reason).toContain("don't have enough");
  });

  it("returns yes when horizon comfortably covers purchase with buffer", () => {
    // Horizon = 1.8M + 500K pipeline = 2.3M. Purchase £5000 = 500,000.
    // Remaining 1.8M ≥ 30% of 2.3M = 690K. → yes
    const a = checkAffordability({ purchase_label: "small tool", purchase_pence: 500_000, cashflow: cf() });
    expect(a.verdict).toBe("yes");
    expect(a.reason).toContain("Yes");
    expect(a.reason).toContain("comfortably");
  });

  it("returns stretch when purchase leaves less than buffer but still positive", () => {
    // Horizon 2.3M. Buffer 30% = 690K. Purchase 1,800,000 = 18,000.
    // Remaining = 500K < 690K → stretch.
    const a = checkAffordability({ purchase_label: "van", purchase_pence: 1_800_000, cashflow: cf() });
    expect(a.verdict).toBe("stretch");
    expect(a.reason).toContain("Stretch");
  });

  it("returns no when purchase exceeds horizon", () => {
    // Purchase 3M — larger than horizon 2.3M.
    const a = checkAffordability({ purchase_label: "second office", purchase_pence: 3_000_000, cashflow: cf() });
    expect(a.verdict).toBe("no");
    expect(a.reason).toContain("Not on the visible numbers");
    expect(a.reason).toContain("short");
  });

  it("reason includes the numeric arithmetic (evidence-safe)", () => {
    const a = checkAffordability({ purchase_label: "small tool", purchase_pence: 500_000, cashflow: cf() });
    expect(a.reason).toContain("£23,000");   // horizon (1.8M + 500K = 2.3M → £23,000)
    expect(a.reason).toContain("£5,000");    // purchase
  });
});
