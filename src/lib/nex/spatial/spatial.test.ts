// Spatial Intelligence Platform · tests.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import {
  convertLength, convertArea, convertVolume, convertWeight, convertTemperature, convertAngle,
  withConfidence, bucketConfidence, combineConfidence, listConfidenceLevels,
  measurement, formatMeasurement,
  calibrate, pixelsToMeasurement,
  rectangleArea, boxVolume, staircasePitchDeg,
  MATERIAL_DENSITY_KG_PER_M3, concreteFromSlab, waterTank, paintRequired, tilesRequired,
} from "./index";

describe("Spatial · unit conversions", () => {
  it("converts length units accurately", () => {
    expect(convertLength(1000, "mm", "m")).toBeCloseTo(1);
    expect(convertLength(1, "m", "mm")).toBeCloseTo(1000);
    expect(convertLength(1, "ft", "mm")).toBeCloseTo(304.8);
    expect(convertLength(1, "in", "mm")).toBeCloseTo(25.4);
  });

  it("converts area", () => {
    expect(convertArea(10000, "cm2", "m2")).toBeCloseTo(1);
    expect(convertArea(1, "m2", "mm2")).toBeCloseTo(1_000_000);
  });

  it("converts volume", () => {
    expect(convertVolume(1, "m3", "l")).toBeCloseTo(1000);
    expect(convertVolume(1000, "ml", "l")).toBeCloseTo(1);
  });

  it("converts weight", () => {
    expect(convertWeight(1000, "g", "kg")).toBeCloseTo(1);
    expect(convertWeight(1, "t", "kg")).toBeCloseTo(1000);
    expect(convertWeight(1, "lb", "g")).toBeCloseTo(453.59237);
  });

  it("converts temperature (affine)", () => {
    expect(convertTemperature(0, "C", "F")).toBeCloseTo(32);
    expect(convertTemperature(100, "C", "F")).toBeCloseTo(212);
    expect(convertTemperature(32, "F", "C")).toBeCloseTo(0);
  });

  it("converts angles", () => {
    expect(convertAngle(180, "deg", "rad")).toBeCloseTo(Math.PI);
    expect(convertAngle(Math.PI, "rad", "deg")).toBeCloseTo(180);
  });
});

describe("Spatial · confidence bands", () => {
  it("declares 4 canonical levels", () => {
    expect(listConfidenceLevels()).toEqual(["verified", "calibrated", "estimated", "guess"]);
  });

  it("withConfidence produces the canonical anchor percentage", () => {
    expect(withConfidence("verified").percent).toBe(100);
    expect(withConfidence("calibrated").percent).toBe(96);
    expect(withConfidence("estimated").percent).toBe(82);
    expect(withConfidence("guess").percent).toBe(45);
  });

  it("bucketConfidence buckets to the lower band · never rounds up", () => {
    expect(bucketConfidence(100)).toBe("verified");
    expect(bucketConfidence(99.9)).toBe("calibrated");
    expect(bucketConfidence(89.9)).toBe("estimated");
    expect(bucketConfidence(69.9)).toBe("guess");
    expect(bucketConfidence(0)).toBe("guess");
  });

  it("combineConfidence lowers the band when composing", () => {
    const a = withConfidence("verified");
    const b = withConfidence("estimated");
    const c = combineConfidence(a, b);
    // Verified × Estimated should NOT stay Verified.
    expect(c.level).not.toBe("verified");
    expect(c.percent).toBeLessThanOrEqual(b.percent);
  });
});

describe("Spatial · Measurement + formatting", () => {
  it("formatMeasurement always shows band + percent", () => {
    const m = measurement(900, "mm", "length", withConfidence("calibrated"));
    const text = formatMeasurement(m);
    expect(text).toContain("900");
    expect(text).toContain("mm");
    expect(text).toContain("96%");
    expect(text).toContain("calibrated");
  });
});

