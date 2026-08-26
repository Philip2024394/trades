// scripts/nex-acquisition/configs/food-city-factory.mjs
//
// Phase B (2026-08-24) · factory that produces a runnable Food config for
// any city in CITY_BBOX_CATALOGUE. Yogyakarta keeps its hand-tuned config;
// this factory serves the 7 other cities.
//
// Doctrine: DO NOT copy the Yogyakarta config wholesale. Spread it and
// override only city/bbox. All classifier/persistence/table logic is
// inherited by reference · methods use `this` which binds at call site to
// the factory-generated object (verified: this.city, this.country, this.tables
// all resolve correctly against the new object).

import { foodYogyakartaConfig } from "./food-yogyakarta.mjs";
import { bboxForCity, cityKeyForArg, surfaceNameForCity } from "./city-bbox-catalogue.mjs";

/**
 * Build a Food config for a non-Yogyakarta city. Returns null when the city
 * is not in the catalogue (never fake a city).
 */
export function makeFoodConfig(cityArg) {
  const cityKey = cityKeyForArg(cityArg);
  if (!cityKey) return null;
  if (cityKey === "Yogyakarta") {
    // Yogyakarta uses its hand-tuned zoned config · caller should route there.
    return foodYogyakartaConfig;
  }
  const bbox = bboxForCity(cityKey);
  if (!bbox) return null;

  // 2026-08-24 · P0 atomic · honest surface name replaces the previous
  // `default` key. Surface = city slug (e.g. `bantul`, `sleman`,
  // `kulon-progo`). Walker's worker_config becomes `food:{city}:{surface}`
  // which is what rotation state now uses at 4-tuple grain.
  const surface = surfaceNameForCity(cityKey);
  return {
    ...foodYogyakartaConfig,
    city: cityKey,
    defaultBbox: bbox,
    smokeBbox: bbox,
    // Single-surface-per-city for Phase B · Yogyakarta remains multi-surface via
    // its hand-tuned config · future work can split each city into more surfaces.
    smokeBboxes: { [surface]: bbox },
    // Expose canonical surface name so the walker's default bboxName can pick
    // it up without requiring an explicit --bbox arg (safe for surface-aware
    // rotation which will pass --bbox anyway).
    defaultSurfaceName: surface,
  };
}
