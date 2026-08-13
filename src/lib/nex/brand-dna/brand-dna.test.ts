// Brand DNA · tests.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import { get, all, count, reinforce, reset, suggestArchetypes } from "./index";

beforeEach(() => reset());

describe("Brand DNA", () => {
  it("seeds all 10 brand archetypes", () => {
    expect(count()).toBe(10);
  });

  it("all archetypes carry Rule-c provenance", () => {
    for (const p of all()) {
      expect(p.provenance.named_expert).toBe("Philip O'Farrell");
      expect(p.aggregate_confidence).toBe(0.5);
      expect(p.observation_count).toBe(0);
    }
  });

  it("reinforce bumps confidence + observation_count + adds evidence + logs history", () => {
    const before = get("industrial")!;
    const r = reinforce("industrial", 0.05, "loft_ladder_banner_003 · industrial_black_red", "asset_loft_003");
    expect(r.observation_count).toBe(before.observation_count + 1);
    expect(r.aggregate_confidence).toBeGreaterThan(before.aggregate_confidence);
    expect(r.evidence_asset_ids).toContain("asset_loft_003");
    expect(r.history[0].reason).toContain("industrial_black_red");
  });

  it("reinforce caps confidence at 1.0", () => {
    reinforce("luxury", 0.9, "seed test");
    reinforce("luxury", 0.9, "seed test 2");
    expect(get("luxury")!.aggregate_confidence).toBeLessThanOrEqual(1);
  });

  it("unknown archetype throws", () => {
    expect(() => reinforce("nonexistent" as never, 0.1, "test")).toThrow(/Unknown brand archetype/);
  });

  it("suggestArchetypes ranks by keyword + audience + colour agreement", () => {
    const suggestions = suggestArchetypes({ keywords: ["strength", "engineering"], audience: "builder_trade", colour_meaning: "strength" });
    expect(suggestions[0].archetype).toBe("industrial");
    expect(suggestions[0].score).toBeGreaterThan(0.5);
  });

  it("suggestArchetypes returns empty when no matches", () => {
    expect(suggestArchetypes({ keywords: ["nothing_matches"], audience: "unknown" })).toEqual([]);
  });

  it("suggestArchetypes handles luxury profile keywords", () => {
    const s = suggestArchetypes({ keywords: ["elegant", "high-end"], audience: "luxury_homeowner", colour_meaning: "luxury" });
    expect(s[0].archetype).toBe("luxury");
  });

  it("reinforce is auditable via history field", () => {
    reinforce("family", 0.02, "loft_ladder_banner_004 · nature_green", "asset_004");
    reinforce("family", 0.03, "kitchen_family_002", "asset_family_kitchen_002");
    const p = get("family")!;
    expect(p.history).toHaveLength(2);
    expect(p.history[0].reason).toContain("loft_ladder");
    expect(p.history[1].reason).toContain("kitchen");
  });
});
