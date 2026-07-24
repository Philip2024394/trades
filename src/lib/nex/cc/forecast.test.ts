// Maintenance forecast — pure function on asset list.

import { describe, it, expect } from "vitest";
import { buildMaintenanceForecast } from "./forecast";
import type { AssetItem } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };
const now = new Date("2026-07-23T00:00:00Z");

function asset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    key:                 "k",
    kind:                "boiler",
    label:               "Boiler",
    installed_at:        null,
    trade_name:          null,
    supplier:            null,
    warranty_expires_at: null,
    next_maintenance_at: null,
    cadence_days:        null,
    evidence:            ev,
    ...overrides
  };
}

describe("buildMaintenanceForecast", () => {
  it("skips assets with no next_maintenance_at", () => {
    expect(buildMaintenanceForecast([asset()], now)).toEqual([]);
  });

  it("tags overdue when next_due < now", () => {
    const list = buildMaintenanceForecast([asset({ next_maintenance_at: "2026-01-01T00:00:00Z" })], now);
    expect(list[0].status).toBe("overdue");
    expect(list[0].days_until).toBeLessThan(0);
    expect(list[0].suggested_action.toLowerCase()).toContain("past its scheduled");
  });

  it("tags due_soon within 30 days", () => {
    const list = buildMaintenanceForecast([asset({ next_maintenance_at: "2026-08-10T00:00:00Z" })], now);
    expect(list[0].status).toBe("due_soon");
    expect(list[0].days_until).toBeLessThanOrEqual(30);
  });

  it("tags upcoming beyond 30 days", () => {
    const list = buildMaintenanceForecast([asset({ next_maintenance_at: "2026-10-01T00:00:00Z" })], now);
    expect(list[0].status).toBe("upcoming");
  });

  it("sorts overdue → due_soon → upcoming (soonest first)", () => {
    const list = buildMaintenanceForecast([
      asset({ key: "a", next_maintenance_at: "2026-10-01T00:00:00Z" }),   // upcoming
      asset({ key: "b", next_maintenance_at: "2026-01-01T00:00:00Z" }),   // overdue
      asset({ key: "c", next_maintenance_at: "2026-08-05T00:00:00Z" })    // due_soon
    ], now);
    expect(list.map((x) => x.asset_key)).toEqual(["b", "c", "a"]);
  });
});
