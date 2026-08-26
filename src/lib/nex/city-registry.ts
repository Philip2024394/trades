// src/lib/nex/city-registry.ts
//
// NEX Central City Registry · 2026-08-24 · Phase 1 refactor.
//
// SINGLE SOURCE OF TRUTH now lives in `data/nex-city-catalogue.json` and is
// consumed by BOTH:
//   · TypeScript code (this file + downstream libs/pages)
//   · Runtime .mjs scripts (rotation tick · orchestrator tick · walkers ·
//     city-bbox-catalogue) via a shared JSON loader
//
// Adding a new Indonesian city = one entry in `data/nex-city-catalogue.json`.
// The Rotation Controller / Orchestrator picks it up automatically on the
// next tick. Drift between the JSON, this TypeScript surface, and the .mjs
// consumers is caught by `src/lib/nex/city-registry.test.ts`.
//
// Doctrine anchors:
//   · project_nex_provider_rate_governor_scaling_2026_08_24 (data-driven UI)
//   · project_nex_one_geographic_authority_lock_2026_08_24 (single spawn authority)
//   · project_nex_geographic_expansion_investigation_2026_08_24 (Phase 1)

import cityCatalogue from "../../../data/nex-city-catalogue.json";

/** Region enum · widened to any-string so the JSON catalogue can introduce new
 *  Indonesian regions (Jakarta / Bali / East Java / etc.) without a TypeScript
 *  edit. Consumers that switch on region MUST handle the default arm. */
export type CityRegion = string;

export interface CityRegistryEntry {
  canonical:   string;   // display name · exact match against nex.*.city columns
  slug:        string;   // URL segment · lowercase-hyphenated
  province:    string;   // display province · e.g. "DIY" · "Central Java"
  region:      CityRegion;
  centroid:    { lat: number; lng: number };  // for map + landing hero
  bboxSw:      [number, number];               // south-west [lat, lng] · matches walker bbox
  bboxNe:      [number, number];               // north-east [lat, lng]
  aliases:     string[];                       // additional accepted spellings for slug matching
  // Optional future fields · NEVER populated with fabricated values.
  heroImage?:  { url: string; source: string; licence: string } | null;
  seoTitle?:   string | null;
  seoDescription?: string | null;
}

interface RawCatalogue {
  cities: CityRegistryEntry[];
  [key: string]: unknown;
}

// Parse + shape-check the JSON. Fail loud at import time if the catalogue
// is malformed rather than silently miss cities from rotation.
function loadCatalogue(): CityRegistryEntry[] {
  const raw = cityCatalogue as RawCatalogue;
  if (!raw || !Array.isArray(raw.cities)) {
    throw new Error("[city-registry] data/nex-city-catalogue.json missing `cities` array");
  }
  for (const c of raw.cities) {
    if (!c.canonical || !c.slug || !c.province || !c.region) {
      throw new Error(`[city-registry] entry missing required field: ${JSON.stringify(c)}`);
    }
    if (!Array.isArray(c.bboxSw) || !Array.isArray(c.bboxNe)) {
      throw new Error(`[city-registry] entry ${c.canonical} missing bbox arrays`);
    }
  }
  return raw.cities;
}

export const CITY_REGISTRY: CityRegistryEntry[] = loadCatalogue();

const _bySlug      = new Map(CITY_REGISTRY.map((c) => [c.slug, c]));
const _byCanonical = new Map(CITY_REGISTRY.map((c) => [c.canonical.toLowerCase(), c]));
const _byAlias     = new Map<string, CityRegistryEntry>();
for (const c of CITY_REGISTRY) for (const a of c.aliases) _byAlias.set(a.toLowerCase(), c);

/**
 * Resolve a route slug (e.g. "kulon-progo") to its registry entry.
 * Returns null when unknown · caller should redirect to the vertical
 * landing page rather than fake a city.
 */
export function cityFromSlug(slug: string | null | undefined): CityRegistryEntry | null {
  if (!slug) return null;
  return _bySlug.get(slug.toLowerCase()) ?? null;
}

/**
 * Resolve any user-typed city name (canonical or alias) to a registry entry.
 * Case-insensitive · null when no match.
 */
export function cityFromName(name: string | null | undefined): CityRegistryEntry | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return _byCanonical.get(lower) ?? _byAlias.get(lower) ?? null;
}

/** Convert a canonical city name to its URL slug (or null if unknown). */
export function slugFromCanonical(canonical: string): string | null {
  return _byCanonical.get(canonical.toLowerCase())?.slug ?? null;
}

/** List all registered city slugs · used by static-params generation etc. */
export function allCitySlugs(): string[] {
  return CITY_REGISTRY.map((c) => c.slug);
}

/** List all cities in a given region (province). */
export function citiesInRegion(region: CityRegion): CityRegistryEntry[] {
  return CITY_REGISTRY.filter((c) => c.region === region);
}

/** List all distinct regions currently in the catalogue · used by HQ + tests. */
export function allRegions(): CityRegion[] {
  return Array.from(new Set(CITY_REGISTRY.map((c) => c.region)));
}
