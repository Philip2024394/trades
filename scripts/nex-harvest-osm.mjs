#!/usr/bin/env node
// scripts/nex-harvest-osm.mjs
//
// Founder Phase 1a · OpenStreetMap harvester (Overpass API).
//
// The FIRST step in the Ultimate Data Blueprint. Pulls accommodation
// records from OSM's Overpass endpoint, normalizes them into NEX's
// schema shape, and dry-runs the persist path so we can see exactly
// what would land in nex.accommodation_business.
//
// Usage:
//   node scripts/nex-harvest-osm.mjs --city yogyakarta                # dry-run
//   node scripts/nex-harvest-osm.mjs --city yogyakarta --persist      # write to Postgres
//   node scripts/nex-harvest-osm.mjs --bbox -8.0,110.3,-7.7,110.5     # explicit bbox
//
// This script uses the SAME Overpass query pattern that Slice 1g
// production capability (overpass_observe_and_stage.mjs) uses — same
// tourism subtypes, same classifier. Zero fabrication: only fields
// present in the raw OSM element land in the output.
//
// License: OSM data is ODbL 1.0 — every persisted row carries
// source_licence_terms='openstreetmap:odbl-1.0'.

import { createHash, randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CACHE_DIR = join(REPO_ROOT, "data", "harvest-osm");

// ─── Arg parsing ───────────────────────────────────────────────────
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const key = a.replace(/^--/, "");
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) { args.set(key, next); i++; }
    else args.set(key, "true");
  }
}
const PERSIST     = args.get("persist") === "true";
const CITY        = args.get("city") ?? "yogyakarta";
const EXPLICIT_BB = args.get("bbox"); // "sw_lat,sw_lon,ne_lat,ne_lon"
const OVERPASS    = process.env.NEX_OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const MAX_RESULTS = Number(args.get("max") ?? "500");

// ─── City bboxes (starter set · matches P1 Yogyakarta baseline) ───
// Wider expansion later comes from nex_workforce.city_catalogue.
const CITY_BBOXES = {
  yogyakarta: { sw: { lat: -8.0, lon: 110.30 }, ne: { lat: -7.70, lon: 110.50 } },
  bali:       { sw: { lat: -8.85, lon: 115.00 }, ne: { lat: -8.05, lon: 115.60 } },
  jakarta:    { sw: { lat: -6.40, lon: 106.65 }, ne: { lat: -6.05, lon: 107.05 } },
  bandung:    { sw: { lat: -7.00, lon: 107.50 }, ne: { lat: -6.80, lon: 107.75 } },
  surabaya:   { sw: { lat: -7.35, lon: 112.60 }, ne: { lat: -7.15, lon: 112.85 } },
};

function resolveBbox() {
  if (EXPLICIT_BB) {
    const p = EXPLICIT_BB.split(",").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) {
      throw new Error(`--bbox expects "sw_lat,sw_lon,ne_lat,ne_lon", got: ${EXPLICIT_BB}`);
    }
    return { sw: { lat: p[0], lon: p[1] }, ne: { lat: p[2], lon: p[3] } };
  }
  const bb = CITY_BBOXES[CITY.toLowerCase()];
  if (!bb) throw new Error(`unknown city "${CITY}". Known: ${Object.keys(CITY_BBOXES).join(", ")}`);
  return bb;
}

// ─── Overpass query (identical shape to Slice 1g) ─────────────────
function buildQuery(bbox) {
  const bboxStr = `${bbox.sw.lat},${bbox.sw.lon},${bbox.ne.lat},${bbox.ne.lon}`;
  return `[out:json][timeout:60];node["tourism"~"^(hotel|guest_house|hostel|apartment|motel|chalet)$"](${bboxStr});out center;`;
}

// ─── Classifier (identical to production accommodation-yogyakarta) ─
function classifyCategory(tags) {
  const t = tags.tourism;
  const h = tags.hotel;
  const g = tags.guest_house;
  if (t === "hotel" && h === "villa") return "villa";
  if (t === "hotel" && h === "resort") return "resort";
  if (t === "chalet") return "villa";
  if (t === "guest_house" && g === "homestay") return "homestay";
  if (t === "guest_house") return "guesthouse";
  if (t === "hostel") return "hostel";
  if (t === "apartment") return "apartment";
  if (t === "motel") return "hotel";
  if (t === "hotel") return "hotel";
  return null; // reject
}

