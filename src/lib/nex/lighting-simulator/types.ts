// Lighting Simulator · types.
//
// Extends the Geometry Platform's LightingObject profiles with SIMULATED
// scene-level properties: sun position · window geometry · reflectivity map ·
// scene lighting budget · scene mood scoring.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

export type CompassDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export type SunPosition = {
  altitude_deg: number;                  // 0 = horizon · 90 = zenith
  azimuth_deg: number;                   // 0 = North · 90 = East · 180 = South · 270 = West
  time_of_day: "dawn" | "morning" | "noon" | "afternoon" | "dusk" | "evening" | "night";
  season?: "winter" | "spring" | "summer" | "autumn";
  latitude_deg?: number;
};

export type WindowGeometry = {
  window_id: string;
  facing: CompassDirection;
  width_mm: number;
  height_mm: number;
  sill_height_mm: number;
  glazing?: "single" | "double" | "triple" | "low_e";
  transmission?: number;                 // 0..1 · light transmitted through glass
};

export type ReflectivityMap = {
  walls_pct: number;                     // 0..1
  ceiling_pct: number;
  floor_pct: number;
};

export type LEDStrip = {
  id: string;
  length_mm: number;
  colour_temperature_k: number;          // e.g. 2700
  lumens_per_m: number;                  // e.g. 800
};

export type SpotlightFixture = {
  id: string;
  colour_temperature_k: number;
  beam_angle_deg: number;
  lumens: number;
};

export type SceneLightingBudget = {
  daylight_windows: readonly WindowGeometry[];
  leds: readonly LEDStrip[];
  spotlights: readonly SpotlightFixture[];
  ambient_bounce: ReflectivityMap;
  target_lux_at_bench: number;           // e.g. 300 for kitchen worktop
};

export type SceneMoodResult = {
  effective_colour_temperature_k: number;
  daylight_share: number;                // 0..1 · daylight lumens / total lumens
  led_share: number;
  spot_share: number;
  shadow_softness: number;               // 0..1 · higher = softer (bigger sources · more bounce)
  overall_lux_estimate: number;
  mood: "warm_cocoon" | "airy_daylit" | "moody_focused" | "clinical" | "balanced";
};
