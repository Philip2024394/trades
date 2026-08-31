// scripts/nex-geo/build-city-catalogue.mjs
//
// NEX · rewrite data/nex-city-catalogue.json from the Indonesia geo dataset.
// Philip 2026-08-28 · unlocks 100-walker fleet from Yogyakarta-only territory
// to whole-Indonesia coverage.
//
// Reads:  data/nex-geo/indonesia-locations.json  (38 provinces + 519 cities + 49 islands)
// Writes: data/nex-city-catalogue.json           (walker seed · consumed by rotation)
//
// Priority policy (walker rotation picks in ascending order):
//   Bali entries       →   1..49    (Denpasar first)
//   Province capitals  → 100..149
//   Major cities       → 200..399   (top-100 by population)
//   Regular cities     → 400..799
//   Yogyakarta cluster → 900..999   (deprioritized · saturated territory)
//
// Bbox synthesis: uniform centroid ± 0.10° (~11km) per Philip 2026-08-28.
//
// Existing 14 entries are PRESERVED VERBATIM (by canonical name lookup) so
// downstream code that references specific city bboxes/slugs still works.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const GEO_JSON  = resolve(REPO_ROOT, "data", "nex-geo",   "indonesia-locations.json");
const OUT_JSON  = resolve(REPO_ROOT, "data", "nex-city-catalogue.json");

const BBOX_DELTA = 0.10;            // ± degrees around centroid
const BALI_MAX   = 49;              // priorities 1..49 for Bali
const CAP_MAX    = 149;             // 100..149 for non-Bali province capitals
const MAJOR_MAX  = 399;             // 200..399 for top-N by population
const REGULAR_MAX = 799;            // 400..799 for the rest
const YOGYA_BASE  = 900;            // 900..999 Yogya cluster (deprioritized)

// ── LOAD ───────────────────────────────────────────────────────────────────

if (!existsSync(GEO_JSON)) {
  console.error(`[build-city-catalogue] geo JSON not found: ${GEO_JSON}`);
  process.exit(1);
}
const geo = JSON.parse(readFileSync(GEO_JSON, "utf8"));
if (!geo.provinces || !geo.cities) {
  console.error("[build-city-catalogue] geo JSON missing provinces/cities arrays");
  process.exit(1);
}

// Existing catalogue (preserve verbatim for entries that match by canonical name)
const existing = existsSync(OUT_JSON)
  ? JSON.parse(readFileSync(OUT_JSON, "utf8"))
  : { cities: [] };
const existingByCanonical = new Map(
  (existing.cities ?? []).map((c) => [c.canonical.toLowerCase(), c])
);

// ── HELPERS ────────────────────────────────────────────────────────────────

const slugify = (s) => s
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const isYogyaCluster = (city) => {
  const n = city.name_id.toLowerCase();
  const p = (city.province || "").toLowerCase();
  return p.includes("yogyakarta") || p === "diy"
      || ["yogyakarta","sleman","bantul","kulon progo","gunungkidul"]
           .includes(n);
};
const isBali = (city) => (city.province || "").toLowerCase() === "bali";

// Population score for sort — unknown treated as 0 (goes last within band)
const popScore = (city) => {
  const p = city.population_est;
  return typeof p === "number" ? p : 0;
};

// ── PROVINCE CAPITAL LOOKUP ────────────────────────────────────────────────

const capitalNames = new Set(
  geo.provinces
    .map((p) => (p.capital || "").toLowerCase())
    .filter(Boolean)
);
const isProvinceCapital = (city) => capitalNames.has(city.name_id.toLowerCase());

// ── PRIORITY BUCKETING ─────────────────────────────────────────────────────

function assignPriority(cities) {
  // Sort into priority bands
  const bali    = cities.filter(isBali);
  const yogya   = cities.filter(isYogyaCluster);
  const rest    = cities.filter((c) => !isBali(c) && !isYogyaCluster(c));

  // Bali: preserve geo-JSON order (research agent already put Denpasar first)
  bali.forEach((c, i) => { c._priority = Math.min(1 + i, BALI_MAX); });

  // Non-Bali province capitals · priorities 100..149 by population desc
  const capitals = rest
    .filter(isProvinceCapital)
    .sort((a, b) => popScore(b) - popScore(a));
  capitals.forEach((c, i) => { c._priority = Math.min(100 + i, CAP_MAX); });

  // Major cities (top-100 by population among non-capitals) · 200..399
  const nonCapitals = rest.filter((c) => !isProvinceCapital(c));
  const byPop = [...nonCapitals].sort((a, b) => popScore(b) - popScore(a));
  const majors = byPop.slice(0, 100);
  const regulars = byPop.slice(100);
  majors.forEach((c, i)   => { c._priority = 200 + i; });
  regulars.forEach((c, i) => { c._priority = Math.min(400 + i, REGULAR_MAX); });

  // Yogya cluster · 900..999
  yogya.forEach((c, i) => { c._priority = YOGYA_BASE + i; });

  return [...bali, ...capitals, ...majors, ...regulars, ...yogya];
}

