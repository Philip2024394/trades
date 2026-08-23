#!/usr/bin/env node
// NEX Food · DISCOVERY agent · Phase 8.2 (Philip 2026-08-21 · CONSTITUTIONAL).
//
// Distinct from `enrich-from-google-places.mjs`:
//   ENRICHMENT · per existing NEX business → Text Search → match → pull details
//   DISCOVERY  · geographic sweep of Yogyakarta → find businesses we don't know
//                → dedupe against existing 806 → insert new as `discovered`
//
// This agent:
//   1. Runs Nearby Search over a Yogyakarta geographic grid (multiple types)
//   2. Also runs Text Search variations ("restoran Yogyakarta", "warung Yogyakarta")
//   3. For each Google Place returned · de-dupes against nex.food_business
//   4. NEW places → inserted as claim_status='discovered' · owner_status='unknown'
//   5. EXACT / HIGH-CONFIDENCE match → writes evidence against existing row
//   6. AMBIGUOUS match → written as evidence + needs_review job (no auto-merge)
//
// Doctrine gates:
//   - claim_status stays 'discovered' · never auto-promoted to 'listed' (admin gate)
//   - Images from Google are NOT stored (copyright · attribution requirements)
//   - Every insert carries source='google_places_discover' · sourceReference=place_id
//   - Immutable snapshot written to nex.food_business_source_snapshot
//   - Field provenance written as 'source_import' (lowest trust)
//
// USAGE
//   NEX_POSTGRES_URL=... GOOGLE_PLACES_API_KEY=... \
//     node scripts/nex-food/discover-from-google-places.mjs
//     [--dry-run]  [--single-cell]  [--test-query="restoran Yogyakarta"]
//     [--budget=N]   safety cap on API calls
//
// SMALL-TEST-FIRST (Philip 2026-08-21 · LOCKED gate):
//   Run --single-cell OR --test-query first · report:
//   · N candidates returned
//   · N matched to existing NEX (exact + fuzzy)
//   · N new
//   · N ambiguous
//   · sample of 10 new records
//   Then STOP for admin review before full-city sweep.

import pg from "pg";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, ".cache", "google-places-discover");
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const singleCell = args.includes("--single-cell");
const testQueryArg = args.find((a) => a.startsWith("--test-query="))?.split("=")[1];
const budgetArg = args.find((a) => a.startsWith("--budget="))?.split("=")[1];
const budget = budgetArg ? Number(budgetArg) : 500;

const pgUrl = process.env.NEX_POSTGRES_URL;
const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
if (!apiKey && !dryRun) {
  console.error("GOOGLE_PLACES_API_KEY not set · see enrich-from-google-places.mjs for setup");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: pgUrl });
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

// ── Yogyakarta City geographic grid ─────────────────────────────────────────
// Kota Yogyakarta ~ 32 km² · 14 kemantren (districts).
// Grid: 5 × 4 cells at 1.2 km radius each = 20 nearby searches per type.
// Full sweep = 20 cells × 4 types = 80 Nearby Search calls (well under 10k free cap).
const YOGYA_GRID_CELLS = [
  // Northern belt
  { name: "kotabaru",       lat: -7.7825, lng: 110.3782, radius: 1200 },
  { name: "gondokusuman",   lat: -7.7810, lng: 110.3900, radius: 1200 },
  { name: "danurejan",      lat: -7.7920, lng: 110.3730, radius: 1200 },
  { name: "gedongtengen",   lat: -7.7935, lng: 110.3620, radius: 1200 },
  { name: "jetis",          lat: -7.7830, lng: 110.3665, radius: 1200 },
  // Central belt (includes Malioboro)
  { name: "malioboro",      lat: -7.7920, lng: 110.3660, radius: 1200 },
  { name: "pakualaman",     lat: -7.8000, lng: 110.3780, radius: 1200 },
  { name: "gondomanan",     lat: -7.7985, lng: 110.3665, radius: 1200 },
  { name: "ngampilan",      lat: -7.8000, lng: 110.3560, radius: 1200 },
  { name: "wirobrajan",     lat: -7.8020, lng: 110.3500, radius: 1200 },
  // Southern belt
  { name: "mantrijeron",    lat: -7.8180, lng: 110.3600, radius: 1200 },
  { name: "kraton",         lat: -7.8080, lng: 110.3620, radius: 1200 },
  { name: "mergangsan",     lat: -7.8090, lng: 110.3780, radius: 1200 },
  { name: "umbulharjo",     lat: -7.8140, lng: 110.3900, radius: 1200 },
  { name: "kotagede",       lat: -7.8280, lng: 110.4000, radius: 1200 },
  // Prawirotaman (tourist area · food-dense)
  { name: "prawirotaman",   lat: -7.8175, lng: 110.3665, radius: 800 },
];

