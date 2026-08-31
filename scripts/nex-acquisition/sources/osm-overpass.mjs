// NEX Universal Acquisition Engine · discovery source · OSM/Overpass.
//
// One of the currently-permitted discovery sources (per Source Capability
// Report 2026-08-21). ODbL licence · attribution recorded per-row.
// Used by any vertical whose config includes this source. The vertical-
// specific query and category mapping is passed in via config.osmOverpass.
//
// Vertical-agnostic: no food/hotel-specific logic. Config supplies:
//   · osmOverpass.amenities: e.g. ["restaurant","cafe"] (Food) or
//                                 ["hotel","hostel","guest_house"] (Hotels)
//   · osmOverpass.categoryMapping: (amenity_tag) => nex_category
//   · osmOverpass.cacheKey: unique cache filename per vertical/bbox

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", ".cache", "overpass");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const USER_AGENT = "NEX-Acquisition/1.0 (+https://nex.example · ODbL-attribution-respected)";
// Philip 2026-08-27 · endpoint list expanded from 3 to 4 after live probe
// showed 3-of-3 original endpoints failing (fetch-throw · HTTP 500 · HTTP 500)
// while `maps.mail.ru` returned 33 elements in 6.4s. More failover mirrors =
// higher chance any single walker cycle finds a healthy endpoint. Rate governor
// still enforces global politeness · this is about resilience, not aggression.
// Philip 2026-08-28 · added `overpass.osm.ch` (Swiss OSM mirror) as 5th
// failover after live probe during a broad Overpass outage showed all four
// mirrors 502/504/timeout while osm.ch returned 200 in 5.3s.
const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

function readCache(name) {
  const p = join(CACHE_DIR, `${name}.json`);
  if (!existsSync(p)) return null;
  const age = Date.now() - statSync(p).mtimeMs;
  if (age > CACHE_TTL_MS) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}
function writeCache(name, data) {
  writeFileSync(join(CACHE_DIR, `${name}.json`), JSON.stringify(data), "utf8");
}

function buildQuery({ amenities, shopTypes, tourismTypes, extendedTagPairs, bbox }) {
  const [south, west, north, east] = [bbox.sw[0], bbox.sw[1], bbox.ne[0], bbox.ne[1]];
  const parts = [];
  // amenity=* family (existing behaviour · Task #85 · widened list from config)
  for (const a of amenities ?? []) {
    parts.push(`node["amenity"="${a}"](${south},${west},${north},${east});`);
    parts.push(`way["amenity"="${a}"](${south},${west},${north},${east});`);
    parts.push(`relation["amenity"="${a}"](${south},${west},${north},${east});`);
  }
  // Task #85 (2026-08-22) · shop=* family (unambiguously food/beverage only).
  // Configured in the vertical config's osmOverpass.shopTypes · null-safe here
  // so verticals that don't opt-in remain unchanged.
  for (const s of shopTypes ?? []) {
    parts.push(`node["shop"="${s}"](${south},${west},${north},${east});`);
    parts.push(`way["shop"="${s}"](${south},${west},${north},${east});`);
    parts.push(`relation["shop"="${s}"](${south},${west},${north},${east});`);
  }
  // Task #89 Phase A (2026-08-22) · tourism=* family for Accommodation vertical.
  // Same null-safe pattern · Food config doesn't set tourismTypes so no change to Food.
  for (const t of tourismTypes ?? []) {
    parts.push(`node["tourism"="${t}"](${south},${west},${north},${east});`);
    parts.push(`way["tourism"="${t}"](${south},${west},${north},${east});`);
    parts.push(`relation["tourism"="${t}"](${south},${west},${north},${east});`);
  }
  // Task #89 Phase A · extended tag pairs for cases like building=hotel · hotel=resort ·
  // hotel=villa (Q3 · Philip explicit "extended scope"). Array of [key, value] pairs.
  // Conservative classifier decides NEX category from raw tags · here we just widen the query.
  for (const pair of extendedTagPairs ?? []) {
    const [key, value] = pair;
    if (!key || !value) continue;
    parts.push(`node["${key}"="${value}"](${south},${west},${north},${east});`);
    parts.push(`way["${key}"="${value}"](${south},${west},${north},${east});`);
    parts.push(`relation["${key}"="${value}"](${south},${west},${north},${east});`);
  }
  // `out center tags meta` includes element `timestamp` + `version` metadata.
  // Freshness doctrine (2026-08-21) requires the OSM element timestamp so
  // last_verified_at can be seeded from credible evidence, not from Walker's
  // fetch date. Prior cache files used `out center tags` (no meta) — those
  // caches produce records that stay UNVERIFIED until re-fetched.
  return `
[out:json][timeout:60];
(
  ${parts.join("\n  ")}
);
out center tags meta;
`.trim();
}

// Phase B (2026-08-24) · Provider Rate Governor gate around Overpass fetches.
// Every Overpass request acquires a lease from nex.provider_rate_lease · waits
// behind other walkers if the 2000ms min interval hasn't elapsed globally.
// Never bypass · governor is authoritative.
import { acquireProviderLease, releaseProviderLease } from "./_provider-lease-helper.mjs";

async function fetchOverpass(query, walkerId = "acquisition:overpass") {
  const leaseId = await acquireProviderLease("overpass", walkerId);
  try {
    let lastErr = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
          },
          body: "data=" + encodeURIComponent(query),
        });
        if (!resp.ok) { lastErr = new Error(`${endpoint}: ${resp.status}`); continue; }
        return await resp.json();
      } catch (err) { lastErr = err; }
    }
    throw lastErr ?? new Error("all Overpass endpoints failed");
  } finally {
    await releaseProviderLease(leaseId);
  }
}

