// Types + helpers — pure functions, no DB.

import { describe, it, expect } from "vitest";
import { V0_VISIBILITIES, computeConfidence, defaultDecayFor } from "./types";

describe("V0_VISIBILITIES", () => {
  it("only enables owner-only family in V0", () => {
    expect(V0_VISIBILITIES).toEqual(["owner_only", "owner_and_delegates", "project_participants"]);
    expect(V0_VISIBILITIES).not.toContain("trade_k5");
    expect(V0_VISIBILITIES).not.toContain("region_k5");
  });
});

describe("defaultDecayFor", () => {
  it("regulation.* never decays", () => {
    expect(defaultDecayFor("regulation.part_l")).toBeNull();
  });
  it("market/supplier decays ~90 days", () => {
    const iso = defaultDecayFor("market.mdpe_25mm.price_pence")!;
    const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(85);
    expect(days).toBeLessThan(95);
  });
  it("pricing/financial decays ~180 days", () => {
    const iso = defaultDecayFor("pricing.kitchen.total_pence")!;
    const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(175);
    expect(days).toBeLessThan(185);
  });
  it("other subjects default to ~365 days", () => {
    const iso = defaultDecayFor("preference.tools")!;
    const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(370);
  });
});

describe("computeConfidence", () => {
  it("base low with no bumps stays low", () => {
    expect(computeConfidence({ base: "low" })).toBe("low");
  });
  it("sample_size >= 20 bumps up one tier", () => {
    expect(computeConfidence({ base: "low", sample_size: 25 })).toBe("medium");
  });
  it("is_official + is_verified + fresh + large sample can max to high", () => {
    const observed = new Date().toISOString();
    const decays   = new Date(Date.now() + 365 * 86_400_000).toISOString();
    expect(computeConfidence({
      base: "low", sample_size: 30, is_official: true, is_verified: true,
      observed_at: observed, decays_at: decays
    })).toBe("high");
  });
  it("conflict flag drops one tier", () => {
    expect(computeConfidence({ base: "high", conflict: true })).toBe("medium");
  });
  it("never exceeds high or drops below low (clamps)", () => {
    expect(computeConfidence({ base: "high", sample_size: 100, is_official: true, is_verified: true })).toBe("high");
    expect(computeConfidence({ base: "low", conflict: true })).toBe("low");
  });
});