// ─── Amenity extraction (only present tags · never inferred) ──────
function extractAmenities(tags) {
  const out = [];
  if (tags.internet_access === "yes" || tags.internet_access === "wlan" || tags.internet_access === "wifi") out.push("wifi");
  if (tags.air_conditioning === "yes") out.push("air_conditioning");
  if (tags.breakfast === "yes") out.push("breakfast");
  if (tags.swimming_pool === "yes" || tags.pool === "yes") out.push("pool");
  if (tags.parking) out.push("parking");
  return out;
}

// ─── Normalizer · OSM element → NEX shape ─────────────────────────
function normalizeElement(el, cityCanonical) {
  const tags = el.tags ?? {};
  const name = (tags.name || tags["name:en"] || tags["name:id"] || "").trim();
  if (!name) return { rejected: "no_name" };
  const category = classifyCategory(tags);
  if (!category) return { rejected: "unknown_category" };
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return { rejected: "no_coordinates" };

  const stars = parseInt(tags.stars, 10);
  const rooms = parseInt(tags.rooms, 10);
  const addressParts = [tags["addr:street"], tags["addr:city"]].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : null;

  // Dedupe hash · same algorithm as _slice_a2 persister
  const nameNorm = name.toLowerCase().replace(/\s+/g, " ").trim();
  const addrNorm = (addressParts.join("|")).toLowerCase().replace(/\s+/g, " ").trim();
  const phoneLast6 = (tags.phone ?? "").replace(/\D/g, "").slice(-6);
  const coordKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const dedupeHash = createHash("sha256")
    .update(`${nameNorm}|${addrNorm}|${phoneLast6}|${coordKey}`)
    .digest("hex");

  // Public listing ref — matches persister pattern: #AC-YYYY-CROCKFORD5(dedupe_hash)
  // Crockford base32 alphabet · deterministic from hash · human-readable
  const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = Buffer.from(dedupeHash.slice(0, 10), "hex"); // 5 bytes = 40 bits → 8 crockford chars
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let ref5 = "";
  for (let i = 0; i < 5; i++) {
    ref5 = CROCKFORD[Number(bits & 0x1Fn)] + ref5;
    bits >>= 5n;
  }
  const year = new Date().getUTCFullYear();
  const publicListingRef = `#AC-${year}-${ref5}`;

  return {
    public_listing_ref: publicListingRef,
    business_name: name,
    category,
    city: cityCanonical, // NEVER from addr:city per doctrine
    coordinates_lat: lat,
    coordinates_lng: lon,
    address,
    phone: tags.phone ?? null,
    website: tags.website ?? null,
    star_rating: Number.isFinite(stars) && stars >= 1 && stars <= 5 ? stars : null,
    room_count: Number.isFinite(rooms) && rooms > 0 ? rooms : null,
    amenities: extractAmenities(tags),
    dedupe_hash: dedupeHash,
    source: "osm_overpass",
    source_reference: `node/${el.id}`,
    source_licence_terms: "openstreetmap:odbl-1.0",
    source_retrieved_at: new Date().toISOString(),
    raw_osm_tags: tags,
  };
}

