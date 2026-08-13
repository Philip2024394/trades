// NDIP · Design Document + Render Planner + Render Manifest tests.
// Verifies: BannerDocument specialization · planner wraps a brief · renderer
// accepts either legacy spec or DesignDocument · determinism hash is stable ·
// manifest carries provenance + engine version.
//
// Doctrine: docs/brains/nex-design-intelligence-platform-ndip-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { renderBanner, resolveTheme, bannerToDocument, planRenderDocument, buildRenderManifest, determinismHash, resolveAssets } from "./index";
import type { BannerSpecification, BannerDocument, RenderManifest, RenderedBanner } from "./index";

function makeSpec(): BannerSpecification {
  const theme = resolveTheme("aqua_teal");
  return {
    spec_version: "1.0",
    banner_id: "ndip_test_banner_001",
    template_family: "premium_trade_banner",
    layout_family: "premium_trade_banner_v1",
    brand_personality: "professional",
    cta_architecture: "bottom_right_contact_box",
    theme_pack: theme,
    export: { name: "facebook_feed", width_px: 1200, height_px: 628 },
    metadata: { hero_product_type: "kitchen", timber_profile: "oak" },
    layers: [
      { type: "text", id: "headline", z_index: 10, box: { x: 40, y: 60, width: 560, height: 120 }, text: "NDIP Ready", font_family: theme.fonts.headline, font_weight: 700, font_size_px: 56, color: theme.colors.text_primary, max_lines: 2 },
    ],
  };
}

describe("NDIP · Design Document + Planner + Manifest", () => {
  it("bannerToDocument wraps a BannerSpecification in a BannerDocument", () => {
    const doc = bannerToDocument(makeSpec());
    expect(doc.document_type).toBe("BannerDocument");
    expect(doc.document_version).toBe("1.0");
    expect(doc.scene_graph.objects).toHaveLength(1);
    expect(doc.scene_graph.objects[0].kind).toBe("layer_group");
    expect(doc.banner_specification.banner_id).toBe("ndip_test_banner_001");
  });

  it("planRenderDocument stamps provenance.render_planner_version", () => {
    const doc = planRenderDocument({ brief_kind: "banner", banner_specification: makeSpec(), provenance: { campaign_engine: "Test Campaign" } });
    expect(doc.provenance.render_planner_version).toMatch(/render_planner/);
    expect(doc.provenance.campaign_engine).toBe("Test Campaign");
  });

  it("renderBanner accepts a bare BannerSpecification (legacy path)", () => {
    const r = renderBanner(makeSpec()) as RenderedBanner & { render_manifest: RenderManifest };
    expect(r.format).toBe("svg");
    expect(r.render_manifest).toBeDefined();
    expect(r.render_manifest.document_type).toBe("BannerDocument");
  });

  it("renderBanner accepts a BannerDocument (NDIP path)", () => {
    const doc = planRenderDocument({ brief_kind: "banner", banner_specification: makeSpec() });
    const r = renderBanner(doc) as RenderedBanner & { render_manifest: RenderManifest };
    expect(r.format).toBe("svg");
    expect(r.render_manifest.provenance.render_planner_version).toBeDefined();
  });

  it("determinism hash is stable for identical documents", () => {
    const doc1 = bannerToDocument(makeSpec());
    const doc2 = bannerToDocument(makeSpec());
    const assets = resolveAssets(makeSpec());
    const h1 = determinismHash(doc1, assets, "phase_e0_svg_1.0");
    const h2 = determinismHash(doc2, assets, "phase_e0_svg_1.0");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("determinism hash changes when engine version changes", () => {
    const doc = bannerToDocument(makeSpec());
    const assets = resolveAssets(makeSpec());
    const h1 = determinismHash(doc, assets, "phase_e0_svg_1.0");
    const h2 = determinismHash(doc, assets, "phase_e1_svg_1.0");
    expect(h1).not.toBe(h2);
  });

  it("render manifest carries engine version + theme + fonts", () => {
    const doc = planRenderDocument({ brief_kind: "banner", banner_specification: makeSpec() });
    const assets = resolveAssets(makeSpec());
    const manifest = buildRenderManifest({
      doc,
      assets,
      engineVersion: "phase_e0_svg_1.0",
      renderTimeMs: 12,
      componentsRendered: 1,
      sceneGraphNodes: 1,
      grammarViolations: [],
    });
    expect(manifest.engine_version).toBe("phase_e0_svg_1.0");
    expect(manifest.theme_pack).toBe("aqua_teal");
    expect(manifest.font_set.heading).toBeTruthy();
    expect(manifest.render_id).toMatch(/^rnd_/);
    expect(manifest.determinism_hash).toHaveLength(64);
  });

  it("renderBanner produces a render manifest with grammar_violations passthrough", () => {
    const doc = planRenderDocument({ brief_kind: "banner", banner_specification: makeSpec() });
    const r = renderBanner(doc) as RenderedBanner & { render_manifest: RenderManifest };
    expect(Array.isArray(r.render_manifest.grammar_violations)).toBe(true);
  });

  it("scene graph is present on every BannerDocument", () => {
    const doc: BannerDocument = bannerToDocument(makeSpec());
    expect(doc.scene_graph.camera).toBeDefined();
    expect(doc.scene_graph.lighting).toBeDefined();
    expect(doc.scene_graph.environment).toBeDefined();
    expect(Array.isArray(doc.scene_graph.objects)).toBe(true);
  });
});
