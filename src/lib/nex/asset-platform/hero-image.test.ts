// Asset Intelligence · HeroImageIntelligence tests.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { overlayFitsInSafeArea, heroSupportsDesignSize } from "./index";
import type { HeroImageIntelligence } from "./index";

function makeHero(): HeroImageIntelligence {
  return {
    asset_id: "loft_ladder_hero_001",
    camera_angle: "wide",
    focal_point: { x_pct: 55, y_pct: 45, confidence: "high", description: "top of ladder against wall" },
    visual_balance: "left_weighted",
    safe_areas: [
      { kind: "cta", region: { x_pct: 4, y_pct: 78, width_pct: 30, height_pct: 18 } },
      { kind: "text", region: { x_pct: 4, y_pct: 6, width_pct: 42, height_pct: 40 } },
      { kind: "contact", region: { x_pct: 60, y_pct: 82, width_pct: 36, height_pct: 14 } },
    ],
    cropping_limits: {
      min_visible_pct: { top: 90, right: 80, bottom: 85, left: 75 },
      never_crop_regions: [{ x_pct: 35, y_pct: 20, width_pct: 40, height_pct: 60 }],
    },
    recommended_layouts: ["premium_trade_banner_v1", "classic_trade_layout_v1"],
    recommended_theme_packs: ["luxury_black_gold", "modern_blue"],
    works_on: ["facebook_feed", "instagram_feed", "web_landing_hero", "print_flyer_a4"],
    avoid_on: ["twitter_header"],
  };
}

describe("HeroImageIntelligence", () => {
  it("overlay in the declared CTA safe area is accepted", () => {
    const hero = makeHero();
    const overlay = { x_pct: 10, y_pct: 82, width_pct: 20, height_pct: 12 };
    expect(overlayFitsInSafeArea(hero, "cta", overlay)).toBe(true);
  });

  it("overlay outside the declared CTA safe area is rejected", () => {
    const hero = makeHero();
    const overlay = { x_pct: 70, y_pct: 82, width_pct: 20, height_pct: 12 };
    expect(overlayFitsInSafeArea(hero, "cta", overlay)).toBe(false);
  });

  it("overlay whose kind has no declared safe area is rejected", () => {
    const hero = makeHero();
    expect(overlayFitsInSafeArea(hero, "badge", { x_pct: 0, y_pct: 0, width_pct: 5, height_pct: 5 })).toBe(false);
  });

  it("works_on is honored", () => {
    const hero = makeHero();
    expect(heroSupportsDesignSize(hero, "facebook_feed")).toBe(true);
    expect(heroSupportsDesignSize(hero, "print_flyer_a4")).toBe(true);
  });

  it("avoid_on takes precedence over works_on", () => {
    const hero = makeHero();
    expect(heroSupportsDesignSize(hero, "twitter_header")).toBe(false);
  });

  it("unlisted size returns false (default deny)", () => {
    const hero = makeHero();
    expect(heroSupportsDesignSize(hero, "app_wallpaper")).toBe(false);
  });
});
