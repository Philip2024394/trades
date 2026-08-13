// Lighting Simulator · MVP simulator.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import type { SunPosition, SceneLightingBudget, SceneMoodResult, WindowGeometry } from "./types";

/** Trivial approximate sun altitude given time of day (used in absence of an
 *  ephemeris lookup). Nex domain packs replace this with a real ephemeris. */
export function computeSunAltitude(time: SunPosition["time_of_day"]): number {
  switch (time) {
    case "dawn": return 8;
    case "morning": return 35;
    case "noon": return 60;
    case "afternoon": return 45;
    case "dusk": return 5;
    case "evening": case "night": return -5;
  }
}

/** Approximate sunlight lumens through a window per m². */
function daylightPerM2(sunAltitudeDeg: number, glazingTransmission: number, facing: WindowGeometry["facing"]): number {
  if (sunAltitudeDeg <= 0) return 0;
  const base = Math.sin((sunAltitudeDeg * Math.PI) / 180) * 10000;   // clear-sky-ish · lumens/m²
  const facingBonus = facing === "S" ? 1.0 : facing === "SE" || facing === "SW" ? 0.85 : facing === "E" || facing === "W" ? 0.65 : 0.45;
  return base * glazingTransmission * facingBonus;
}

function windowLumens(w: WindowGeometry, sunAltitudeDeg: number): number {
  const area_m2 = (w.width_mm * w.height_mm) / 1_000_000;
  const t = w.transmission ?? (w.glazing === "triple" ? 0.7 : w.glazing === "double" ? 0.75 : w.glazing === "low_e" ? 0.72 : 0.9);
  return daylightPerM2(sunAltitudeDeg, t, w.facing) * area_m2;
}

/** Weighted mean colour temperature across sources. */
function weightedCT(entries: readonly { lumens: number; k: number }[]): number {
  const total = entries.reduce((s, e) => s + e.lumens, 0);
  if (total === 0) return 4000;
  return Math.round(entries.reduce((s, e) => s + e.lumens * e.k, 0) / total);
}

export function computeSceneMood(budget: SceneLightingBudget, sun: SunPosition): SceneMoodResult {
  const sunAlt = computeSunAltitude(sun.time_of_day);
  const dayLumens = budget.daylight_windows.reduce((s, w) => s + windowLumens(w, sunAlt), 0);
  const ledLumens = budget.leds.reduce((s, l) => s + (l.length_mm / 1000) * l.lumens_per_m, 0);
  const spotLumens = budget.spotlights.reduce((s, sp) => s + sp.lumens, 0);
  const totalLumens = dayLumens + ledLumens + spotLumens;

  const dayCT = 6500;                              // approx daylight
  const ledCT = budget.leds.length ? weightedCT(budget.leds.map((l) => ({ lumens: (l.length_mm / 1000) * l.lumens_per_m, k: l.colour_temperature_k }))) : 4000;
  const spotCT = budget.spotlights.length ? weightedCT(budget.spotlights.map((s) => ({ lumens: s.lumens, k: s.colour_temperature_k }))) : 4000;
  const effective_CT = weightedCT([{ lumens: dayLumens, k: dayCT }, { lumens: ledLumens, k: ledCT }, { lumens: spotLumens, k: spotCT }]);

  const daylight_share = totalLumens > 0 ? dayLumens / totalLumens : 0;
  const led_share = totalLumens > 0 ? ledLumens / totalLumens : 0;
  const spot_share = totalLumens > 0 ? spotLumens / totalLumens : 0;

  // Softness proxy: more bounce (higher wall/ceiling reflectivity) + wider daylight share = softer.
  const bounce = (budget.ambient_bounce.walls_pct + budget.ambient_bounce.ceiling_pct + budget.ambient_bounce.floor_pct) / 3;
  const shadow_softness = Math.max(0, Math.min(1, 0.4 + 0.4 * daylight_share + 0.2 * bounce - 0.3 * spot_share));

  // Rough lux estimate: assume ~30 m² area for MVP proxy.
  const overall_lux_estimate = Math.round((totalLumens * (0.4 + 0.4 * bounce)) / 30);

  let mood: SceneMoodResult["mood"];
  if (effective_CT <= 2800 && spot_share > 0.4) mood = "moody_focused";
  else if (effective_CT <= 3200 && daylight_share < 0.3) mood = "warm_cocoon";
  else if (effective_CT >= 5000 && daylight_share > 0.4) mood = "airy_daylit";
  else if (effective_CT >= 4500 && spot_share > 0.5) mood = "clinical";
  else mood = "balanced";

  return {
    effective_colour_temperature_k: effective_CT,
    daylight_share: Math.round(daylight_share * 100) / 100,
    led_share: Math.round(led_share * 100) / 100,
    spot_share: Math.round(spot_share * 100) / 100,
    shadow_softness: Math.round(shadow_softness * 100) / 100,
    overall_lux_estimate,
    mood,
  };
}
