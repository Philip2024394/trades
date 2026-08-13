// Campaign Family · tests.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import { planCampaign, get, updateOutput, count, clear, DEFAULT_DOMESTIC_FAN_OUT } from "./index";

beforeEach(() => clear());

describe("Campaign Family", () => {
  it("planCampaign produces default fan-out with planned status", () => {
    const c = planCampaign({
      campaign_id: "loft_ladder_premium_2026",
      display_name: "Loft Ladder Premium Autumn 2026",
      base_design_document_id: "doc_loft_ladder_001",
      product_family: "loft_ladders",
      audience: "luxury_homeowner",
      brand_archetype: "premium",
      theme_pack: "industrial_black_gold",
      pattern_id: "PREMIUM_TRADE_BANNER_V1",
    });
    expect(c.outputs.length).toBe(DEFAULT_DOMESTIC_FAN_OUT.length);
    expect(c.outputs.every((o) => o.status === "planned")).toBe(true);
    expect(c.outputs.every((o) => o.pattern_id === "PREMIUM_TRADE_BANNER_V1")).toBe(true);
    expect(count()).toBe(1);
  });

  it("planCampaign accepts custom channels", () => {
    const c = planCampaign({
      campaign_id: "loft_ladder_trade_2026",
      display_name: "Loft Ladder Trade Focus",
      base_design_document_id: "doc_loft_003",
      product_family: "loft_ladders",
      audience: "builder_trade",
      brand_archetype: "industrial",
      theme_pack: "industrial_black_red",
      channels: [
        { channel: "facebook_feed", design_size_id: "facebook_feed" },
        { channel: "trade_show_banner", design_size_id: "print_rollup_banner" },
      ],
    });
    expect(c.outputs).toHaveLength(2);
    expect(c.outputs[1].channel).toBe("trade_show_banner");
  });

  it("updateOutput mutates a channel's status + asset_id", () => {
    planCampaign({ campaign_id: "c1", display_name: "c", base_design_document_id: "d", product_family: "loft_ladders", audience: "modern_family", brand_archetype: "family", theme_pack: "nature_green" });
    const updated = updateOutput("c1", "instagram_feed", { status: "generated", asset_id: "asset_generated_001" });
    const ig = updated.outputs.find((o) => o.channel === "instagram_feed");
    expect(ig?.status).toBe("generated");
    expect(ig?.asset_id).toBe("asset_generated_001");
  });

  it("register rejects duplicates", () => {
    planCampaign({ campaign_id: "dup", display_name: "d", base_design_document_id: "b", product_family: "loft_ladders", audience: "x", brand_archetype: "modern", theme_pack: "modern_blue" });
    expect(() => planCampaign({ campaign_id: "dup", display_name: "d", base_design_document_id: "b", product_family: "loft_ladders", audience: "x", brand_archetype: "modern", theme_pack: "modern_blue" })).toThrow(/already registered/);
  });

  it("DEFAULT_DOMESTIC_FAN_OUT covers social + web + email + print + google business", () => {
    const channels = DEFAULT_DOMESTIC_FAN_OUT.map((c) => c.channel);
    expect(channels).toContain("facebook_feed");
    expect(channels).toContain("instagram_feed");
    expect(channels).toContain("linkedin_post");
    expect(channels).toContain("web_landing_hero");
    expect(channels).toContain("email_header");
    expect(channels).toContain("print_flyer_a4");
    expect(channels).toContain("print_business_card");
    expect(channels).toContain("google_business");
  });

  it("Every campaign carries Rule-c provenance", () => {
    const c = planCampaign({ campaign_id: "prov", display_name: "d", base_design_document_id: "b", product_family: "loft_ladders", audience: "x", brand_archetype: "modern", theme_pack: "modern_blue" });
    expect(c.provenance.named_expert).toBe("Philip O'Farrell");
  });
});
