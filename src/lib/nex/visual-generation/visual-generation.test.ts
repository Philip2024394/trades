// src/lib/nex/visual-generation/visual-generation.test.ts

import { describe, it, expect } from "vitest";
import { VisualGenerationLayer } from "./index";

const goodRequest = (overrides: any = {}) => ({
  kind: "image" as const,
  prompt: "a test image",
  widthPx: 512,
  heightPx: 512,
  transparent: false,
  requestedBy: "founder-sig",
  targetCapabilityId: "CAP-091",
  artefactStorageHint: "test-only" as const,
  ...overrides,
});

describe("VisualGenerationLayer · fail-closed default", () => {
  it("generate() returns sec.visual_gen_provider_not_bound when no provider bound", () => {
    const layer = new VisualGenerationLayer();
    const r = layer.generate(goodRequest());
    expect((r as any).ok).toBe(false);
    if ((r as any).ok === false) {
      expect((r as any).code).toBe("sec.visual_gen_provider_not_bound");
    }
  });

  it("isBoundFor returns false for any kind on empty layer", () => {
    const layer = new VisualGenerationLayer();
    expect(layer.isBoundFor("image")).toBe(false);
    expect(layer.isBoundFor("pixel")).toBe(false);
    expect(layer.isBoundFor("animation")).toBe(false);
  });
});

describe("VisualGenerationLayer · bindProvider validation", () => {
  it("rejects missing name", () => {
    const layer = new VisualGenerationLayer();
    const r = layer.bindProvider({
      name: "",
      kinds: ["image"],
      boundBy: "founder-sig",
      boundAt: "t",
      measurableProof: "path/to/proof.png",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.visual_gen_bind_missing_name");
  });

  it("rejects missing signature", () => {
    const layer = new VisualGenerationLayer();
    const r = layer.bindProvider({
      name: "Provider-X",
      kinds: ["image"],
      boundBy: "",
      boundAt: "t",
      measurableProof: "x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.visual_gen_bind_missing_signature");
  });

  it("rejects missing measurable proof", () => {
    const layer = new VisualGenerationLayer();
    const r = layer.bindProvider({
      name: "Provider-X",
      kinds: ["image"],
      boundBy: "founder-sig",
      boundAt: "t",
      measurableProof: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.visual_gen_bind_missing_proof");
  });

  it("rejects empty kinds", () => {
    const layer = new VisualGenerationLayer();
    const r = layer.bindProvider({
      name: "Provider-X",
      kinds: [],
      boundBy: "founder-sig",
      boundAt: "t",
      measurableProof: "x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.visual_gen_bind_missing_kinds");
  });
});

describe("VisualGenerationLayer · after binding", () => {
  it("isBoundFor returns true for bound kind", () => {
    const layer = new VisualGenerationLayer();
    layer.bindProvider({
      name: "Provider-X",
      kinds: ["image"],
      boundBy: "founder-sig",
      boundAt: "t",
      measurableProof: "path/to/proof.png",
    });
    expect(layer.isBoundFor("image")).toBe(true);
    expect(layer.isBoundFor("animation")).toBe(false);
  });

  it("generate returns placeholder result for bound kind", () => {
    const layer = new VisualGenerationLayer();
    layer.bindProvider({
      name: "Provider-X",
      kinds: ["image"],
      boundBy: "founder-sig",
      boundAt: "t",
      measurableProof: "path/to/proof.png",
    });
    const r = layer.generate(goodRequest());
    expect((r as any).ok).toBe(true);
    if ((r as any).ok === true) {
      expect((r as any).result.kind).toBe("image");
      expect((r as any).result.providerBoundName).toBe("Provider-X");
    }
  });

  it("rejects request for unbound kind even after binding another", () => {
    const layer = new VisualGenerationLayer();
    layer.bindProvider({
      name: "Provider-X",
      kinds: ["image"],
      boundBy: "founder-sig",
      boundAt: "t",
      measurableProof: "path/to/proof.png",
    });
    const r = layer.generate(goodRequest({ kind: "animation" }));
    expect((r as any).ok).toBe(false);
    if ((r as any).ok === false) {
      expect((r as any).code).toBe("sec.visual_gen_provider_not_bound");
    }
  });

  it("rejects zero dimensions", () => {
    const layer = new VisualGenerationLayer();
    layer.bindProvider({
      name: "P",
      kinds: ["image"],
      boundBy: "sig",
      boundAt: "t",
      measurableProof: "x",
    });
    const r = layer.generate(goodRequest({ widthPx: 0 }));
    expect((r as any).ok).toBe(false);
    if ((r as any).ok === false) expect((r as any).code).toBe("sec.visual_gen_bad_dimensions");
  });
});
