// Joinery DNA Library · tests.
//
// Doctrine: docs/brains/nex-joinery-dna-library-ninth-genome-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import {
  get, all, count, reset, reinforce,
  familiesForTrade, familiesForDesignLanguage, sharedFamiliesAcross,
  query, detectClashes,
} from "./index";

beforeEach(() => reset());

describe("Joinery DNA Library", () => {
  it("seeds 20 joinery families", () => {
    expect(count()).toBe(20);
  });

  it("all families carry Rule-c provenance and start at confidence 0.5", () => {
    for (const f of all()) {
      expect(f.provenance.named_expert).toBe("Philip O'Farrell");
      expect(f.aggregate_confidence).toBe(0.5);
      expect(f.observation_count).toBe(0);
    }
  });

  it("familiesForTrade(kitchen) surfaces IN_FRAME_SHAKER · CROWN_MOULDING_STEPPED · INDUSTRIAL_STAINLESS · etc.", () => {
    const kitchen = familiesForTrade("kitchen");
    const ids = kitchen.map((f) => f.family_id);
    expect(ids).toContain("IN_FRAME_SHAKER");
    expect(ids).toContain("CROWN_MOULDING_STEPPED");
    expect(ids).toContain("INDUSTRIAL_STAINLESS");
    expect(ids).toContain("CONTEMPORARY_SLAB");
  });

  it("familiesForTrade(staircase) surfaces TURNED_TRADITIONAL · VICTORIAN_TURNED · IN_FRAME_SHAKER · etc.", () => {
    const stair = familiesForTrade("staircase");
    const ids = stair.map((f) => f.family_id);
    expect(ids).toContain("TURNED_TRADITIONAL");
    expect(ids).toContain("VICTORIAN_TURNED");
    expect(ids).toContain("IN_FRAME_SHAKER");
    expect(ids).toContain("BULLNOSE_PROFILE");
  });

  it("sharedFamiliesAcross([staircase, kitchen]) surfaces IN_FRAME_SHAKER · CROWN_MOULDING_STEPPED · WARM_WALNUT_LUXURY · NATURAL_OAK_HERITAGE", () => {
    const shared = sharedFamiliesAcross(["staircase", "kitchen"]);
    const ids = shared.map((f) => f.family_id);
    expect(ids).toContain("IN_FRAME_SHAKER");
    expect(ids).toContain("CROWN_MOULDING_STEPPED");
    expect(ids).toContain("WARM_WALNUT_LUXURY");
    expect(ids).toContain("NATURAL_OAK_HERITAGE");
    // Kitchen-only families should NOT appear
    expect(ids).not.toContain("INDUSTRIAL_STAINLESS");
    expect(ids).not.toContain("HANDLELESS_MODERN");
  });

  it("familiesForDesignLanguage(in_frame_traditional) surfaces IN_FRAME_SHAKER + BEADED_FACE_FRAME", () => {
    const ids = familiesForDesignLanguage("in_frame_traditional").map((f) => f.family_id);
    expect(ids).toContain("IN_FRAME_SHAKER");
    expect(ids).toContain("BEADED_FACE_FRAME");
  });

  it("reinforce bumps observation_count + confidence + adds evidence + logs trade", () => {
    reinforce("IN_FRAME_SHAKER", 0.02, "walnut in-frame kitchen upload", "kitchen", "asset_kitchen_001");
    reinforce("IN_FRAME_SHAKER", 0.02, "staircase newel panelling upload", "staircase", "asset_stair_001");
    const f = get("IN_FRAME_SHAKER")!;
    expect(f.observation_count).toBe(2);
    expect(f.aggregate_confidence).toBeGreaterThan(0.5);
    expect(f.evidence_asset_ids).toContain("asset_kitchen_001");
    expect(f.evidence_asset_ids).toContain("asset_stair_001");
    // Cross-trade proof: history has TWO trades
    const trades = f.history.map((h) => h.trade);
    expect(trades).toContain("kitchen");
    expect(trades).toContain("staircase");
  });

  it("reinforce caps confidence at 1.0", () => {
    for (let i = 0; i < 20; i++) reinforce("WARM_WALNUT_LUXURY", 0.5, "spam test", "kitchen");
    expect(get("WARM_WALNUT_LUXURY")!.aggregate_confidence).toBeLessThanOrEqual(1);
  });

  it("unknown family throws", () => {
    expect(() => reinforce("NONEXISTENT", 0.01, "test", "kitchen")).toThrow(/Unknown joinery family/);
  });

  it("query filters by trades + design_language + material + min_confidence", () => {
    reinforce("WARM_WALNUT_LUXURY", 0.05, "test", "kitchen");
    const results = query({ trades: ["kitchen", "staircase"], design_language: "luxury_heritage", material: "walnut", min_confidence: 0.5 });
    expect(results.some((r) => r.family_id === "WARM_WALNUT_LUXURY")).toBe(true);
  });

  it("detectClashes surfaces IN_FRAME_SHAKER + CONTEMPORARY_SLAB clash", () => {
    const clashes = detectClashes(["IN_FRAME_SHAKER", "CONTEMPORARY_SLAB", "WARM_WALNUT_LUXURY"]);
    expect(clashes.length).toBeGreaterThanOrEqual(1);
    expect(clashes.some((c) => c.a === "IN_FRAME_SHAKER" && c.b === "CONTEMPORARY_SLAB")).toBe(true);
    // WARM_WALNUT_LUXURY doesn't clash with IN_FRAME_SHAKER
    expect(clashes.every((c) => !((c.a === "WARM_WALNUT_LUXURY" && c.b === "IN_FRAME_SHAKER") || (c.a === "IN_FRAME_SHAKER" && c.b === "WARM_WALNUT_LUXURY")))).toBe(true);
  });

  it("detectClashes returns empty for a coherent selection", () => {
    const coherent = ["IN_FRAME_SHAKER", "RAISED_PANEL_TRADITIONAL", "WARM_WALNUT_LUXURY", "CROWN_MOULDING_STEPPED", "OGEE_MOULDING"];
    expect(detectClashes(coherent)).toEqual([]);
  });

  it("Every family declares at least one trade + one material + one characteristic feature", () => {
    for (const f of all()) {
      expect(f.trades_it_appears_in.length).toBeGreaterThan(0);
      expect(f.material_families.length).toBeGreaterThan(0);
      expect(f.characteristic_features.length).toBeGreaterThan(0);
    }
  });
});
