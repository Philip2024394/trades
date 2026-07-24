// Engine — assembly correctness, waste/overhead/profit/VAT arithmetic,
// full pipeline via buildEstimate() with real plastering adapter.

import { describe, it, expect } from "vitest";
import { assemble, buildEstimate } from "./engine";
import { ENGINE_DEFAULTS } from "./defaults";
import { evidenceFor, type MerchantDefaults, type TradeBase } from "./types";

const defaults: MerchantDefaults = {
  ...ENGINE_DEFAULTS,
  source: {
    labour_rate: "engine", overhead: "engine", profit_margin: "engine", default_waste: "engine", vat: "engine"
  }
};

const ev = evidenceFor("test", []);

describe("assemble", () => {
  it("layers waste, overhead, profit, VAT correctly", () => {
    const base: TradeBase = {
      scope: "test",
      parameters: {},
      materialLines: [{ category: "material", label: "Materials", total_pence: 10_000, explanation: "", evidence: ev }],
      labourLines:   [{ category: "labour",   label: "Labour",    total_pence: 20_000, explanation: "", evidence: ev }],
      plantLines:    [],
      deliveryLines: [],
      labour_hours:  4,
      crew_size:     1,
      duration_days: 0.5,
      warnings:      []
    };
    const e = assemble("test", "Test", base, defaults);
    // Materials 10000, Labour 20000, waste 10% of materials = 1000
    expect(e.materials_pence).toBe(10_000);
    expect(e.labour_pence).toBe(20_000);
    expect(e.waste_pence).toBe(1_000);
    expect(e.subtotal_pence).toBe(31_000);
    // Overhead 12% of subtotal = 3720
    expect(e.overhead_pence).toBe(3_720);
    // Profit 20% of (subtotal + overhead) = 20% of 34720 = 6944
    expect(e.profit_pence).toBe(6_944);
    // Net = 34720 + 6944 = 41664
    expect(e.net_pence).toBe(41_664);
    // VAT 20% = 8333
    expect(e.vat_pence).toBe(8_333);
    // Total = 41664 + 8333 = 49997
    expect(e.total_pence).toBe(49_997);
  });

  it("honours waste_pct_override from the adapter", () => {
    const base: TradeBase = {
      scope: "concrete pour",
      parameters: {},
      materialLines: [{ category: "material", label: "Concrete", total_pence: 10_000, explanation: "", evidence: ev }],
      labourLines:   [],
      plantLines:    [],
      deliveryLines: [],
      labour_hours: 2, crew_size: 1, duration_days: 0.25, warnings: [],
      waste_pct_override: 5
    };
    const e = assemble("concreting", "Concreting", base, defaults);
    // waste at 5% not 10%
    expect(e.waste_pence).toBe(500);
  });

  it("summary + total lines are appended after breakdown lines", () => {
    const base: TradeBase = {
      scope: "x", parameters: {},
      materialLines: [{ category: "material", label: "X", total_pence: 100, explanation: "", evidence: ev }],
      labourLines: [], plantLines: [], deliveryLines: [],
      labour_hours: 0, crew_size: 0, duration_days: 0, warnings: []
    };
    const e = assemble("t", "T", base, defaults);
    const cats = e.lines.map((l) => l.category);
    expect(cats).toEqual(expect.arrayContaining(["material", "waste", "subtotal", "overhead", "profit", "vat", "total"]));
    expect(cats[cats.length - 1]).toBe("total");
  });
});

describe("buildEstimate — end to end", () => {
  it("plasterings a 42m² job", async () => {
    const res = await buildEstimate({ brief: "estimate 42m² of plastering" });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error();
    const e = res.estimate;
    expect(e.trade).toBe("plastering");
    expect(e.parameters.area_m2).toBe(42);
    expect(e.materials_pence).toBeGreaterThan(0);
    expect(e.labour_pence).toBeGreaterThan(0);
    expect(e.total_pence).toBeGreaterThan(e.subtotal_pence);
    // Every non-summary line has an explanation
    for (const l of e.lines) {
      if (l.category === "subtotal" || l.category === "total") continue;
      expect(l.explanation.length).toBeGreaterThan(10);
    }
  });

  it("returns no_trade_matched for gibberish", async () => {
    const res = await buildEstimate({ brief: "banana pancakes" });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error();
    expect(res.reason).toBe("no_trade_matched");
  });

  it("concreting parses 1.5 m³", async () => {
    const res = await buildEstimate({ brief: "quote 1.5m³ concrete pour" });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error();
    expect(res.estimate.trade).toBe("concreting");
    expect(res.estimate.parameters.volume_m3).toBeCloseTo(1.5, 1);
  });

  it("paving parses 8m x 5m driveway", async () => {
    const res = await buildEstimate({ brief: "estimate block paving driveway 8m x 5m" });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error();
    expect(res.estimate.trade).toBe("paving");
    expect(res.estimate.parameters.area_m2).toBe(40);
  });

  it("painting parses 60 m² brief", async () => {
    const res = await buildEstimate({ brief: "estimate painting 60 m² of walls" });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error();
    expect(res.estimate.trade).toBe("painting");
  });
});
