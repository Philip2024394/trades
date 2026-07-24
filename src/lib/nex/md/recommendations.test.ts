// Recommendations — urgency mapping + top-N.

import { describe, it, expect } from "vitest";
import { buildRecommendations, toRecommendation } from "./recommendations";
import type { PriorityItem } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

describe("toRecommendation", () => {
  it("alert → today, warning → today, notice → this_week, info → this_month", () => {
    expect(toRecommendation({ key: "a", source: "bi", severity: "alert", headline: "x", evidence: ev }).urgency).toBe("today");
    expect(toRecommendation({ key: "a", source: "bi", severity: "warning", headline: "x", evidence: ev }).urgency).toBe("today");
    expect(toRecommendation({ key: "a", source: "bi", severity: "notice", headline: "x", evidence: ev }).urgency).toBe("this_week");
    expect(toRecommendation({ key: "a", source: "bi", severity: "info", headline: "x", evidence: ev }).urgency).toBe("this_month");
  });

  it("action keywords map to plain-English chase actions", () => {
    expect(toRecommendation({ key: "md_cashflow:overdue", source: "md_cashflow", severity: "warning", headline: "£2k overdue", evidence: ev }).action).toContain("Chase overdue");
    expect(toRecommendation({ key: "md_profit:low_margin_q1", source: "md_profit", severity: "notice", headline: "low", evidence: ev }).action).toContain("low-margin job");
  });

  it("reason falls back to headline when no detail", () => {
    const r = toRecommendation({ key: "x", source: "bi", severity: "warning", headline: "the headline", evidence: ev });
    expect(r.reason).toBe("the headline");
  });
});

describe("buildRecommendations", () => {
  const priorities: PriorityItem[] = [
    { key: "a", source: "bi",          severity: "notice",  headline: "notice thing", evidence: ev },
    { key: "b", source: "md_cashflow", severity: "alert",   headline: "alert thing",  evidence: ev },
    { key: "c", source: "md_profit",   severity: "warning", headline: "warn thing",   evidence: ev }
  ];

  it("orders by urgency: today first, then this_week, then this_month", () => {
    const recs = buildRecommendations(priorities, 10);
    expect(recs[0].urgency).toBe("today");   // alert
    expect(recs[1].urgency).toBe("today");   // warning
    expect(recs[2].urgency).toBe("this_week"); // notice
  });

  it("caps at limit", () => {
    const many: PriorityItem[] = Array.from({ length: 30 }, (_, i) => ({ key: `p${i}`, source: "bi", severity: "info", headline: `p${i}`, evidence: ev }));
    expect(buildRecommendations(many, 3).length).toBe(3);
  });
});
