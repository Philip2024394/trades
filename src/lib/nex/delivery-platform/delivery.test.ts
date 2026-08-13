// Delivery Platform · tests.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import { resetToDefaults, list, shippedFormats, get, deliver, register, unregister, isRegistered } from "./index";

beforeEach(() => resetToDefaults());

describe("Delivery Platform · registry", () => {
  it("seedDefaults registers 20 exporters (SVG + 19 stubs)", () => {
    expect(list().length).toBe(20);
  });

  it("SVG is the only shipped format initially", () => {
    expect(shippedFormats()).toEqual(["svg"]);
  });

  it("get(format) returns the registered exporter", () => {
    expect(get("svg")?.status).toBe("shipped");
    expect(get("png")?.status).toBe("stub");
  });

  it("deliver('svg', ...) returns a DeliveryResult with text + metadata", async () => {
    const doc = { svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"/>", width_px: 10, height_px: 10 };
    const result = await deliver("svg", doc);
    expect(result.format).toBe("svg");
    expect(result.text).toContain("<svg");
    expect(result.metadata.width_px).toBe(10);
  });

  it("stub exporters throw with a clear phase-not-yet-shipped message", async () => {
    await expect(deliver("png", {})).rejects.toThrow(/stub · shipped in a later Phase/);
  });

  it("registering an unknown format throws when delivered", async () => {
    await expect(deliver("figma" as never, {})).rejects.toThrow(/stub/);
    // Now unregister figma · deliver should say 'No exporter registered'
    unregister("figma");
    await expect(deliver("figma" as never, {})).rejects.toThrow(/No exporter registered/);
  });

  it("re-registering a format REPLACES the prior entry (idempotent · phased upgrade path)", async () => {
    // Upgrade PNG from stub → shipped
    register({
      format: "png",
      status: "shipped",
      supported_targets: ["render2D"],
      exporter_version: "test_png_shipped_1.0",
      async export() {
        return { format: "png", bytes: new Uint8Array([137, 80, 78, 71]), metadata: {}, generated_at: new Date().toISOString(), exporter_version: "test_png_shipped_1.0" };
      },
    });
    expect(get("png")?.status).toBe("shipped");
    const result = await deliver("png", {});
    expect(result.bytes?.length).toBe(4);
  });

  it("isRegistered returns true for all default formats", () => {
    for (const f of ["svg", "png", "pdf", "gltf", "usdz", "html"] as const) {
      expect(isRegistered(f)).toBe(true);
    }
  });

  it("every registered exporter carries an exporter_version", () => {
    for (const e of list()) expect(e.exporter_version).toBeTruthy();
  });
});
