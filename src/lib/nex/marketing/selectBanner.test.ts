// Campaign Selection Engine · tests.
//
// Doctrine: docs/brains/nex-campaign-selection-engine-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { selectBanner } from "./selectBanner";

describe("selectBanner · Campaign Selection Engine", () => {
  it("selects a banner for a promotional kitchen campaign targeting family homeowners", () => {
    const r = selectBanner({
      industry: "kitchen",
      audience: "family_homeowner",
      goal: "promotional_offer",
      platform: "facebook",
    });
    expect(r.recommended).not.toBeNull();
    expect(r.candidates_considered).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThan(0.4);
    expect(r.reasoning).toBeTruthy();
  });

  it("selects a luxury banner for executive homeowners", () => {
    const r = selectBanner({
      industry: "kitchen",
      audience: "executive_homeowner",
      goal: "promotional_offer",
      tone: "luxury",
    });
    expect(r.recommended?.brand_personality).toBe("luxury");
  });

  it("selects a sales_event banner for budget renovators", () => {
    const r = selectBanner({
      industry: "kitchen",
      audience: "budget_renovator",
      goal: "promotional_offer",
    });
    expect(r.recommended?.brand_personality).toBe("sales_event");
  });

  it("returns runners_up when multiple candidates exist", () => {
    const r = selectBanner({
      industry: "kitchen",
      audience: "family_homeowner",
      goal: "promotional_offer",
    });
    expect(r.runners_up.length).toBeGreaterThan(0);
  });

  it("applies timber compatibility (oak avoids industrial_orange + premium_purple)", () => {
    const r = selectBanner({
      industry: "kitchen",
      timber: "oak",
      audience: "family_homeowner",
      tone: "professional",
    });
    expect(r.recommended).not.toBeNull();
    const oakAvoid = ["industrial_orange", "premium_purple"];
    if (r.recommended?.theme_pack) {
      expect(oakAvoid).not.toContain(r.recommended.theme_pack);
    }
  });

  it("returns reasoning chain", () => {
    const r = selectBanner({
      industry: "kitchen",
      audience: "executive_homeowner",
      goal: "promotional_offer",
    });
    expect(r.reasoning).toContain("persona_match");
    expect(r.reasoning).toContain("campaign_type");
    expect(r.reasoning).toContain("platform");
  });

  it("handles empty brief safely", () => {
    const r = selectBanner({ industry: "" });
    // Should still return something (fallback to best-matching by default scores).
    expect(r.candidates_considered).toBeGreaterThan(0);
  });
});
