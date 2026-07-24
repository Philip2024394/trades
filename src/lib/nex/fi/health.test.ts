// Financial health aggregator — pure function tests.

import { describe, it, expect } from "vitest";
import { bandFor, computeFinancialHealth } from "./health";

describe("computeFinancialHealth", () => {
  it("returns no-data when every signal is null", () => {
    const h = computeFinancialHealth({});
    expect(h.score).toBe(0);
    expect(h.band).toBe("critical");
    expect(h.headline).toContain("no data");
  });

  it("cash-flow score = 100 when net ≥ target", () => {
    const h = computeFinancialHealth({ next_30d_net_pence: 600_000, cash_target_pence: 500_000 });
    expect(h.signals.cash_flow.score).toBe(100);
    expect(h.score).toBe(100);
  });

  it("cash-flow score = 20 when negative", () => {
    const h = computeFinancialHealth({ next_30d_net_pence: -50_000, cash_target_pence: 500_000 });
    expect(h.signals.cash_flow.score).toBe(20);
  });

  it("profit score scales to target margin", () => {
    const above = computeFinancialHealth({ weighted_margin_pct: 25, target_margin_pct: 20 });
    expect(above.signals.profit.score).toBe(100);
    const half = computeFinancialHealth({ weighted_margin_pct: 10, target_margin_pct: 20 });
    expect(half.signals.profit.score).toBe(50);
  });

  it("payment_speed based on outstanding / booked ratio", () => {
    const great = computeFinancialHealth({ outstanding_pence: 100_000, booked_revenue_pence: 2_000_000 });   // 5%
    expect(great.signals.payment_speed.score).toBe(95);
    const bad   = computeFinancialHealth({ outstanding_pence: 1_200_000, booked_revenue_pence: 2_000_000 }); // 60%
    expect(bad.signals.payment_speed.score).toBe(30);
  });

  it("growth signal maps revenue change", () => {
    const up   = computeFinancialHealth({ revenue_now_pence: 120, revenue_prior_pence: 100 });
    expect(up.signals.growth.score).toBe(100);
    const flat = computeFinancialHealth({ revenue_now_pence: 102, revenue_prior_pence: 100 });
    expect(flat.signals.growth.score).toBe(60);
    const down = computeFinancialHealth({ revenue_now_pence: 60,  revenue_prior_pence: 100 });
    expect(down.signals.growth.score).toBe(20);
  });

  it("stability needs ≥4 weekly points", () => {
    const thin = computeFinancialHealth({ weekly_revenue_series: [100, 200, 300] });
    expect(thin.signals.stability.score).toBeNull();
    const steady = computeFinancialHealth({ weekly_revenue_series: [100, 105, 95, 102] });
    expect(steady.signals.stability.score).toBe(95);
    const swingy = computeFinancialHealth({ weekly_revenue_series: [10, 500, 5, 400, 20, 350] });
    expect(swingy.signals.stability.score).toBeLessThanOrEqual(50);
  });

  it("bands map thresholds correctly", () => {
    expect(bandFor(95)).toBe("excellent");
    expect(bandFor(75)).toBe("healthy");
    expect(bandFor(60)).toBe("steady");
    expect(bandFor(40)).toBe("attention");
    expect(bandFor(10)).toBe("critical");
  });
});
