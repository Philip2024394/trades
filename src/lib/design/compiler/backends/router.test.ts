// Model router — surface + hint precedence tests.

import { describe, it, expect } from "vitest";
import { chooseBackend } from "./router";
import type { DesignIR } from "../ir";

function irWithSurface(surface: DesignIR["intent"]["surface"], hint?: string): DesignIR {
  return {
    schema_version: "1.0.0",
    intent: { surface, hints: [], ...(hint ? { model_hint: hint } : {}) },
    trade:  "plumbing",
    brand_snapshot_id: "test",
    layout: { info_groups_max: 3 },
    photography: { photo_urls: [], overlay: false, grain: false },
    typography:  { aesthetic: "modern", primary_family: "Inter", secondary_family: "Inter" },
    colour: {
      primary: "#000", secondary: "#FFF", accent: "#FFB300",
      split_pct: { body: 75, graphics: 20, accent: 5 }
    },
    constraints: [],
    outputs:     [{ kind: "side", width_px: 1600, height_px: 900, quality: "medium" }],
    memory_hints: [],
    business:    { name: "Test", tagline: "", phone: "", website: "", services: [] }
  } as unknown as DesignIR;
}

describe("Model router", () => {
  it("routes vehicle → gpt-image-1", () => {
    expect(chooseBackend(irWithSurface("vehicle")).backend).toBe("gpt-image-1");
  });

  it("routes logo → ideogram-v3", () => {
    expect(chooseBackend(irWithSurface("logo")).backend).toBe("ideogram-v3");
  });

  it("routes business-card → ideogram-v3", () => {
    expect(chooseBackend(irWithSurface("business-card")).backend).toBe("ideogram-v3");
  });

  it("routes signage → recraft-v3", () => {
    expect(chooseBackend(irWithSurface("signage")).backend).toBe("recraft-v3");
  });

  it("routes invoice → recraft-v3", () => {
    expect(chooseBackend(irWithSurface("invoice")).backend).toBe("recraft-v3");
  });

  it("honours explicit model_hint override", () => {
    const decision = chooseBackend(irWithSurface("vehicle", "recraft-v3"));
    expect(decision.backend).toBe("recraft-v3");
    expect(decision.reason).toContain("hint");
  });

  it("workwear fallback → gpt-image-1", () => {
    expect(chooseBackend(irWithSurface("workwear")).backend).toBe("gpt-image-1");
  });
});
