// Spatial Intelligence · geometry mathematics (area · volume · staircase pitch).
//
// Pure functions · unit-aware · confidence propagated.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import { convertLength, convertArea, convertVolume, type LengthUnit, type AreaUnit, type VolumeUnit } from "./units";
import { combineConfidence, withConfidence, type Confidence } from "./confidence";
import type { Measurement } from "./measurement";
import { measurement } from "./measurement";

/** Rectangle area · returns m² by default with combined confidence. */
export function rectangleArea(width: Measurement, height: Measurement, resultUnit: AreaUnit = "m2"): Measurement {
  if (width.system !== "length" || height.system !== "length") throw new Error("rectangleArea requires two length measurements");
  const w_mm = convertLength(width.value, width.unit as LengthUnit, "mm");
  const h_mm = convertLength(height.value, height.unit as LengthUnit, "mm");
  const area_mm2 = w_mm * h_mm;
  const value = convertArea(area_mm2, "mm2", resultUnit);
  return measurement(value, resultUnit, "area", combineConfidence(width.confidence, height.confidence), "derived: rectangleArea");
}

/** Box volume · returns m³ by default with combined confidence. */
export function boxVolume(length: Measurement, width: Measurement, depth: Measurement, resultUnit: VolumeUnit = "m3"): Measurement {
  const all = [length, width, depth];
  if (all.some((m) => m.system !== "length")) throw new Error("boxVolume requires three length measurements");
  const l_mm = convertLength(length.value, length.unit as LengthUnit, "mm");
  const w_mm = convertLength(width.value, width.unit as LengthUnit, "mm");
  const d_mm = convertLength(depth.value, depth.unit as LengthUnit, "mm");
  const vol_mm3 = l_mm * w_mm * d_mm;
  const value = convertVolume(vol_mm3, "mm3", resultUnit);
  const c = combineConfidence(combineConfidence(length.confidence, width.confidence), depth.confidence);
  return measurement(value, resultUnit, "volume", c, "derived: boxVolume");
}

/** Staircase pitch in degrees from total rise + total going. */
export function staircasePitchDeg(totalRise: Measurement, totalGoing: Measurement): { degrees: number; confidence: Confidence } {
  const rise_mm = convertLength(totalRise.value, totalRise.unit as LengthUnit, "mm");
  const going_mm = convertLength(totalGoing.value, totalGoing.unit as LengthUnit, "mm");
  if (going_mm <= 0) throw new Error("total going must be positive");
  const rad = Math.atan(rise_mm / going_mm);
  return {
    degrees: (rad * 180) / Math.PI,
    confidence: combineConfidence(totalRise.confidence, totalGoing.confidence),
  };
}

/** Round-trip helper · confirm two length measurements agree within tolerance mm. */
export function agreesWithin(a: Measurement, b: Measurement, tolerance_mm: number): boolean {
  const a_mm = convertLength(a.value, a.unit as LengthUnit, "mm");
  const b_mm = convertLength(b.value, b.unit as LengthUnit, "mm");
  return Math.abs(a_mm - b_mm) <= tolerance_mm;
}

export { withConfidence };