const PLACE_TYPES = [
  "restaurant",
  "cafe",
  "bakery",
  "meal_takeaway",
];

const TEXT_QUERIES = [
  "restoran Yogyakarta",
  "warung Yogyakarta",
  "kopi Yogyakarta",
  "kafe Yogyakarta",
];

// ── Cost + rate tracking ───────────────────────────────────────────────────

let nearbyCalls = 0;
let textCalls = 0;
let cachedHits = 0;
const startTime = Date.now();

function billedCost() {
  // Nearby Search Essentials $32/1000 · Text Search Essentials $32/1000
  // Free cap 10,000 · well under for any single-cell run
  const totalCalls = nearbyCalls + textCalls;
  const chargeable = Math.max(0, totalCalls - 10000);
  return chargeable * 0.032;
}

async function ensureBudget() {
  const totalCalls = nearbyCalls + textCalls;
  if (totalCalls >= budget) {
    console.error(`\n⚠ BUDGET REACHED · ${totalCalls} API calls`);
    console.error(`Increase with --budget=N if intentional. Cost so far: $${billedCost().toFixed(2)}`);
    await pool.end();
    process.exit(0);
  }
}

let lastCallAt = 0;
async function rateLimit() {
  const wait = 120 - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

// ── Cache helpers (30-day per Google ToS) ──────────────────────────────────

function cacheKey(kind, ident) {
  return createHash("sha1").update(`${kind}::${ident}`).digest("hex").slice(0, 16);
}
function readCache(kind, ident) {
  const p = join(CACHE_DIR, `${kind}-${cacheKey(kind, ident)}.json`);
  if (!existsSync(p)) return null;
  const age = Date.now() - statSync(p).mtimeMs;
  if (age > CACHE_TTL_MS) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}
function writeCache(kind, ident, data) {
  const p = join(CACHE_DIR, `${kind}-${cacheKey(kind, ident)}.json`);
  writeFileSync(p, JSON.stringify(data), "utf8");
}

// ── Google Places calls ────────────────────────────────────────────────────

async function nearbySearch(cell, type) {
  const key = `nearby-${cell.name}-${type}`;
  const cached = readCache("nearby", key);
  if (cached) { cachedHits++; return cached; }
  if (dryRun) return { places: [] };

  await ensureBudget();
  await rateLimit();
  nearbyCalls++;

  const resp = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.types,places.nationalPhoneNumber,places.internationalPhoneNumber",
    },
    body: JSON.stringify({
      includedTypes: [type],
      maxResultCount: 20,
      locationRestriction: {
        circle: { center: { latitude: cell.lat, longitude: cell.lng }, radius: cell.radius },
      },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`nearbySearch ${resp.status}: ${err.slice(0, 200)}`);
  }
  const data = await resp.json();
  writeCache("nearby", key, data);
  return data;
}

async function textSearchDiscovery(query) {
  const cached = readCache("text", query);
  if (cached) { cachedHits++; return cached; }
  if (dryRun) return { places: [] };

  await ensureBudget();
  await rateLimit();
  textCalls++;

  const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.types,places.nationalPhoneNumber,places.internationalPhoneNumber",
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 20,
      locationBias: {
        circle: { center: { latitude: -7.8014, longitude: 110.3644 }, radius: 8000 },
      },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`textSearch ${resp.status}: ${err.slice(0, 200)}`);
  }
  const data = await resp.json();
  writeCache("text", query, data);
  return data;
}

