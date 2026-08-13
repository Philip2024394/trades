// Spatial Intelligence Platform · public exports.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

export {
  convertLength, convertArea, convertVolume, convertWeight, convertLiquid,
  convertPressure, convertAngle, convertTemperature, listUnitsForSystem,
} from "./units";
export type {
  LengthUnit, AreaUnit, VolumeUnit, WeightUnit, LiquidUnit,
  PressureUnit, TemperatureUnit, AngleUnit, UnitSystem,
} from "./units";

export {
  withConfidence, bucketConfidence, labelOf, combineConfidence, listConfidenceLevels,
} from "./confidence";
export type { Confidence, ConfidenceLevel } from "./confidence";

export { measurement, formatMeasurement } from "./measurement";
export type { Measurement } from "./measurement";

export { calibrate, pixelsToMeasurement } from "./calibration";
export type { CalibrationReference, CalibrationResult } from "./calibration";

export { rectangleArea, boxVolume, staircasePitchDeg, agreesWithin } from "./geometry";

export {
  MATERIAL_DENSITY_KG_PER_M3, concreteFromSlab, waterTank, timberWeight,
  paintRequired, tilesRequired,
} from "./estimation";

export { totalCost, totalLineItems } from "./bill-of-materials";
export type { BOMLineItem, BillOfMaterials } from "./bill-of-materials";
