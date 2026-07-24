// Priorities ranker — cross-engine merge + severity ordering.

import { describe, it, expect } from "vitest";
import { buildPriorities, isSilent, makePriority } from "./priorities";
import type { BusinessHealth } from "../bi/types";
import type { CashflowSnapshot, ProfitSnapshot, WorkforceSnapshot } from "./types";

const ev = (source = "test") => ({ source, tables: [], computed_at: "2026-07-23T00:00:00Z" });

function bi(observations: BusinessHealth["observations"]): BusinessHealth {
  return {
    score: 60, band: "steady", headline: "", computed_at: "x", errors: [], domains: [], observations
  };
}

function cf(overrides: Partial<CashflowSnapshot> = {}): CashflowSnapshot {
  return {
    currency: "GBP", computed_at: "x",
    buckets: [
      { end_date: "2026-08-22", inflow_pence: 100_000, outflow_pence: 0, net_pence: 100_000 },
      { end_date: "2026-09-21", inflow_pence: 50_000,  outflow_pence: 0, net_pence: 50_000 },
      { end_date: "2026-10-21", inflow_pence: 20_000,  outflow_pence: 0, net_pence: 20_000 }
    ],
    horizon_pence: 170_000, outstanding_now_pence: 200_000, overdue_now_pence: 0,
    pipeline_weighted_pence: 0, warnings: [], evidence: ev(),
    ...overrides
  };
}

function profit(overrides: Partial<ProfitSnapshot> = {}): ProfitSnapshot {
  return {
    computed_at: "x", jobs: [], totals: { quoted_pence: 100_000, planned_profit_pence: 20_000, weighted_margin_pct: 20 },
    low_margin_jobs: [], target_margin_pct: 20, warnings: [], evidence: ev(),
    ...overrides
  };
}

function workforce(): WorkforceSnapshot {
  return {
    computed_at: "x", active_projects_count: 2, hours_last_30d: 40, team_size_current: 2,
    utilisation_note: "ok", bookings_next_14d: 3, warnings: [], evidence: ev()
  };
}

describe("buildPriorities", () => {
  it("carries BI observations through with 'bi:' key prefix", () => {
    const list = buildPriorities({
      bi: bi([{ key: "quotes_awaiting_reply", aspect: "quotations", severity: "warning", headline: "5 quotes awaiting reply.", evidence: ev(), domain: "quotations" } as never]),
      cashflow: null, profit: null, workforce: null
    });
    expect(list.some((p) => p.key === "bi:quotes_awaiting_reply")).toBe(true);
  });

  it("fires md_cashflow:overdue when overdue ≥ £1,000", () => {
    const list = buildPriorities({ bi: null, cashflow: cf({ overdue_now_pence: 200_000 }), profit: null, workforce: null });
    expect(list.some((p) => p.key === "md_cashflow:overdue")).toBe(true);
  });

  it("does NOT fire overdue below the £1,000 threshold", () => {
    const list = buildPriorities({ bi: null, cashflow: cf({ overdue_now_pence: 50_000 }), profit: null, workforce: null });
    expect(list.some((p) => p.key === "md_cashflow:overdue")).toBe(false);
  });

  it("fires next-30 negative when bucket[0].net_pence < 0", () => {
    const s = cf();
    s.buckets[0].net_pence = -50_000;
    const list = buildPriorities({ bi: null, cashflow: s, profit: null, workforce: null });
    expect(list.some((p) => p.key === "md_cashflow:next30_negative")).toBe(true);
  });

  it("fires low_margin priorities from profit", () => {
    const p = profit({
      low_margin_jobs: [
        { quote_id: "q1", title: "Kitchen refit", estimated_total_pence: 500_000, materials_pence: 200_000, labour_pence: 250_000, overhead_pence: 0, profit_pence_planned: 10_000, paid_pence: 0, status: "accepted", margin_pct_planned: 2, evidence: ev() }
      ]
    });
    const list = buildPriorities({ bi: null, cashflow: null, profit: p, workforce: null });
    expect(list.some((x) => x.key === "md_profit:low_margin_q1")).toBe(true);
    // 2% margin < 5% → warning
    expect(list.find((x) => x.key === "md_profit:low_margin_q1")?.severity).toBe("warning");
  });

  it("sorts alerts before warnings before notices before info", () => {
    const p = profit({
      low_margin_jobs: [
        { quote_id: "q1", title: "Job", estimated_total_pence: 100, materials_pence: 0, labour_pence: 0, overhead_pence: 0, profit_pence_planned: 15, paid_pence: 0, status: "accepted", margin_pct_planned: 15, evidence: ev() }   // 15% < 20% target → notice
      ]
    });
    const s = cf({ overdue_now_pence: 700_000 });   // alert
    const list = buildPriorities({ bi: null, cashflow: s, profit: p, workforce: null });
    expect(list[0].severity).toBe("alert");
    expect(list[list.length - 1].severity === "notice" || list[list.length - 1].severity === "info").toBe(true);
  });

  it("caps at limit", () => {
    const many: BusinessHealth["observations"] = Array.from({ length: 20 }, (_, i) => ({
      key: `k${i}`, aspect: "quotations", severity: "info", headline: `note ${i}`, evidence: ev(), domain: "quotations" as never
    }));
    const list = buildPriorities({ bi: bi(many), cashflow: null, profit: null, workforce: null, limit: 5 });
    expect(list.length).toBeLessThanOrEqual(5);
  });
});

describe("isSilent", () => {
  it("true when only info-level items", () => {
    expect(isSilent([makePriority({ key: "x", source: "bi", severity: "info", headline: "" })])).toBe(true);
  });
  it("false when a warning is present", () => {
    expect(isSilent([makePriority({ key: "x", source: "bi", severity: "warning", headline: "" })])).toBe(false);
  });
});