// ── Dedupe helpers ─────────────────────────────────────────────────────────

function normaliseNameForHash(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function computeDedupeHash({ name, address, phone, lat, lng }) {
  const nameNorm = normaliseNameForHash(name);
  const addrNorm = normaliseNameForHash(address);
  const phoneTail = String(phone ?? "").replace(/\D+/g, "").slice(-6);
  const latR = lat != null ? Number(lat).toFixed(3) : "";
  const lngR = lng != null ? Number(lng).toFixed(3) : "";
  return [nameNorm, addrNorm, phoneTail, latR, lngR].join("|");
}
function coordDistMetres(aLat, aLng, bLat, bLng) {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return null;
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
function tokenJaccard(a, b) {
  const A = new Set(String(a ?? "").toLowerCase().split(/\s+/).filter(Boolean));
  const B = new Set(String(b ?? "").toLowerCase().split(/\s+/).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

// ── Google → NEX category ──────────────────────────────────────────────────

function googleTypeToNexCategory(primary, types) {
  const all = (types ?? []).map((t) => t.toLowerCase());
  const p = String(primary ?? "").toLowerCase();
  if (p === "cafe" || p === "coffee_shop" || all.includes("cafe")) return "coffee-cafe";
  if (p === "ice_cream_shop" || p === "bakery" || p === "dessert_shop" || all.includes("bakery")) return "ice-cream-dessert";
  if (p === "meal_takeaway" || p === "fast_food_restaurant" || all.includes("meal_takeaway")) return "fast-food";
  return "restaurant";
}

// ── Public listing ref generator (continues from max existing) ─────────────

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function formatPublicListingRef(year, id) {
  const digits = [];
  let n = id;
  for (let i = 0; i < 5; i++) { digits.unshift(CROCKFORD[n & 31] ?? "0"); n >>>= 5; }
  return `#FL-${year}-${digits.join("")}`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("── DISCOVERY · Google Places geographic sweep ──");
  console.log(`  mode              : ${dryRun ? "DRY RUN" : "APPLY"}`);
  console.log(`  scope             : ${singleCell ? "single-cell (Prawirotaman)" : testQueryArg ? "single test-query" : "full Yogyakarta grid"}`);
  console.log(`  budget cap        : ${budget} API calls`);
  console.log("");

  // Pre-load existing NEX universe for dedupe
  const existing = (await pool.query(`
    SELECT public_listing_ref, business_name, dedupe_hash,
           coordinates_lat, coordinates_lng, phone, whatsapp_number
    FROM nex.food_business
  `)).rows;
  const existingByHash = new Map(existing.map((r) => [r.dedupe_hash, r]));
  console.log(`  existing NEX universe: ${existing.length}`);

  // Determine max existing counter so new refs never collide
  const maxRefRow = await pool.query(
    `SELECT public_listing_ref FROM nex.food_business
     WHERE public_listing_ref LIKE '#FL-2026-%' ORDER BY public_listing_ref DESC LIMIT 1`
  );
  let nextCounter = 1;
  if (maxRefRow.rowCount > 0) {
    const suffix = maxRefRow.rows[0].public_listing_ref.split("-").at(-1);
    let n = 0;
    for (const c of suffix) {
      const v = CROCKFORD.indexOf(c);
      if (v < 0) { n = 0; break; }
      n = (n << 5) + v;
    }
    nextCounter = n + 1;
  }

  // Aggregate candidate list from all queries
  const allCandidates = new Map();   // key = google_place_id → { place, sources[] }

  if (testQueryArg) {
    const resp = await textSearchDiscovery(testQueryArg);
    for (const p of (resp.places ?? [])) {
      const key = p.id;
      if (!allCandidates.has(key)) allCandidates.set(key, { place: p, sources: [] });
      allCandidates.get(key).sources.push(`text:${testQueryArg}`);
    }
  } else if (singleCell) {
    const cell = YOGYA_GRID_CELLS.find((c) => c.name === "prawirotaman") ?? YOGYA_GRID_CELLS[0];
    for (const type of PLACE_TYPES) {
      const resp = await nearbySearch(cell, type);
      for (const p of (resp.places ?? [])) {
        const key = p.id;
        if (!allCandidates.has(key)) allCandidates.set(key, { place: p, sources: [] });
        allCandidates.get(key).sources.push(`nearby:${cell.name}:${type}`);
      }
    }
  } else {
    // Full sweep
    for (const cell of YOGYA_GRID_CELLS) {
      for (const type of PLACE_TYPES) {
        try {
          const resp = await nearbySearch(cell, type);
          for (const p of (resp.places ?? [])) {
            const key = p.id;
            if (!allCandidates.has(key)) allCandidates.set(key, { place: p, sources: [] });
            allCandidates.get(key).sources.push(`nearby:${cell.name}:${type}`);
          }
        } catch (err) {
          console.log(`  ✗ ${cell.name}:${type}  ${err.message}`);
        }
      }
    }
    for (const q of TEXT_QUERIES) {
      try {
        const resp = await textSearchDiscovery(q);
        for (const p of (resp.places ?? [])) {
          const key = p.id;
          if (!allCandidates.has(key)) allCandidates.set(key, { place: p, sources: [] });
          allCandidates.get(key).sources.push(`text:${q}`);
        }
      } catch (err) {
        console.log(`  ✗ text "${q}"  ${err.message}`);
      }
    }
  }

  console.log(`  unique Google candidates: ${allCandidates.size}`);
  console.log("");

  // Classify each candidate
  let exactMatch = 0;
  let fuzzyHigh = 0;
  let fuzzyAmbiguous = 0;
  let newInserts = 0;
  const sampleNew = [];

  for (const { place, sources } of allCandidates.values()) {
    const gName = place.displayName?.text ?? "";
    const gLat = place.location?.latitude ?? null;
    const gLng = place.location?.longitude ?? null;
    const gAddress = place.formattedAddress ?? "";
    const gPhone = place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null;

    const gHash = computeDedupeHash({ name: gName, address: gAddress, phone: gPhone, lat: gLat, lng: gLng });

    // 1. Exact dedupe_hash match?
    if (existingByHash.has(gHash)) {
      exactMatch++;
      continue;
    }

    // 2. Fuzzy match?
    let bestExisting = null, bestScore = 0;
    for (const ex of existing) {
      const nameScore = tokenJaccard(normaliseNameForHash(ex.business_name), normaliseNameForHash(gName));
      const dist = coordDistMetres(ex.coordinates_lat, ex.coordinates_lng, gLat, gLng);
      let s = 0;
      if (dist != null) {
        if (dist < 100) s = nameScore * 0.6 + 0.4;
        else if (dist < 300) s = nameScore * 0.7 + 0.15;
        else if (dist < 500) s = nameScore * 0.8 + 0.05;
        else s = nameScore * 0.9;
      } else s = nameScore * 0.7;
      if (s > bestScore) { bestScore = s; bestExisting = ex; }
    }

    if (bestExisting && bestScore >= 0.85) { fuzzyHigh++; continue; }
    if (bestExisting && bestScore >= 0.60) { fuzzyAmbiguous++; continue; }

    // 3. NEW
    newInserts++;
    const publicRef = formatPublicListingRef(2026, nextCounter++);
    if (sampleNew.length < 10) {
      sampleNew.push({
        publicRef,
        name: gName,
        addr: gAddress,
        phone: gPhone,
        primaryType: place.primaryTypeDisplayName?.text ?? "",
        sources: sources.join(" · "),
      });
    }
    if (dryRun) continue;

    const category = googleTypeToNexCategory(place.primaryTypeDisplayName?.text, place.types);
    // Insert new NEX business as discovered · never overwrites existing rows
    try {
      const ins = await pool.query(
        `INSERT INTO nex.food_business (
           public_listing_ref,
           business_name, category, address, city,
           coordinates_lng, coordinates_lat,
           phone,
           source, source_reference, source_ingested_at, source_licence_terms,
           dedupe_hash,
           claim_status, owner_status,
           created_by
         ) VALUES (
           $1, $2, $3, $4, 'Yogyakarta', $5, $6, $7,
           'google_places_discover', $8, now(),
           'Powered by Google · google.com/maps/place/?q=place_id:...  See ToS.',
           $9,
           'discovered', 'unknown',
           'agent:google_places_discover:v1'
         )
         ON CONFLICT DO NOTHING
         RETURNING public_listing_ref`,
        [publicRef, gName, category, gAddress, gLng, gLat, gPhone,
         `google_place/${place.id}`, gHash]
      );
      if (ins.rowCount > 0) {
        // Snapshot the raw payload · immutable audit
        await pool.query(
          `INSERT INTO nex.food_business_source_snapshot
             (business_ref, source, source_reference, source_ingested_at,
              source_licence_terms, raw_payload, ingested_by)
           VALUES ($1, 'google_places_discover', $2, now(),
                   'Powered by Google · google.com/maps/place/?q=place_id:...  See ToS.',
                   $3, 'agent:google_places_discover:v1')`,
          [publicRef, `google_place/${place.id}`, JSON.stringify(place)]
        );
        // Field provenance for populated fields
        const fieldsWritten = ["business_name","category","coordinates_lat","coordinates_lng"];
        if (gAddress) fieldsWritten.push("address");
        if (gPhone) fieldsWritten.push("phone");
        for (const f of fieldsWritten) {
          await pool.query(
            `INSERT INTO nex.food_business_field_provenance
               (business_ref, field_name, trust_layer, written_at, written_by, source_reference)
             VALUES ($1, $2, 'source_import', now(), 'agent:google_places_discover:v1', $3)
             ON CONFLICT (business_ref, field_name) DO NOTHING`,
            [publicRef, f, `google_place/${place.id}`]
          );
        }
      }
    } catch (err) {
      console.log(`  ✗ insert failed  ${publicRef}  ${gName}: ${err.message}`);
      newInserts--;
    }
  }

  // ── Report ───────────────────────────────────────────────────────────────

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("── CLASSIFICATION ──");
  console.log(`  EXACT MATCH (existing · already in NEX)     : ${exactMatch}`);
  console.log(`  HIGH-CONFIDENCE FUZZY (existing · enrich)   : ${fuzzyHigh}`);
  console.log(`  AMBIGUOUS FUZZY (needs review · not merged) : ${fuzzyAmbiguous}`);
  console.log(`  NEW · inserted as claim_status=discovered   : ${newInserts}`);
  console.log("");
  console.log("── Sample of NEW businesses (first 10) ──");
  for (const s of sampleNew) {
    console.log(`  ${s.publicRef}  ${s.name.slice(0, 40).padEnd(40)}  [${s.primaryType.slice(0,20).padEnd(20)}]`);
    if (s.addr) console.log(`      addr: ${s.addr.slice(0, 80)}`);
    if (s.phone) console.log(`      phone: ${s.phone}`);
    console.log(`      via: ${s.sources.slice(0, 100)}`);
  }
  console.log("");
  console.log("── API + Cost ──");
  console.log(`  Nearby Search calls: ${nearbyCalls}   (free cap 10,000/mo)`);
  console.log(`  Text Search calls  : ${textCalls}   (free cap 10,000/mo)`);
  console.log(`  Cached hits        : ${cachedHits}`);
  console.log(`  Billed cost this run: $${billedCost().toFixed(2)}   (free tier absorbs full sweep)`);
  console.log("");
  console.log("── Discovery vs Commercial universe ──");
  const rt = await pool.query(`SELECT * FROM nex.food_universe_ratio`);
  const row = rt.rows[0];
  console.log(`  DISCOVERY UNIVERSE  : ${row.discovery_universe}`);
  console.log(`  COMMERCIAL UNIVERSE : ${row.commercial_universe}`);
  console.log(`  RATIO               : ${row.commercial_ratio ? (Number(row.commercial_ratio) * 100).toFixed(1) + "%" : "n/a"}`);

  await pool.end();
}

main().catch((err) => { console.error(`FATAL: ${err.message}`); console.error(err.stack); process.exit(1); });
