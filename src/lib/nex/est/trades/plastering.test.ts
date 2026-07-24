// Plastering adapter — spec's worked example (42 m²).

import { describe, it, expect } from "vitest";
import { plasteringAdapter } from "./plastering";
import { ENGINE_DEFAULTS } from "../defaults";
import type { MerchantDefaults } from "../types";

const defaults: MerchantDefaults = {
  ...ENGINE_DEFAULTS,
  source: { labour_rate: "engine", overhead: "engine", profit_margin: "engine", default_waste: "engine", vat: "engine" }
};

describe("plastering.parse", () => {
  it("parses '42m² of plastering'", () => {
    const p = plasteringAdapter.parse("estimate 42m² of plastering");
    expect(p).not.toBeNull();
    expect(p?.area_m2).toBe(42);
    expect(p?.finish).toBe("skim_only");
    expect(p?.substrate).toBe("solid");
  });

  it("parses '55 square metres of skim'", () => {
    const p = plasteringAdapter.parse("55 square metres of skim");
    expect(p?.area_m2).toBe(55);
  });

  it("detects bonding + slab finishes", () => {
    expect(plasteringAdapter.parse("plaster 30m² with bonding coat")?.finish).toBe("bonding_skim");
    expect(plasteringAdapter.parse("plaster 30m² dot and dab")?.finish).toBe("slab_skim");
  });

  it("detects timber studwork substrate", () => {
    expect(plasteringAdapter.parse("plaster 30m² timber studwork")?.substrate).toBe("timber_studwork");
  });

  it("returns null when not plastering", () => {
    expect(plasteringAdapter.parse("42m² of concrete")).toBeNull();
  });

  it("returns null when no measurement", () => {
    expect(plasteringAdapter.parse("plaster my kitchen")).toBeNull();
  });
});

describe("plastering.compute — 42 m² skim (spec example)", () => {
  const input = { parameters: { area_m2: 42, finish: "skim_only" as const, substrate: "solid" as const } };
  const base = plasteringAdapter.compute(input, defaults, {});

  it("produces the scope string", () => {
    expect(base.scope).toContain("42 m²");
    expect(base.scope).toContain("skim");
    expect(base.scope).toContain("solid substrate");
  });

  it("skim on solid substrate has NO plasterboards", () => {
    const boards = base.materialLines.find((l) => l.label.startsWith("Plasterboard"));
    expect(boards).toBeUndefined();
  });

  it("bags of plaster: 42 ÷ 9 = 4.67 → ×1.05 → round up = 5 bags", () => {
    const bags = base.materialLines.find((l) => l.label.startsWith("Finish plaster"));
    expect(bags?.qty).toBe(5);
    expect(bags?.explanation).toContain("42 m²");
    expect(bags?.explanation).toContain("9 m²/bag");
  });

  it("tape: 42 × 1.5 = 63 m → 1 roll (90m)", () => {
    const tape = base.materialLines.find((l) => l.label === "Scrim tape");
    expect(tape?.qty).toBe(1);
  });

  it("labour: 42 ÷ 2.5 = 17 hours across 2 plasterers (~1.1 days)", () => {
    expect(base.labour_hours).toBe(17);
    expect(base.crew_size).toBe(2);
    expect(base.duration_days).toBeCloseTo(1.1, 1);
  });

  it("every line carries an explanation with arithmetic", () => {
    for (const l of [...base.materialLines, ...base.labourLines]) {
      expect(l.explanation.length).toBeGreaterThan(10);
    }
  });
});

describe("plastering.compute — with timber studwork", () => {
  const base = plasteringAdapter.compute({ parameters: { area_m2: 42, finish: "slab_skim", substrate: "timber_studwork" } }, defaults, {});
  it("slab_skim on studwork adds plasterboards", () => {
    const boards = base.materialLines.find((l) => l.label.startsWith("Plasterboard"));
    expect(boards).toBeDefined();
    // 42 / 2.88 = 14.58 * 1.08 = 15.75 → 16
    expect(boards?.qty).toBe(16);
  });
});
