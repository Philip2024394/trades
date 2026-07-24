// Weekly report builder — pure formatter tests. Engine mocked to avoid DB.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../engine", () => ({
  buildBusinessSnapshot: vi.fn(async () => ({
    score: 88, band: "healthy",
    headline: "Business Health: 88%. Healthy.",
    computed_at: "2026-07-23T09:00:00.000Z",
    errors: [],
    observations: [
      { key: "revenue_up",   domain: "invoices", severity: "info",    headline: "Booked revenue is up 22%.", evidence: e() },
      { key: "quotes_late",  domain: "quotations", severity: "warning", headline: "5 quotes awaiting reply.", action: { label: "Draft follow-ups", href: "/nex" }, evidence: e() }
    ],
    domains: [
      dom("invoices",   "Invoices",   85, [
        { key: "revenue_gbp", label: "Booked revenue", value: 4280, unit: "gbp", direction: "higher_is_better", evidence: e() }
      ]),
      dom("quotations", "Quotations", 70, [
        { key: "quotes_sent", label: "Quotes sent", value: 12, unit: "count", direction: "higher_is_better", evidence: e() }
      ]),
      dom("projects",   "Projects",   80, [
        { key: "projects_completed", label: "Completed", value: 3, unit: "count", direction: "higher_is_better", evidence: e() }
      ]),
      dom("leads",      "Leads",      70, [
        { key: "leads_in", label: "Leads in", value: 9, unit: "count", direction: "higher_is_better", evidence: e() }
      ])
    ]
  }))
}));

import { buildWeeklyReport, weeklyReportToText } from "./weekly";

function e() { return { source: "t", tables: [], computed_at: "x" }; }
function dom(domain: string, label: string, sub_score: number | null, metrics: unknown[]) {
  return { domain, label, sub_score, weight: 1, metrics, observations: [] } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("buildWeeklyReport", () => {
  it("includes headline + summary + achievements + attention", async () => {
    const r = await buildWeeklyReport("m1");
    expect(r.headline).toContain("88%");
    expect(r.summary).toContain("Booked £4,280");
    expect(r.summary).toContain("9 enquiries");
    expect(r.achievements).toContain("Booked revenue is up 22%.");
    expect(r.attention).toContain("5 quotes awaiting reply.");
    expect(r.actions[0]).toContain("Draft follow-ups");
  });

  it("weeklyReportToText renders sections in order", async () => {
    const r = await buildWeeklyReport("m1");
    const txt = weeklyReportToText(r);
    expect(txt.indexOf("Achievements:")).toBeLessThan(txt.indexOf("Needs attention:"));
    expect(txt.indexOf("Needs attention:")).toBeLessThan(txt.indexOf("Recommended actions:"));
  });
});
