// Design Memory · tests.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import { save, get, latest, findSimilar, count, clear, planReuse } from "./index";
import type { DesignMemoryEntry } from "./index";

function makeEntry(overrides?: Partial<DesignMemoryEntry>): DesignMemoryEntry {
  return {
    memory_id: "mem_001",
    project_id: "proj_kitchen_smith",
    captured_at: "2026-07-01T10:00:00Z",
    original_brief: "family shaker kitchen with island · oak worktop",
    final_rendered_asset_id: "asset_kitchen_hero_003",
    design_document: { kitchen: { worktop: { material: "oak" } }, island_mm: 2400 },
    design_decisions: ["timber=oak matches shaker style", "island 2.4m fits family"],
    style_tags: ["family", "shaker", "oak", "kitchen"],
    render_settings: { theme_pack: "family", layout_family: "premium_trade_banner_v1", camera_profile: "instagram" },
    quality_score: { overall: 88, dimensions: { realism: 92, composition: 85 } },
    provenance: { named_expert: "Philip O'Farrell", authored: "2026-08-04" },
    ...overrides,
  };
}

beforeEach(() => clear());

describe("Design Memory", () => {
  it("save + get roundtrip", () => {
    save(makeEntry());
    expect(get("mem_001")?.original_brief).toContain("shaker");
  });

  it("latest returns the most recent entry for a project", () => {
    save(makeEntry({ memory_id: "mem_a", captured_at: "2026-07-01T10:00:00Z" }));
    save(makeEntry({ memory_id: "mem_b", captured_at: "2026-08-01T10:00:00Z" }));
    expect(latest("proj_kitchen_smith")?.memory_id).toBe("mem_b");
  });

  it("findSimilar filters by project + style_tag overlap · scores by hits", () => {
    save(makeEntry({ memory_id: "mem_a", style_tags: ["oak", "shaker", "family"] }));
    save(makeEntry({ memory_id: "mem_b", style_tags: ["walnut", "modern", "luxury"] }));
    save(makeEntry({ memory_id: "mem_c", style_tags: ["oak", "modern", "kitchen"] }));
    const results = findSimilar({ project_id: "proj_kitchen_smith", style_tag_any: ["oak", "shaker"] });
    expect(results[0].memory_id).toBe("mem_a");
  });

  it("findSimilar honours min_quality_score", () => {
    save(makeEntry({ memory_id: "mem_high", quality_score: { overall: 90 } }));
    save(makeEntry({ memory_id: "mem_low", quality_score: { overall: 60 } }));
    const results = findSimilar({ min_quality_score: 80 });
    expect(results.map((r) => r.memory_id)).toContain("mem_high");
    expect(results.map((r) => r.memory_id)).not.toContain("mem_low");
  });

  it("count reflects the store size", () => {
    save(makeEntry({ memory_id: "a" }));
    save(makeEntry({ memory_id: "b" }));
    expect(count()).toBe(2);
  });

  it("planReuse produces a plan that preserves everything not being changed", () => {
    const base = makeEntry();
    const plan = planReuse(base, {
      project_id: base.project_id,
      changes: ["Replace oak with walnut"],
      author: "philip",
      reason: "customer prefers walnut this year",
    });
    expect(plan.base_entry.memory_id).toBe("mem_001");
    expect(plan.changes_to_apply).toHaveLength(1);
    expect(plan.preserved.length).toBeGreaterThan(0);
    expect(plan.reasoning.some((r) => r.includes("base_memory=mem_001"))).toBe(true);
  });
});
