// Lighting Simulator · public exports.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

export { computeSunAltitude, computeSceneMood } from "./simulate";
export type {
  SunPosition, WindowGeometry, ReflectivityMap, LEDStrip, SpotlightFixture,
  SceneLightingBudget, SceneMoodResult, CompassDirection,
} from "./types";
