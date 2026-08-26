// scripts/nex-acquisition/configs/city-bbox-catalogue.mjs
//
// 2026-08-24 · Phase 1 refactor · this file is now a THIN ADAPTER over the
// shared `data/nex-city-catalogue.json` (loaded via ../../nex-city-catalogue/
// loader.mjs). Adding a city no longer requires editing this file — one entry
// in the JSON is enough. Backwards-compatible API preserved so existing
// importers (food-city-factory, accommodation-city-factory, market walker)
// keep working unchanged. Yogyakarta is excluded from CITY_BBOX_CATALOGUE
// because Yogyakarta keeps its hand-tuned zone-per-config in
// accommodation-yogyakarta.mjs + food-yogyakarta.mjs.
//
// Doctrine anchors:
//   · project_nex_one_geographic_authority_lock_2026_08_24
//   · project_nex_geographic_expansion_investigation_2026_08_24 (Phase 1)

import {
  allCities,
  bboxForCity as sharedBboxForCity,
  cityByAny,
  jurisdictionForCity as sharedJurisdictionForCity,
} from "../../nex-city-catalogue/loader.mjs";

// Legacy name→bbox map (Yogyakarta excluded · see doctrine note above).
// Consumers that iterate this map get exactly the non-Yogyakarta cities.
export const CITY_BBOX_CATALOGUE = Object.fromEntries(
  allCities()
    .filter((c) => c.canonical !== "Yogyakarta")
    .map((c) => [
      c.canonical,
      { sw: c.bboxSw, ne: c.bboxNe, scope: `${c.canonical} · ${c.province}` },
    ]),
);

/**
 * Canonical surface name for a city (city slug). Used by the surface-aware
 * rotation controller · replaces the earlier hardcoded 'prambanan' placeholder.
 */
export function surfaceNameForCity(cityArg) {
  const c = cityByAny(cityArg);
  return c ? c.slug : null;
}

/** Return the bbox for a given city name, or null if not catalogued. */
export function bboxForCity(cityArg) {
  return sharedBboxForCity(cityArg);
}

/** Return the canonical catalogue key for a given city arg (case-insensitive). */
export function cityKeyForArg(cityArg) {
  const c = cityByAny(cityArg);
  return c ? c.canonical : null;
}

/** Jurisdiction string per city · used for INSERTs that record jurisdiction. */
export function jurisdictionForCity(cityKey) {
  return sharedJurisdictionForCity(cityKey);
}
