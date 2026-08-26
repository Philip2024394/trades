// scripts/nex-city-catalogue/loader.mjs
//
// 2026-08-24 · Phase 1 refactor · shared loader for the NEX city catalogue.
// Every acquisition-side .mjs script (rotation tick, orchestrator tick,
// market walker, transport walker, food/accommodation city-bbox factories)
// imports its city universe from HERE instead of hardcoding an inline copy.
//
// Adding a new Indonesian city = one entry in `data/nex-city-catalogue.json`.
// This loader picks it up on next process start · no other code edits needed
// for the .mjs surface. The TypeScript surface (src/lib/nex/city-registry.ts)
// consumes the same JSON via `import ... from "../../data/..." with { type:
// "json" }` (or equivalent).
//
// Doctrine anchors:
//   · project_nex_one_geographic_authority_lock_2026_08_24
//   · project_nex_geographic_expansion_investigation_2026_08_24 (Phase 1)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOGUE_PATH = path.join(__dirname, "..", "..", "data", "nex-city-catalogue.json");

let _cache = null;

function loadRaw() {
  if (_cache) return _cache;
  const text = fs.readFileSync(CATALOGUE_PATH, "utf8");
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.cities)) {
    throw new Error(`[city-catalogue] ${CATALOGUE_PATH} missing "cities" array`);
  }
  for (const c of parsed.cities) {
    if (!c.canonical || !c.slug || !c.province || !c.region) {
      throw new Error(`[city-catalogue] entry missing required field: ${JSON.stringify(c)}`);
    }
    if (!Array.isArray(c.bboxSw) || !Array.isArray(c.bboxNe)) {
      throw new Error(`[city-catalogue] entry ${c.canonical} missing bbox arrays`);
    }
  }
  _cache = parsed.cities;
  return _cache;
}

/** Full list of city entries in canonical order. */
export function allCities() {
  return loadRaw();
}

/** List of canonical city names (used by rotation TRACKED_CITIES). */
export function trackedCityNames() {
  return loadRaw().map((c) => c.canonical);
}

/** Return the entry for a given canonical name (case-insensitive) or null. */
export function cityByCanonical(name) {
  if (!name) return null;
  const norm = String(name).toLowerCase();
  return loadRaw().find((c) => c.canonical.toLowerCase() === norm) ?? null;
}

/** Return the entry for a given slug or null. */
export function cityBySlug(slug) {
  if (!slug) return null;
  const norm = String(slug).toLowerCase();
  return loadRaw().find((c) => c.slug === norm) ?? null;
}

/** Substring-tolerant lookup · matches canonical, slug, or aliases (case-insensitive). */
export function cityByAny(name) {
  if (!name) return null;
  const norm = String(name).toLowerCase();
  for (const c of loadRaw()) {
    if (c.canonical.toLowerCase() === norm) return c;
    if (c.slug === norm) return c;
    if (c.aliases?.some((a) => a.toLowerCase() === norm)) return c;
  }
  return null;
}

/** Bbox for a city in the walker's { sw:[lat,lng], ne:[lat,lng], scope } shape. */
export function bboxForCity(name) {
  const c = cityByAny(name);
  if (!c) return null;
  return {
    sw: c.bboxSw,
    ne: c.bboxNe,
    scope: `${c.canonical} · ${c.province}`,
  };
}

/** Jurisdiction string per city · used for INSERTs that record jurisdiction. */
export function jurisdictionForCity(name) {
  const c = cityByAny(name);
  if (!c) return null;
  if (c.canonical === "Yogyakarta") return "ID/DIY/Yogyakarta";
  if (c.region === "DIY")          return `ID/DIY/${c.canonical}`;
  if (c.region === "Central Java") return `ID/Central-Java/${c.canonical}`;
  // Extensible for future regions (DKI Jakarta / Bali / etc.).
  const regionSlug = c.region.replace(/\s+/g, "-");
  return `ID/${regionSlug}/${c.canonical}`;
}
