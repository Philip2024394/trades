// Spatial Intelligence · image calibration.
//
// User uploads a photo → Nex asks for one known real-world measurement in the
// frame (e.g. a standard 762mm door · a 900mm staircase width) → that becomes
// the calibration reference → every derived measurement is Calibrated (96%).
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import { convertLength, type LengthUnit } from "./units";
import { withConfidence, type Confidence } from "./confidence";
import type { Measurement } from "./measurement";
import { measurement } from "./measurement";

export type CalibrationReference = {
  reference_object: string;              // e.g. "standard_uk_door"
  reference_length_mm: number;
  pixel_length_in_image: number;
};

export type CalibrationResult = {
  mm_per_pixel: number;
  confidence: Confidence;
  reference: CalibrationReference;
};

export function calibrate(ref: CalibrationReference): CalibrationResult {
  if (ref.pixel_length_in_image <= 0) throw new Error("pixel_length_in_image must be positive");
  return {
    mm_per_pixel: ref.reference_length_mm / ref.pixel_length_in_image,
    confidence: withConfidence("calibrated", `one known ${ref.reference_length_mm}mm reference (${ref.reference_object}) in the image`),
    reference: ref,
  };
}

/** Convert a pixel length in the image into a real-world Measurement. */
export function pixelsToMeasurement(pixels: number, calibration: CalibrationResult, targetUnit: LengthUnit = "mm"): Measurement {
  const mm = pixels * calibration.mm_per_pixel;
  const value = convertLength(mm, "mm", targetUnit);
  return measurement(value, targetUnit, "length", calibration.confidence, `calibrated pixels=${pixels}`);
}