// ─── Overpass fetch (with retry + rate-friendly pacing) ───────────
async function fetchOverpass(query, attempt = 0) {
  const BACKOFF = [1000, 3000, 8000, 15000];
  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "NEX-Harvester/1.0 (github.com/nex)" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (res.status === 429 || res.status === 504) {
      if (attempt >= BACKOFF.length) throw new Error(`overpass_rate_limited_after_${attempt}_attempts`);
      const waitMs = BACKOFF[attempt];
      console.log(`  overpass ${res.status} · backing off ${waitMs}ms (attempt ${attempt + 1})`);
      await sleep(waitMs);
      return fetchOverpass(query, attempt + 1);
    }
    if (!res.ok) throw new Error(`overpass_http_${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= BACKOFF.length) throw err;
    const waitMs = BACKOFF[attempt];
    console.log(`  overpass network err · backing off ${waitMs}ms (attempt ${attempt + 1}): ${String(err).slice(0, 100)}`);
    await sleep(waitMs);
    return fetchOverpass(query, attempt + 1);
  }
}

// ─── Optional Postgres persistence ────────────────────────────────
async function persistToPostgres(records, cityCanonical) {
  const pgUrl = process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? process.env.DATABASE_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
  const { Client } = await import("pg").catch(() => {
    console.error("  pg module not installed · dry-run only. Run: npm i pg");
    process.exit(2);
  });
  const client = new Client({ connectionString: pgUrl });
  await client.connect();
  console.log(`  persisting to ${pgUrl.split("@")[1] ?? pgUrl}`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const r of records) {
    try {
      // Check table exists
      const tableCheck = await client.query(
        `SELECT to_regclass('nex.accommodation_business') AS t`
      );
      if (!tableCheck.rows[0].t) {
        console.log("  nex.accommodation_business does not exist in this Postgres · dry-run write to jsonl instead");
        break;
      }
      // Upsert by dedupe_hash. public_listing_ref is deterministic from
      // the hash, so on collision the same ref surfaces. country is
      // hardcoded to "ID" (Indonesia) for our seed city list.
      const upsertSql = `
        INSERT INTO nex.accommodation_business
          (public_listing_ref, business_name, category, city, country, coordinates_lat, coordinates_lng,
           address, phone, website, star_rating, room_count, amenities,
           dedupe_hash, source, source_reference, source_licence_terms,
           source_retrieved_at, claim_status, owner_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'discovered', 'unknown')
        ON CONFLICT (dedupe_hash) DO UPDATE SET
          source_retrieved_at = EXCLUDED.source_retrieved_at
          WHERE nex.accommodation_business.source_retrieved_at IS NULL
             OR nex.accommodation_business.source_retrieved_at < EXCLUDED.source_retrieved_at
        RETURNING xmax = 0 AS was_inserted
      `;
      const result = await client.query(upsertSql, [
        r.public_listing_ref, r.business_name, r.category, r.city, "ID", r.coordinates_lat, r.coordinates_lng,
        r.address, r.phone, r.website, r.star_rating, r.room_count, r.amenities,
        r.dedupe_hash, r.source, r.source_reference, r.source_licence_terms,
        r.source_retrieved_at,
      ]);
      if (result.rows[0]?.was_inserted) inserted++;
      else updated++;
    } catch (err) {
      skipped++;
      if (skipped <= 3) console.log(`  persist err: ${String(err).slice(0, 200)}`);
    }
  }
  await client.end();
  return { inserted, updated, skipped };
}

// ─── Cache write · always land a jsonl for audit even on dry-run ──
function writeCache(records, cityCanonical) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "Z");
  const out = join(CACHE_DIR, `osm-${cityCanonical}-${ts}.jsonl`);
  writeFileSync(out, records.map((r) => JSON.stringify(r)).join("\n"), "utf8");
  return out;
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  const bbox = resolveBbox();
  const cityCanonical = CITY.toLowerCase();
  console.log(`\n[osm-harvest] city=${cityCanonical} bbox=${JSON.stringify(bbox)} persist=${PERSIST}`);
  const query = buildQuery(bbox);
  console.log(`[osm-harvest] querying ${OVERPASS} …`);
  const t0 = Date.now();
  const raw = await fetchOverpass(query);
  const fetchMs = Date.now() - t0;
  const elements = raw.elements ?? [];
  console.log(`[osm-harvest] fetched ${elements.length} elements in ${fetchMs}ms`);

  // Normalize + classify
  const records = [];
  const rejections = { no_name: 0, unknown_category: 0, no_coordinates: 0 };
  for (const el of elements) {
    if (records.length >= MAX_RESULTS) break;
    const n = normalizeElement(el, cityCanonical);
    if (n.rejected) { rejections[n.rejected]++; continue; }
    records.push(n);
  }

  console.log(`[osm-harvest] kept ${records.length} · rejected: no_name=${rejections.no_name} unknown_category=${rejections.unknown_category} no_coordinates=${rejections.no_coordinates}`);

  // Category breakdown
  const byCategory = {};
  for (const r of records) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  console.log(`[osm-harvest] by category:`, byCategory);

  // Sample 3
  console.log(`[osm-harvest] sample (first 3):`);
  for (const s of records.slice(0, 3)) {
    console.log(`  · ${s.business_name} [${s.category}] · ${s.coordinates_lat.toFixed(4)},${s.coordinates_lng.toFixed(4)}${s.phone ? " · " + s.phone : ""}${s.website ? " · " + s.website : ""}${s.amenities.length > 0 ? " · [" + s.amenities.join(",") + "]" : ""}`);
  }

  // Cache to jsonl
  const cachePath = writeCache(records, cityCanonical);
  console.log(`[osm-harvest] cached to ${cachePath}`);

  // Persist if requested
  if (PERSIST) {
    console.log(`[osm-harvest] persisting to Postgres …`);
    const stats = await persistToPostgres(records, cityCanonical);
    console.log(`[osm-harvest] persisted · inserted=${stats.inserted} updated=${stats.updated} skipped=${stats.skipped}`);
  } else {
    console.log(`[osm-harvest] dry-run · pass --persist to write to Postgres`);
  }

  const totalMs = Date.now() - t0;
  console.log(`[osm-harvest] complete · total ${totalMs}ms`);
}

main().catch((err) => {
  console.error(`[osm-harvest] FATAL: ${String(err)}`);
  process.exit(1);
});