const prioritised = assignPriority(geo.cities);

// ── BUILD CATALOGUE ENTRIES ────────────────────────────────────────────────

function buildEntry(city) {
  const canonical = city.name_id;
  const existingE = existingByCanonical.get(canonical.toLowerCase());
  if (existingE) {
    // Preserve existing entry EXACTLY · add priority if missing.
    return {
      ...existingE,
      priority: typeof existingE.priority === "number"
        ? existingE.priority
        : city._priority,
    };
  }
  const lat = city.coordinates?.lat;
  const lon = city.coordinates?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") {
    console.warn(`[build-city-catalogue] SKIP · no coordinates for ${canonical}`);
    return null;
  }
  return {
    canonical,
    slug: slugify(canonical),
    province: city.province,
    region:   city.province,        // initial: region = province · aggregation later
    centroid: { lat, lng: lon },
    bboxSw: [lat - BBOX_DELTA, lon - BBOX_DELTA],
    bboxNe: [lat + BBOX_DELTA, lon + BBOX_DELTA],
    aliases: [],
    priority: city._priority,
  };
}

const entries = prioritised
  .map(buildEntry)
  .filter(Boolean);

// Deduplicate by slug (multiple cities with same slug — first wins by priority)
const bySlug = new Map();
for (const e of entries.sort((a, b) => a.priority - b.priority)) {
  if (!bySlug.has(e.slug)) bySlug.set(e.slug, e);
}
const finalEntries = [...bySlug.values()].sort((a, b) => a.priority - b.priority);

// ── OUTPUT ─────────────────────────────────────────────────────────────────

const out = {
  _doc: "SINGLE SOURCE OF TRUTH for NEX geographic universe. Loaded by src/lib/nex/city-registry.ts (TypeScript consumers) AND by scripts/nex-* .mjs consumers (rotation tick, orchestrator tick, market/transport walkers, city-bbox-catalogue). Adding a city = one entry here. Drift is caught by src/lib/nex/city-registry.test.ts.",
  _schema: {
    canonical: "display name · MUST exactly match nex.*.city column values",
    slug: "URL segment · lowercase-hyphenated",
    province: "display province · e.g. Bali · DKI Jakarta · East Java",
    region:   "grouping label · initially matches province · future regions may collapse multiple provinces",
    centroid: "map centre {lat, lng} for landing hero + map",
    bboxSw:   "[lat, lng] south-west corner · used by walkers · centroid ± 0.10° (~11km)",
    bboxNe:   "[lat, lng] north-east corner",
    aliases:  "additional accepted spellings for slug/canonical matching (never fabricated)",
    priority: "walker rotation ORDER (ascending) · Bali=1-49 · capitals=100-149 · majors=200-399 · rest=400-799 · Yogya=900+ (Philip 2026-08-28 · deprioritized after saturation)",
  },
  _generated_by: "scripts/nex-geo/build-city-catalogue.mjs",
  _generated_at: new Date().toISOString(),
  _counts: {
    total:       finalEntries.length,
    bali:        finalEntries.filter((e) => (e.province || "").toLowerCase() === "bali").length,
    capitals:    finalEntries.filter((e) => e.priority >= 100 && e.priority < 200).length,
    majors:      finalEntries.filter((e) => e.priority >= 200 && e.priority < 400).length,
    regular:     finalEntries.filter((e) => e.priority >= 400 && e.priority < 900).length,
    deprioritized: finalEntries.filter((e) => e.priority >= 900).length,
  },
  cities: finalEntries,
};

writeFileSync(OUT_JSON, JSON.stringify(out, null, 2), "utf8");

console.log(`[build-city-catalogue] wrote ${OUT_JSON}`);
console.log(`  total ${out._counts.total} cities`);
console.log(`    bali        ${out._counts.bali}`);
console.log(`    capitals    ${out._counts.capitals}`);
console.log(`    majors      ${out._counts.majors}`);
console.log(`    regular     ${out._counts.regular}`);
console.log(`    yogya (deprioritized) ${out._counts.deprioritized}`);
