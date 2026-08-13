// Lighting Simulator · tests.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { computeSceneMood, computeSunAltitude } from "./index";
import type { SceneLightingBudget, SunPosition } from "./index";

const REFL = { walls_pct: 0.6, ceiling_pct: 0.7, floor_pct: 0.4 };

function budget(overrides?: Partial<SceneLightingBudget>): SceneLightingBudget {
  return {
    daylight_windows: [],
    leds: [],
    spotlights: [],
    ambient_bounce: REFL,
    target_lux_at_bench: 300,
    ...overrides,
  };
}

describe("Lighting Simulator", () => {
  it("computeSunAltitude returns higher altitude at noon than dawn", () => {
    expect(computeSunAltitude("noon")).toBeGreaterThan(computeSunAltitude("dawn"));
    expect(computeSunAltitude("night")).toBeLessThanOrEqual(0);
  });

  it("scene with only warm LEDs at night produces warm_cocoon mood", () => {
    const sun: SunPosition = { altitude_deg: -5, azimuth_deg: 0, time_of_day: "night" };
    const r = computeSceneMood(budget({
      leds: [{ id: "led_1", length_mm: 3000, colour_temperature_k: 2700, lumens_per_m: 800 }],
    }), sun);
    expect(r.effective_colour_temperature_k).toBeLessThan(3200);
    expect(r.daylight_share).toBe(0);
    expect(r.mood).toBe("warm_cocoon");
  });

  it("large south-facing window at noon produces airy_daylit mood", () => {
    const sun: SunPosition = { altitude_deg: 60, azimuth_deg: 180, time_of_day: "noon" };
    const r = computeSceneMood(budget({
      daylight_windows: [{ window_id: "w1", facing: "S", width_mm: 3000, height_mm: 2000, sill_height_mm: 800, glazing: "double" }],
    }), sun);
    expect(r.daylight_share).toBeGreaterThan(0.5);
    expect(r.mood).toBe("airy_daylit");
  });

  it("dominant spotlights → clinical or moody depending on colour temperature", () => {
    const sun: SunPosition = { altitude_deg: -5, azimuth_deg: 0, time_of_day: "night" };
    const clinical = computeSceneMood(budget({
      spotlights: [{ id: "sp1", colour_temperature_k: 5000, beam_angle_deg: 30, lumens: 1200 }, { id: "sp2", colour_temperature_k: 5000, beam_angle_deg: 30, lumens: 1200 }],
    }), sun);
    expect(clinical.mood).toBe("clinical");
    const moody = computeSceneMood(budget({
      spotlights: [{ id: "sp1", colour_temperature_k: 2700, beam_angle_deg: 15, lumens: 900 }, { id: "sp2", colour_temperature_k: 2700, beam_angle_deg: 15, lumens: 900 }],
    }), sun);
    expect(moody.mood).toBe("moody_focused");
  });

  it("shadow_softness lifts with daylight share + bounce", () => {
    const sun: SunPosition = { altitude_deg: 60, azimuth_deg: 180, time_of_day: "noon" };
    const soft = computeSceneMood(budget({
      daylight_windows: [{ window_id: "w1", facing: "S", width_mm: 3000, height_mm: 2000, sill_height_mm: 800, glazing: "double" }],
    }), sun);
    const hard = computeSceneMood(budget({
      spotlights: [{ id: "sp1", colour_temperature_k: 3200, beam_angle_deg: 15, lumens: 800 }],
      ambient_bounce: { walls_pct: 0.15, ceiling_pct: 0.15, floor_pct: 0.15 },
    }), { altitude_deg: -5, azimuth_deg: 0, time_of_day: "night" });
    expect(soft.shadow_softness).toBeGreaterThan(hard.shadow_softness);
  });
});
