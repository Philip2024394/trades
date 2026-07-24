// MD health aggregator — cross-engine weighted mean.

import { describe, it, expect } from "vitest";
import { bandFor, computeMDHealth } from "./health";

describe("computeMDHealth", () => {
  it("returns 0 / critical / no-data-headline when every signal is null", () => {
    const h = computeMDHealth({});
    expect(h.score).toBe(0);
    expect(h.band).toBe("critical");
    expect(h.headline).toContain("no data");
    // Contributions still populated so the UI can render each row.
    expect(h.contributions.length).toBe(5);
  });

  it("BI-only case uses just the BI score (weight 3)", () => {
    const h = computeMDHealth({ bi_score: 80 });
    expect(h.score).toBe(80);
    expect(h.band).toBe("healthy");
  });

  it("BI + cash-flow blend correctly (weighted mean)", () => {
    // bi=80 (w3) + cashflow=100 (w2, at target) → (80*3 + 100*2)/5 = 88
    const h = computeMDHealth({ bi_score: 80, cashflow_30d_pence: 600_000, cashflow_target_pence: 500_000 });
    expect(h.score).toBe(88);
  });

  it("negative cash-flow scores below 30", () => {
    const h = computeMDHealth({ cashflow_30d_pence: -100_000, cashflow_target_pence: 500_000 });
    const cfScore = h.contributions.find((c) => c.engine === "cashflow")!.score;
    expect(cfScore).toBeLessThanOrEqual(30);
  });

  it("profit above target scores 100; zero-margin scores 20 floor", () => {
    const above = computeMDHealth({ profit_margin_pct: 30, profit_target_pct: 20 });
    expect(above.contributions.find((c) => c.engine === "profit")!.score).toBe(100);
    const zero = computeMDHealth({ profit_margin_pct: 0, profit_target_pct: 20 });
    expect(zero.contributions.find((c) => c.engine === "profit")!.score).toBe(20);
  });

  it("cx overdue count 0 = 100, 5 = 50, >=10 = 20", () => {
    expect(computeMDHealth({ cx_overdue_count: 0 }).contributions.find((c) => c.engine === "cx")!.score).toBe(100);
    expect(computeMDHealth({ cx_overdue_count: 5 }).contributions.find((c) => c.engine === "cx")!.score).toBe(50);
    expect(computeMDHealth({ cx_overdue_count: 20 }).contributions.find((c) => c.engine === "cx")!.score).toBe(20);
  });

  it("bands map correctly", () => {
    expect(bandFor(95)).toBe("excellent");
    expect(bandFor(75)).toBe("healthy");
    expect(bandFor(60)).toBe("steady");
    expect(bandFor(40)).toBe("attention");
    expect(bandFor(20)).toBe("critical");
  });
});
