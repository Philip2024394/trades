// Visual Pattern Library · tests.
//
// Doctrine: docs/brains/nex-visual-pattern-library-and-design-genome-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import {
  register, get, count, byFamily, findMatches, reinforce, applyPattern, clear,
  seedPremiumTradeBanner,
} from "./index";
import type { PatternDNA } from "./index";

beforeEach(() => clear());

function makeCarousel(): PatternDNA {
  return {
    pattern_id: "INSTAGRAM_CAROUSEL_V1",
    family: "instagram_carousel",
    display_name: "Instagram Carousel · 10-frame product story",
    layout: { columns: 1, rows: 1, hero_position: "center", aspect_ratios: ["1:1", "4:5"] },
    alignment: "centered symmetric",
    spacing_grammar: "40px margin · 24px between frames",
    safe_zones: [{ id: "z1", x_pct: 8, y_pct: 8, width_pct: 84, height_pct: 84, role: "hero_product" }],
    colour_hierarchy: ["theme_pack.primary", "theme_pack.accent"],
    typography_hierarchy: [{ role: "headline", weight: "bold", hierarchy_rank: 1 }],
    icon_spacing: "16px",
    cta_placement: "final_frame_cta",
    best_industries: ["joinery"],
    best_audience: ["modern_family"],
    best_platforms: ["instagram_feed"],
    object_slot_bindings: [
      { slot_id: "hero_slot", accepts: ["OTHER"], role: "product frame", required: true },
    ],
    banner_example_asset_ids: [],
    history: [{ version: 1, captured_at: "2026-08-04T00:00:00Z", changes: ["seed"], changed_by: "test", confidence: 0.8 }],
    aggregate_confidence: 0.8,
    observation_count: 1,
    provenance: { named_expert: "Philip O'Farrell", authored: "2026-08-04" },
    created_at: "2026-08-04T00:00:00Z",
    updated_at: "2026-08-04T00:00:00Z",
  };
}

describe("Visual Pattern Library", () => {
  it("seedPremiumTradeBanner registers PREMIUM_TRADE_BANNER_V1", () => {
    const p = seedPremiumTradeBanner();
    expect(p.pattern_id).toBe("PREMIUM_TRADE_BANNER_V1");
    expect(count()).toBe(1);
    expect(get("PREMIUM_TRADE_BANNER_V1")?.layout.hero_position).toBe("right");
    expect(get("PREMIUM_TRADE_BANNER_V1")?.cta_placement).toBe("bottom_right_contact_box");
  });

  it("Premium Trade Banner declares required hero + contact slots", () => {
    const p = seedPremiumTradeBanner();
    const required = p.object_slot_bindings.filter((s) => s.required).map((s) => s.slot_id);
    expect(required).toContain("hero_slot");
    expect(required).toContain("contact_slot");
  });

  it("register rejects duplicate ids", () => {
    seedPremiumTradeBanner();
    expect(() => seedPremiumTradeBanner()).toThrow(/already registered/);
  });

  it("byFamily filters by pattern family", () => {
    seedPremiumTradeBanner();
    register(makeCarousel());
    expect(byFamily("marketing_banner")).toHaveLength(1);
    expect(byFamily("instagram_carousel")).toHaveLength(1);
  });

  it("similarity ranks matching layout + CTA higher than unrelated families", () => {
    seedPremiumTradeBanner();
    register(makeCarousel());
    const candidate = { family: "marketing_banner" as const, layout: { columns: 2, rows: 3, hero_position: "right" as const, aspect_ratios: ["1.91:1"] }, cta_placement: "bottom_right_contact_box" };
    const matches = findMatches(candidate, 0.5);
    expect(matches[0].pattern.pattern_id).toBe("PREMIUM_TRADE_BANNER_V1");
    expect(matches[0].similarity).toBeGreaterThan(0.7);
  });

  it("reinforce bumps observation_count + confidence + adds evidence", () => {
    seedPremiumTradeBanner();
    const before = get("PREMIUM_TRADE_BANNER_V1")!;
    const beforeConf = before.aggregate_confidence;
    const r = reinforce("PREMIUM_TRADE_BANNER_V1", 0.02, "vlp_test", "asset_loft_ladder_001");
    expect(r.observation_count).toBe(2);
    expect(r.aggregate_confidence).toBeGreaterThanOrEqual(beforeConf);
    expect(r.banner_example_asset_ids).toContain("asset_loft_ladder_001");
  });

  it("reinforce caps confidence at 1.0", () => {
    seedPremiumTradeBanner();
    reinforce("PREMIUM_TRADE_BANNER_V1", 0.5, "test", "e1");
    const p = get("PREMIUM_TRADE_BANNER_V1")!;
    expect(p.aggregate_confidence).toBeLessThanOrEqual(1);
  });

  it("applyPattern requires bindings for every required slot", () => {
    seedPremiumTradeBanner();
    expect(() => applyPattern("PREMIUM_TRADE_BANNER_V1", { hero_slot: "obj_x" })).toThrow(/missing required slot bindings/);
    const app = applyPattern("PREMIUM_TRADE_BANNER_V1", { hero_slot: "obj_x", contact_slot: "obj_y" });
    expect(app.pattern_id).toBe("PREMIUM_TRADE_BANNER_V1");
    expect(app.object_bindings.hero_slot).toBe("obj_x");
    expect(app.provenance).toContain("Premium Trade Banner");
  });

  it("applyPattern accepts overrides + records provenance", () => {
    seedPremiumTradeBanner();
    const app = applyPattern("PREMIUM_TRADE_BANNER_V1",
      { hero_slot: "STAIR_HANDRAIL_000001", contact_slot: "CONTACT_000001" },
      { overrides: { theme_pack: "luxury_burgundy", headline: "OUR CRAFT" }, provenance: "customer_request_v3" });
    expect(app.overrides?.theme_pack).toBe("luxury_burgundy");
    expect(app.provenance).toBe("customer_request_v3");
  });

  it("applyPattern throws for unknown patterns", () => {
    expect(() => applyPattern("NONEXISTENT", {})).toThrow(/unknown pattern_id/);
  });
});
