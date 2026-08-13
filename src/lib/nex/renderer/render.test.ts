// Pixel Rendering Engine · smoke tests for Phase E.0 SVG output.
//
// Doctrine: docs/brains/nex-pixel-rendering-engine-phase-e0-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { renderBanner, resolveTheme, resolveAssets, validateGrammar } from "./index";
import type { BannerSpecification } from "./index";

function makeSpec(overrides?: Partial<BannerSpecification>): BannerSpecification {
  const theme = resolveTheme("aqua_teal");
  const base: BannerSpecification = {
    spec_version: "1.0",
    banner_id: "test_banner_001",
    template_family: "premium_trade_banner",
    layout_family: "premium_trade_banner_v1",
    brand_personality: "professional",
    cta_architecture: "bottom_right_contact_box",
    theme_pack: theme,
    export: { name: "facebook_feed", width_px: 1200, height_px: 628 },
    metadata: {
      hero_product_type: "kitchen",
      timber_profile: "oak",
      marketing_tone: "professional",
      campaign_type: "promotional_offer",
      audience: "family_homeowner",
    },
    layers: [
      { type: "text", id: "headline", z_index: 10, box: { x: 40, y: 60, width: 560, height: 120 }, text: "Kitchen Mania", font_family: theme.fonts.headline, font_weight: 700, font_size_px: 56, color: theme.colors.text_primary, max_lines: 2, transform: "uppercase" },
      { type: "text", id: "subheadline", z_index: 10, box: { x: 40, y: 200, width: 560, height: 60 }, text: "Prices just dropped this week.", font_family: theme.fonts.subheadline, font_weight: 500, font_size_px: 22, color: theme.colors.text_primary, max_lines: 2 },
      { type: "feature_list", id: "features", z_index: 10, box: { x: 40, y: 280, width: 560, height: 200 }, items: [{ icon: "check", label: "Modern Designs" }, { icon: "check", label: "Quality Materials" }, { icon: "check", label: "Made To Measure" }, { icon: "check", label: "Professional Fitting" }], font_family: theme.fonts.body, font_size_px: 18, color: theme.colors.text_primary, icon_size_px: 20, spacing_px: 8 },
      { type: "image", id: "hero", z_index: 5, box: { x: 640, y: 40, width: 520, height: 460 }, href: "https://example.com/hero.png", alt: "Kitchen hero" },
      { type: "text", id: "cta", z_index: 20, box: { x: 40, y: 520, width: 260, height: 60 }, text: "Get Quote", font_family: theme.fonts.cta, font_weight: 700, font_size_px: 20, color: theme.colors.text_primary, text_align: "center" },
      { type: "contact_box", id: "contact", z_index: 20, box: { x: 640, y: 520, width: 520, height: 80 }, contacts: [{ kind: "phone", value: "07700 123456" }, { kind: "website", value: "www.example.co.uk" }], background: theme.colors.cta_background, text_color: theme.colors.cta_text, font_family: theme.fonts.body, corner_radius: theme.radius.contact_box, alignment: "center", max_lines: 2 },
    ],
  };
  return { ...base, ...overrides };
}

describe("Pixel Rendering Engine · Phase E.0", () => {
  it("resolves an existing theme_pack", () => {
    const t = resolveTheme("luxury_burgundy");
    expect(t.id).toBe("luxury_burgundy");
    expect(t.colors.primary).toMatch(/^#/);
    expect(t.fonts.headline).toBeTruthy();
  });

  it("falls back to minimal_white for unknown theme", () => {
    const t = resolveTheme("nonexistent");
    expect(t.id).toBe("minimal_white");
  });

  it("renders a valid SVG string with correct dimensions", () => {
    const spec = makeSpec();
    const r = renderBanner(spec);
    expect(r.format).toBe("svg");
    expect(r.content).toContain("<svg");
    expect(r.content).toContain("</svg>");
    expect(r.content).toContain(`width="${spec.export.width_px}"`);
    expect(r.content).toContain(`height="${spec.export.height_px}"`);
    expect(r.width_px).toBe(1200);
    expect(r.height_px).toBe(628);
  });

  it("renders every declared layer", () => {
    const spec = makeSpec();
    const r = renderBanner(spec);
    expect(r.performance.layers_rendered).toBe(spec.layers.length);
    for (const layer of spec.layers) {
      expect(r.component_positions).toHaveProperty(layer.id);
    }
  });

  it("respects z_index ordering (background rendered before hero)", () => {
    const spec = makeSpec();
    const r = renderBanner(spec);
    // Hero (z=5) should appear BEFORE headline (z=10) in the SVG string
    const heroIndex = r.content.indexOf("hero.png");
    const headlineIndex = r.content.indexOf("KITCHEN MANIA");
    expect(heroIndex).toBeGreaterThan(0);
    expect(headlineIndex).toBeGreaterThan(heroIndex);
  });

  it("resolves assets from the manifest", () => {
    const spec = makeSpec();
    const assets = resolveAssets(spec);
    expect(assets.cache_key).toHaveLength(16);
    expect(assets.icon_bundle_id).toBeTruthy();
  });

  it("validates grammar and returns violations", () => {
    const spec = makeSpec({ brand_personality: "luxury" });
    // Luxury forbids CTA with all-caps · our CTA is not uppercase so no violation
    // But luxury allows max 8 headline words · our headline "Kitchen Mania" = 2 words · ok
    const violations = validateGrammar(spec);
    expect(Array.isArray(violations)).toBe(true);
  });

  it("flags a grammar violation when a luxury banner has an all-caps CTA", () => {
    const spec = makeSpec({
      brand_personality: "luxury",
      layers: [
        { type: "text", id: "cta", z_index: 20, box: { x: 40, y: 520, width: 260, height: 60 }, text: "BUY NOW TODAY", font_family: "Montserrat", font_weight: 700, font_size_px: 20, color: "#000", text_align: "center", transform: "uppercase" },
      ] as BannerSpecification["layers"],
    });
    const violations = validateGrammar(spec);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.rule.includes("forbid_all_caps_cta"))).toBe(true);
  });

  it("returns a stable spec_hash for identical specs", () => {
    const s1 = makeSpec();
    const s2 = makeSpec();
    const r1 = renderBanner(s1);
    const r2 = renderBanner(s2);
    expect(r1.spec_hash).toBe(r2.spec_hash);
  });

  it("populates render_log with trace", () => {
    const spec = makeSpec();
    const r = renderBanner(spec);
    expect(r.render_log.length).toBeGreaterThan(0);
    expect(r.render_log.some((l) => l.includes("theme_pack"))).toBe(true);
  });

  it("renders performance metrics", () => {
    const spec = makeSpec();
    const r = renderBanner(spec);
    expect(r.performance.render_ms).toBeGreaterThanOrEqual(0);
    expect(r.performance.layers_rendered).toBeGreaterThan(0);
  });
});
