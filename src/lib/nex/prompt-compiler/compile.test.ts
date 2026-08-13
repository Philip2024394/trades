// Prompt Compiler · tests.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { compilePrompt } from "./index";

const DOC = {
  document_id: "doc_001",
  theme_pack: { id: "luxury_burgundy" },
  metadata: {
    hero_product_type: "kitchen",
    timber_profile: "oak",
    marketing_tone: "premium",
    campaign_type: "promotional_offer",
    audience: "family_homeowner",
    layout_family: "premium_trade_banner_v1",
    brand_personality: "luxury",
  },
  scene_graph: { camera: { kind: "marketing" } },
  banner_specification: {
    layout_family: "premium_trade_banner_v1",
    layers: [{ type: "image", href: "https://cdn.example.com/hero_kitchen_oak.png" }],
  },
};

describe("Prompt Compiler", () => {
  it("emits positive prompt containing the design signals", () => {
    const p = compilePrompt(DOC, { target: "diffusion_sdxl" });
    expect(p.positive).toContain("kitchen");
    expect(p.positive).toContain("oak");
    expect(p.positive).toContain("luxury_burgundy");
    expect(p.positive).toContain("family homeowner");
  });

  it("emits luxury-specific negatives (no discount badge · no urgency bar)", () => {
    const p = compilePrompt(DOC, { target: "diffusion_flux" });
    expect(p.negative).toContain("discount badge");
    expect(p.negative).toContain("urgency bar");
    expect(p.negative).toContain("all-caps CTA");
  });

  it("resolves hero image reference from banner_specification image layer", () => {
    const p = compilePrompt(DOC, { target: "diffusion_sdxl" });
    expect(p.reference_images?.length).toBe(1);
    expect(p.reference_images?.[0].role).toBe("hero");
    expect(p.reference_images?.[0].url).toContain("hero_kitchen_oak.png");
  });

  it("seed_policy defaults to deterministic", () => {
    const p = compilePrompt(DOC, { target: "diffusion_sdxl" });
    expect(p.seed_policy).toBe("deterministic");
  });

  it("carries provenance back to the DesignDocument id + theme + layout + camera", () => {
    const p = compilePrompt(DOC, { target: "diffusion_sdxl", aspect_ratio: "1:1", target_size: { width_px: 1080, height_px: 1080 } });
    expect(p.provenance.design_document_id).toBe("doc_001");
    expect(p.provenance.theme_pack).toBe("luxury_burgundy");
    expect(p.provenance.layout_family).toBe("premium_trade_banner_v1");
    expect(p.provenance.camera_profile).toBe("marketing");
    expect(p.provenance.materials).toContain("oak");
  });

  it("honours explicit target size + aspect ratio", () => {
    const p = compilePrompt(DOC, { target: "diffusion_sdxl", aspect_ratio: "9:16", target_size: { width_px: 1080, height_px: 1920 } });
    expect(p.aspect_ratio).toBe("9:16");
    expect(p.target_size?.height_px).toBe(1920);
  });

  it("works across multiple image-model targets (Nex is model-agnostic)", () => {
    for (const target of ["diffusion_sdxl", "diffusion_flux", "transformer_dalle", "flow_matching"] as const) {
      const p = compilePrompt(DOC, { target });
      expect(p.target).toBe(target);
      expect(p.compiler_version).toContain("prompt_compiler");
    }
  });
});