function extractCandidate(el, categoryMapping, classifier) {
  const tags = el.tags ?? {};
  const name = tags.name ?? tags["name:en"] ?? tags["name:id"];
  if (!name) return null;

  let lat = null, lng = null;
  if (el.type === "node") { lat = el.lat; lng = el.lon; }
  else if (el.center) { lat = el.center.lat; lng = el.center.lon; }

  const amenity = tags.amenity;
  const shop    = tags.shop;
  const cuisine = tags.cuisine;

  // Task #85 (2026-08-22) · richer classification when classifier is available.
  // Falls back to legacy single-value categoryMapping when only that is passed
  // (preserves smoke-test and any external caller not yet upgraded).
  let category = null;
  let categories = [];
  if (typeof classifier === "function") {
    const cls = classifier(amenity, shop, cuisine, tags);
    category = cls.primary;
    categories = Array.isArray(cls.secondary) ? cls.secondary : [];
  } else {
    category = categoryMapping(amenity, cuisine, tags);
  }

  const addressParts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : null;

  const whatsapp = tags["contact:whatsapp"] ?? null;
  const phone = tags["contact:phone"] ?? tags["phone"] ?? null;
  const website = tags["contact:website"] ?? tags["website"] ?? null;

  // OSM element metadata · when this element was last edited in OSM.
  // This is the WEAKEST form of "credible evidence business is operating" —
  // someone believed it existed then. NEVER passed off as owner-verified.
  // Freshness doctrine (2026-08-21): last_verified_at seeds from this, not
  // from now(). Discovery date != verification date.
  const osmTimestamp = el.timestamp ? new Date(el.timestamp).toISOString() : null;

  return {
    name,
    category,       // primary · single value from 4-enum contract (Q2=C preserved)
    categories,     // Task #85 · secondary evidence tokens · never includes primary duplicate
    address,
    lat,
    lng,
    whatsapp,
    phone,
    website,
    rawTags: tags,
    osmId: `${el.type}/${el.id}`,
    sourceType: "osm_overpass",
    sourceReference: `${el.type}/${el.id}`,
    sourceLicenceTerms: "ODbL 1.0 · © OpenStreetMap contributors · https://openstreetmap.org/copyright",
    sourceUpdatedAt: osmTimestamp,           // when OSM element was last edited
    lastVerifiedAt: osmTimestamp,             // seed · same value initially · admin/owner/re-verify updates it
    verificationSource: osmTimestamp ? "osm_element_timestamp" : null,
  };
}