describe("Spatial · Calibration", () => {
  it("calibrate produces mm/px from a known reference", () => {
    const cal = calibrate({ reference_object: "standard_uk_door", reference_length_mm: 1981, pixel_length_in_image: 660 });
    expect(cal.mm_per_pixel).toBeCloseTo(3.0015, 3);
    expect(cal.confidence.level).toBe("calibrated");
  });

  it("pixelsToMeasurement converts image pixels into calibrated real-world length", () => {
    const cal = calibrate({ reference_object: "standard_uk_door", reference_length_mm: 762, pixel_length_in_image: 254 });
    const m = pixelsToMeasurement(300, cal, "mm");
    expect(m.value).toBeCloseTo(900, 0);
    expect(m.confidence.level).toBe("calibrated");
  });

  it("rejects a non-positive reference pixel length", () => {
    expect(() => calibrate({ reference_object: "x", reference_length_mm: 762, pixel_length_in_image: 0 })).toThrow();
  });
});

describe("Spatial · Geometry math", () => {
  it("rectangleArea combines confidences", () => {
    const w = measurement(2, "m", "length", withConfidence("verified"));
    const h = measurement(3, "m", "length", withConfidence("calibrated"));
    const area = rectangleArea(w, h);
    expect(area.value).toBeCloseTo(6);
    expect(area.unit).toBe("m2");
    expect(area.confidence.level).not.toBe("verified");
  });

  it("boxVolume returns m³ by default", () => {
    const l = measurement(2, "m", "length", withConfidence("verified"));
    const w = measurement(2, "m", "length", withConfidence("verified"));
    const d = measurement(0.5, "m", "length", withConfidence("verified"));
    expect(boxVolume(l, w, d).value).toBeCloseTo(2);
  });

  it("staircase pitch is 38° for a typical UK stair (2600 rise / 3328 going)", () => {
    const rise = measurement(2600, "mm", "length", withConfidence("verified"));
    const going = measurement(3328, "mm", "length", withConfidence("verified"));
    const p = staircasePitchDeg(rise, going);
    expect(p.degrees).toBeCloseTo(38, 0);
  });
});

describe("Spatial · Construction estimation", () => {
  it("concreteFromSlab returns volume + weight", () => {
    const l = measurement(4, "m", "length", withConfidence("verified"));
    const w = measurement(3, "m", "length", withConfidence("verified"));
    const d = measurement(0.1, "m", "length", withConfidence("verified"));
    const { volume, weight_kg } = concreteFromSlab(l, w, d);
    expect(volume.value).toBeCloseTo(1.2);
    expect(weight_kg.value).toBeCloseTo(2880);
  });

  it("waterTank returns litres + weight-when-full", () => {
    const l = measurement(1, "m", "length", withConfidence("verified"));
    const w = measurement(1, "m", "length", withConfidence("verified"));
    const d = measurement(1, "m", "length", withConfidence("verified"));
    const { litres, weight_full_kg } = waterTank(l, w, d);
    expect(litres.value).toBeCloseTo(1000);
    expect(weight_full_kg.value).toBeCloseTo(1000);
  });

  it("paintRequired subtracts openings and applies coats", () => {
    const wall = measurement(20, "m2", "area", withConfidence("verified"));
    const openings = measurement(4, "m2", "area", withConfidence("verified"));
    // (20-4) / 12 × 2 coats = 2.666... L
    const litres = paintRequired({ wall_area: wall, openings_area: openings, coverage_m2_per_l: 12, coats: 2 });
    expect(litres.value).toBeCloseTo(2.666, 2);
  });

  it("tilesRequired rounds up + applies waste allowance", () => {
    const floor = measurement(10, "m2", "area", withConfidence("verified"));
    // 300x300 mm tile · 10 m² = 111.1 tiles · +10% = 123 · boxes of 12 = 11
    const r = tilesRequired({ floor_area: floor, tile_width_mm: 300, tile_height_mm: 300, cut_allowance_pct: 10, tiles_per_box: 12 });
    expect(r.tiles).toBe(123);
    expect(r.boxes).toBe(11);
  });

  it("material density lookup contains staple construction materials", () => {
    expect(MATERIAL_DENSITY_KG_PER_M3.concrete).toBe(2400);
    expect(MATERIAL_DENSITY_KG_PER_M3.oak).toBe(720);
    expect(MATERIAL_DENSITY_KG_PER_M3.steel).toBe(7850);
  });
});
