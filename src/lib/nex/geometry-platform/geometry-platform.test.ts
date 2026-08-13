// Geometry Platform · tests for GeometryObject helpers + camera/lighting/render-target catalogs.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import {
  boundingBoxSize, boundingBoxVolume,
  resolveCamera, listCameraProfiles,
  resolveLighting, listLightingProfiles,
  resolveRenderTarget, listRenderTargets, shippedRenderTargets,
} from "./index";

describe("Geometry · GeometryObject helpers", () => {
  it("boundingBoxSize returns w/h/d", () => {
    expect(boundingBoxSize({ min: [0, 0, 0], max: [100, 200, 300] })).toEqual([100, 200, 300]);
  });

  it("boundingBoxVolume returns product of dimensions", () => {
    expect(boundingBoxVolume({ min: [0, 0, 0], max: [10, 20, 30] })).toBe(6000);
  });

  it("negative extents are clamped to zero volume", () => {
    expect(boundingBoxVolume({ min: [10, 0, 0], max: [5, 20, 30] })).toBe(0);
  });
});

describe("Geometry · Camera profiles", () => {
  it("lists all 10 profiles", () => {
    expect(listCameraProfiles()).toHaveLength(10);
  });

  it("floorplan camera is orthographic top-down", () => {
    const c = resolveCamera("floorplan");
    expect(c.projection).toBe("orthographic");
    expect(c.position[1]).toBeGreaterThan(0);
  });

  it("marketing camera uses a 35mm-ish focal length", () => {
    const c = resolveCamera("marketing");
    expect(c.projection).toBe("perspective");
    expect(c.focal_length_mm).toBe(35);
  });
});

describe("Geometry · Lighting profiles", () => {
  it("lists all 8 profiles", () => {
    expect(listLightingProfiles()).toHaveLength(8);
  });

  it("luxury_warm uses a warm (~2700K) key", () => {
    const l = resolveLighting("luxury_warm");
    expect(l.key_light.temperature_k).toBe(2700);
  });

  it("night_leds has low ambient + rim_light emphasis", () => {
    const l = resolveLighting("night_leds");
    expect(l.ambient_intensity).toBeLessThan(0.2);
    expect(l.rim_light).toBeDefined();
  });
});

describe("Geometry · Render Targets", () => {
  it("lists all 12 render targets", () => {
    expect(listRenderTargets().length).toBeGreaterThanOrEqual(12);
  });

  it("SVG render target is shipped (Phase E.0)", () => {
    const svg = resolveRenderTarget("renderSVG");
    expect(svg.status).toBe("shipped");
    expect(svg.ships_in_phase).toBe("E.0");
  });

  it("shippedRenderTargets returns SVG at minimum", () => {
    const s = shippedRenderTargets();
    expect(s.some((t) => t.id === "renderSVG")).toBe(true);
  });

  it("3D render target outputs glTF/USD/USDZ (not a bespoke renderer)", () => {
    const r3d = resolveRenderTarget("render3D");
    expect(r3d.output_formats).toContain("glTF");
    expect(r3d.output_formats).toContain("USDZ");
  });
});
