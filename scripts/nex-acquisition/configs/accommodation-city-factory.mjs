// scripts/nex-acquisition/configs/accommodation-city-factory.mjs
//
// Phase B (2026-08-24) · factory that produces a runnable Accommodation
// config for any city in CITY_BBOX_CATALOGUE. Yogyakarta keeps its
// hand-tuned config; this factory serves the 7 other cities.
//
// Mirror of food-city-factory.mjs · same spread + override pattern.

import { accommodationYogyakartaConfig } from "./accommodation-yogyakarta.mjs";
import { bboxForCity, cityKeyForArg, surfaceNameForCity } from "./city-bbox-catalogue.mjs";

export function makeAccommodationConfig(cityArg) {
  const cityKey = cityKeyForArg(cityArg);
  if (!cityKey) return null;
  if (cityKey === "Yogyakarta") return accommodationYogyakartaConfig;
  const bbox = bboxForCity(cityKey);
  if (!bbox) return null;

  // 2026-08-24 · P0 atomic · honest surface name (city slug) replaces the
  // previous 'default' key. Mirrors food-city-factory.mjs.
  const surface = surfaceNameForCity(cityKey);
  return {
    ...accommodationYogyakartaConfig,
    city: cityKey,
    defaultBbox: bbox,
    smokeBbox: bbox,
    smokeBboxes: { [surface]: bbox },
    defaultSurfaceName: surface,
  };
}
