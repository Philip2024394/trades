// Site briefing composer — engine mocked, formatter exercised.

import { describe, it, expect, vi } from "vitest";

vi.mock("./engine", () => ({
  buildProjectSnapshot: vi.fn(async () => ({
    ok: true,
    snapshot: {
      project:      { id: "p1", title: "Smith extension", status: "in-progress", address_city: "M/CR", cover_photo_url: null, started_at: null, completed_at: null, budget_min_gbp: null, budget_max_gbp: null, total_spent_gbp: 0 },
      viewer:       "homeowner",
      health:       { score: 82, band: "healthy", headline: "Project Health: 82%. Healthy." },
      aspects:      [],
      observations: [
        { key: "cost1",  aspect: "costs",         severity: "warning", headline: "£1,500 overdue.",             evidence: e() },
        { key: "snag1",  aspect: "things_to_fix", severity: "notice",  headline: "Snag open for 22 days.",      evidence: e() },
        { key: "risk1",  aspect: "risks",         severity: "alert",   headline: "No photos for 14 days.",      evidence: e() }
      ],
      timeline: [
        { at: "2026-07-23T08:00:00Z", event_type: "payment_made", actor_type: "homeowner", actor_name: "Phil", headline: "Paid £500.",  evidence: e() },
        { at: "2026-07-22T10:00:00Z", event_type: "photo_added",  actor_type: "trade",     actor_name: "Dave", headline: "Photo up.",   evidence: e() }
      ],
      computed_at: "2026-07-23T09:00:00Z",
      errors: []
    }
  }))
}));

function e() { return { source: "t", tables: [], computed_at: "x" }; }

import { buildSiteBriefing, siteBriefingToText } from "./site-briefing";

describe("buildSiteBriefing", () => {
  it("groups observations into sections", async () => {
    const r = await buildSiteBriefing({ projectId: "p1", viewer: "homeowner", viewerId: "h1", now: new Date("2026-07-23T10:00:00Z") });
    if (!r.ok) throw new Error();
    const headings = r.briefing.sections.map((s) => s.heading);
    expect(headings).toContain("Today so far");
    expect(headings).toContain("Payments needing attention");
    expect(headings).toContain("Outstanding tasks");
    expect(headings).toContain("Active risks");
  });

  it("today-so-far only includes today's events", async () => {
    const r = await buildSiteBriefing({ projectId: "p1", viewer: "homeowner", viewerId: "h1", now: new Date("2026-07-23T10:00:00Z") });
    if (!r.ok) throw new Error();
    const today = r.briefing.sections.find((s) => s.heading === "Today so far");
    expect(today?.bullets.some((b) => b.includes("Paid £500"))).toBe(true);
    expect(today?.bullets.some((b) => b.includes("Photo up"))).toBe(false);
  });

  it("text renderer shows headline + sections", async () => {
    const r = await buildSiteBriefing({ projectId: "p1", viewer: "homeowner", viewerId: "h1" });
    if (!r.ok) throw new Error();
    const txt = siteBriefingToText(r.briefing);
    expect(txt).toContain("Smith extension");
    expect(txt).toContain("Project Health: 82%");
    expect(txt).toContain("Active risks:");
  });
});
