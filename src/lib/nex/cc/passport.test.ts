// Building Passport — pure builders + text renderer.

import { describe, it, expect } from "vitest";
import { buildBuildingPassport, buildingPassportToText } from "./passport";
import type { PropertySnapshot } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

function snap(overrides: Partial<PropertySnapshot> = {}): PropertySnapshot {
  return {
    property: {
      property_id: "prop_x", homeowner_id: "h1", homeowner_name: "Elaine Smith",
      address_line: "14 High Street", address_postcode: "M25 1AB", address_city: "Manchester",
      first_seen_at: "2026-01-01T00:00:00Z"
    },
    viewer: "merchant",
    projects_count: 2,
    projects: [
      { project_id: "p1", title: "Kitchen refit",  status: "complete",    started_at: "2026-01-05T00:00:00Z", completed_at: "2026-02-14T00:00:00Z" },
      { project_id: "p2", title: "Bathroom refit", status: "in-progress", started_at: "2026-07-01T00:00:00Z", completed_at: null }
    ],
    photos_count:            12,
    documents_count:         3,
    costs_total_pence:       450_000,
    costs_paid_pence:        300_000,
    costs_outstanding_pence: 150_000,
    assets: [
      { key: "a1", kind: "boiler", label: "Boiler", installed_at: "2026-02-01", trade_name: "Phil Plumbing", supplier: null, warranty_expires_at: "2031-02-01", next_maintenance_at: "2026-08-10", cadence_days: 365, evidence: ev }
    ],
    forecast: [
      { asset_key: "a1", asset_label: "Boiler", next_due_at: "2026-08-10", days_until: 18, cadence_days: 365, status: "due_soon", suggested_action: "Book this in the next few weeks.", evidence: ev }
    ],
    timeline: [],
    computed_at: "2026-07-23T00:00:00Z",
    errors: [],
    ...overrides
  };
}

describe("buildBuildingPassport", () => {
  it("summary includes address + project count + first-seen date", () => {
    const p = buildBuildingPassport(snap());
    expect(p.summary).toContain("14 High Street");
    expect(p.summary).toContain("2 projects");
    expect(p.summary).toContain("2026-01-01");
  });

  it("warranties list built from assets with warranty or maintenance", () => {
    const p = buildBuildingPassport(snap());
    expect(p.warranties.length).toBe(1);
    expect(p.warranties[0].expires_at).toBe("2031-02-01");
  });

  it("recommendations reflect forecast statuses", () => {
    const p = buildBuildingPassport(snap());
    expect(p.future_recommendations.some((r) => r.toLowerCase().includes("boiler"))).toBe(true);
    expect(p.future_recommendations.some((r) => r.includes("18 days"))).toBe(true);
  });

  it("empty-forecast property gets the 'add care items' note", () => {
    const p = buildBuildingPassport(snap({ forecast: [], assets: [] }));
    expect(p.future_recommendations[0]).toContain("Add care items");
  });

  it("disclaimer is always present", () => {
    const p = buildBuildingPassport(snap());
    expect(p.disclaimer.length).toBeGreaterThan(0);
    expect(p.disclaimer.toLowerCase()).toContain("verify");
  });
});

describe("buildingPassportToText", () => {
  it("renders headline + summary + projects + assets + warranties + maintenance + disclaimer", () => {
    const p = buildBuildingPassport(snap());
    const t = buildingPassportToText(p);
    expect(t).toContain("Building Passport");
    expect(t).toContain("14 High Street");
    expect(t).toContain("Kitchen refit");
    expect(t).toContain("Assets installed:");
    expect(t).toContain("Warranties");
    expect(t).toContain("Upcoming maintenance");
    expect(t).toContain(p.disclaimer);
  });
});