function elementInsideBbox(el, bbox) {
  let lat = null, lng = null;
  if (el.type === "node") { lat = el.lat; lng = el.lon; }
  else if (el.center) { lat = el.center.lat; lng = el.center.lon; }
  if (lat == null || lng == null) return false;
  return (
    lat >= bbox.sw[0] && lat <= bbox.ne[0] &&
    lng >= bbox.sw[1] && lng <= bbox.ne[1]
  );
}

// Absolute-path fallback caches populated by earlier acquisition scripts.
// If the live Overpass endpoints all 502, we filter these existing full-city
// dumps by the requested bbox in-memory. Same data · newer file · same shape.
const FALLBACK_CACHES = [
  join(__dirname, "..", "..", "nex-food", ".cache", "osm-yogyakarta.json"),
];

function tryFallbackCache(bbox, log) {
  for (const p of FALLBACK_CACHES) {
    if (!existsSync(p)) continue;
    try {
      const data = JSON.parse(readFileSync(p, "utf8"));
      const total = data.elements?.length ?? 0;
      const filtered = (data.elements ?? []).filter((el) => elementInsideBbox(el, bbox));
      log(`  osm_overpass: fallback cache HIT · ${p} · ${total} total · ${filtered.length} inside bbox`);
      return { elements: filtered };
    } catch (err) {
      log(`  osm_overpass: fallback cache read failed · ${err.message}`);
    }
  }
  return null;
}

export function osmOverpassSource() {
  return {
    name: "osm_overpass",
    async discover({ config, bbox, log }) {
      const amenities = config.osmOverpass.amenities ?? [];
      const shopTypes = config.osmOverpass.shopTypes ?? [];
      // Task #89 Phase A (2026-08-22) · Accommodation vertical uses tourismTypes + extendedTagPairs.
      // Both null-safe · Food config leaves them unset · Food query unchanged.
      const tourismTypes = config.osmOverpass.tourismTypes ?? [];
      const extendedTagPairs = config.osmOverpass.extendedTagPairs ?? [];
      // Task #85 (2026-08-22) · cache key includes v2 suffix so previously-cached
      // narrow-query results (amenity-only · 6 tags) don't shadow the new wide
      // query. Old cache entries silently expire · next fetch pulls the wider set.
      // Vertical prefix ensures food + accommodation caches never collide.
      const cacheName = `${config.vertical}-v2-${bbox.sw[0]}-${bbox.sw[1]}-${bbox.ne[0]}-${bbox.ne[1]}`.replace(/\./g, "_");
      let osmResp = readCache(cacheName);
      if (osmResp) {
        log(`  osm_overpass: cache HIT (v2) · ${osmResp.elements?.length ?? 0} raw elements`);
      } else {
        const query = buildQuery({ amenities, shopTypes, tourismTypes, extendedTagPairs, bbox });
        log(`  osm_overpass: fetching Overpass · bbox ${JSON.stringify(bbox)} · amenities [${amenities.join(",")}] · shopTypes [${shopTypes.join(",")}] · tourismTypes [${tourismTypes.join(",")}] · extendedTagPairs [${extendedTagPairs.map((p) => p.join("=")).join(",")}]`);
        try {
          osmResp = await fetchOverpass(query);
          writeCache(cacheName, osmResp);
          log(`  osm_overpass: fetched ${osmResp.elements?.length ?? 0} raw elements`);
        } catch (err) {
          log(`  osm_overpass: live fetch failed (${err.message}) · trying fallback cache`);
          osmResp = tryFallbackCache(bbox, log);
          if (!osmResp) throw err;
        }
      }
      const elements = osmResp.elements ?? [];
      const candidates = [];
      // Task #85 · pass classifier when available · falls back to legacy single-value
      // categoryMapping when classifier absent (verticals not yet upgraded).
      for (const el of elements) {
        const c = extractCandidate(el, config.osmOverpass.categoryMapping, config.osmOverpass.classifier);
        if (c) candidates.push(c);
      }
      return candidates;
    },
  };
}
