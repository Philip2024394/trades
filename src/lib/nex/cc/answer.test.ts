// CC answer router — classifier + formatters.

import { describe, it, expect } from "vitest";
import {
  classifyCCQuestion,
  formatAssetForecast,
  formatPropertyOverview,
  formatSearch
} from "./answer";
import type { BuildPropertySnapshotResult } from "./snapshot";
import type { PropertySnapshot } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

function snap(overrides: Partial<PropertySnapshot> = {}): PropertySnapshot {
  return {
    property: {
      property_id: "prop_x", homeowner_id: "h1", homeowner_name: "Elaine Smith",
      address_line: "14 High Street", address_postcode: "M25 1AB", address_city: "Manchester",
      first_seen_at: "2026-01-01T00:00:00Z"
    },
    viewer:                  "homeowner",
    projects_count:          2,
    projects:                [],
    photos_count:            5,
    documents_count:         2,
    costs_total_pence:       400_000,
    costs_paid_pence:        300_000,
    costs_outstanding_pence: 100_000,
    assets:                  [
      { key: "a1", kind: "boiler", label: "Boiler", installed_at: "2026-02-01", trade_name: "Phil", supplier: null, warranty_expires_at: null, next_maintenance_at: "2026-08-10", cadence_days: 365, evidence: ev }
    ],
    forecast:                [
      { asset_key: "a1", asset_label: "Boiler", next_due_at: "2026-08-10", days_until: 18, cadence_days: 365, status: "due_soon", suggested_action: "Book this in the next few weeks.", evidence: ev }
    ],
    timeline:                [],
    computed_at:             "2026-07-23T00:00:00Z",
    errors:                  [],
    ...overrides
  };
}

describe("classifyCCQuestion", () => {
  it("routes property overview", () => {
    const q = classifyCCQuestion("tell me everything about 14 High Street");
    expect(q.kind).toBe("property_overview");
    if (q.kind === "property_overview") expect(q.hint.toLowerCase()).toContain("14 high street");
  });

  it("routes asset forecast per asset keyword", () => {
    const q = classifyCCQuestion("when should the boiler be serviced?");
    expect(q.kind).toBe("asset_forecast");
    if (q.kind === "asset_forecast") expect(q.asset).toBe("boiler");
  });

  it("routes search", () => {
    const q = classifyCCQuestion("find every property with solar panels");
    expect(q.kind).toBe("search");
    if (q.kind === "search") expect(q.query.toLowerCase()).toContain("solar");
  });

  it("routes passport with inline address hint", () => {
    const q = classifyCCQuestion("build the passport for 14 High Street");
    expect(q.kind).toBe("passport");
    if (q.kind === "passport") expect(q.hint?.toLowerCase()).toContain("14 high street");
  });

  it("routes passport without inline address", () => {
    const q = classifyCCQuestion("build building passport");
    expect(q.kind).toBe("passport");
    if (q.kind === "passport") expect(q.hint).toBeUndefined();
  });

  it("returns 'none' for unrelated text", () => {
    expect(classifyCCQuestion("hello there").kind).toBe("none");
  });
});

describe("formatPropertyOverview", () => {
  it("prints address + owner + counts + assets + forecast (homeowner view surfaces costs)", () => {
    const res: BuildPropertySnapshotResult = { ok: true, snapshot: snap() };
    const out = formatPropertyOverview(res);
    expect(out).toContain("14 High Street");
    expect(out).toContain("Elaine Smith");
    expect(out).toContain("2 projects");
    expect(out).toContain("£4,000");   // total agreed
    expect(out).toContain("Boiler");
    expect(out).toContain("due_soon");
  });

  it("merchant view hides cost line", () => {
    const res: BuildPropertySnapshotResult = { ok: true, snapshot: snap({ viewer: "merchant" }) };
    const out = formatPropertyOverview(res);
    expect(out).not.toContain("Costs:");
  });

  it("ambiguous → asks for full address", () => {
    const res: BuildPropertySnapshotResult = { ok: false, reason: "ambiguous", matches: [
      { property_id: "1", homeowner_id: "h", homeowner_name: null, address_line: "14 High Street", address_postcode: "M25 1AB", address_city: null, first_seen_at: "x" },
      { property_id: "2", homeowner_id: "h", homeowner_name: null, address_line: "14 High Street", address_postcode: "L1 4RB",  address_city: null, first_seen_at: "x" }
    ] };
    const out = formatPropertyOverview(res);
    expect(out).toContain("more than one property");
    expect(out).toContain("M25 1AB");
    expect(out).toContain("L1 4RB");
  });

  it("not_found → friendly no-match reply", () => {
    const res: BuildPropertySnapshotResult = { ok: false, reason: "not_found" };
    expect(formatPropertyOverview(res)).toContain("No property");
  });

  it("not_yours → out-of-scope reply", () => {
    const res: BuildPropertySnapshotResult = { ok: false, reason: "not_yours" };
    expect(formatPropertyOverview(res).toLowerCase()).toContain("isn't in your trade os scope");
  });
});

describe("formatAssetForecast", () => {
  it("filters forecast by asset keyword", () => {
    const res: BuildPropertySnapshotResult = { ok: true, snapshot: snap() };
    const out = formatAssetForecast(res, "boiler");
    expect(out).toContain("Boiler");
    expect(out).toContain("18 days");
  });

  it("returns 'no <asset>' when nothing matches", () => {
    const res: BuildPropertySnapshotResult = { ok: true, snapshot: snap({ forecast: [] }) };
    expect(formatAssetForecast(res, "roof")).toContain("No roof");
  });
});

describe("formatSearch", () => {
  it("empty → no-results reply", () => {
    expect(formatSearch([], "solar")).toContain('No properties');
  });
  it("lists matches with reason", () => {
    const out = formatSearch([
      { address_line: "14 High Street", address_postcode: "M25", homeowner_name: "Elaine", matched_reason: "matched 'solar' in project 'Roof + solar'" }
    ], "solar");
    expect(out).toContain("14 High Street");
    expect(out).toContain("Elaine");
    expect(out).toContain("Roof + solar");
  });
});
