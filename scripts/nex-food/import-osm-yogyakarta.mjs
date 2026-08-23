#!/usr/bin/env node
// NEX Food · Yogyakarta OSM Overpass importer · Phase 2 of the acquisition
// pipeline (Philip 2026-08-21 greenlight · OSM primary + jogjakota validation).
//
// Fetches restaurant / cafe / fast_food / ice_cream POIs from OpenStreetMap
// (via Overpass API) inside the Kota Yogyakarta bounding box, normalises them
// into the nex.food_business shape, computes dedupe hashes, and inserts them
// with claim_status='discovered' and full provenance.
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-food/import-osm-yogyakarta.mjs [--limit=10]
//
//   --limit=N     insert at most N records total, roughly balanced across
//                 the 4 V1 categories. Default 10 (Phase 2 dry-run size).
//   --dry-run     do everything except the INSERT · print what WOULD land.
//   --all         no cap · ingest every named POI Overpass returns.
//
// LICENCE / PROVENANCE
//   Data source: © OpenStreetMap contributors · Open Database License (ODbL).
//   Attribution stored per-row in source_licence_terms and must be surfaced on
//   any UI that displays these records (per Business Acquisition Pipeline
//   doctrine + OSM ODbL terms).
//
// SAFE TO RE-RUN
//   Uses ON CONFLICT (dedupe_hash) DO NOTHING pattern — no duplicates get
//   inserted. If OSM adds a new POI, next run picks it up; existing rows are
//   left untouched (Phase 3 will add proper dedupe merge · Phase 4 will add
//   verification workflow).

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Local cache · avoids beating up public Overpass mirrors on every re-run.
const CACHE_DIR = join(__dirname, ".cache");
const CACHE_FILE = join(CACHE_DIR, "osm-yogyakarta.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;   // 24 h · Yogyakarta OSM doesn't change fast

// ── Constants ───────────────────────────────────────────────────────────────

// Kota Yogyakarta bounding box · approx (south, west, north, east).
// Not perfect — captures a little of the surrounding kecamatan too. Verification
// workflow (Phase 4) will admin-review edge cases. Fine for Phase 2 dry run.
const YOGYA_BBOX = [-7.85, 110.35, -7.75, 110.42];

// OSM amenity → NEX V1 category.
const AMENITY_TO_CATEGORY = {
  restaurant: "restaurant",
  cafe: "coffee-cafe",
  fast_food: "fast-food",
  ice_cream: "ice-cream-dessert",
};

const OSM_ODBL_LICENCE =
  "© OpenStreetMap contributors · Open Database License (ODbL) · https://www.openstreetmap.org/copyright";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const USER_AGENT = "NEX-Food-Pipeline/1.0";

// ── Argv parsing ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const argLimit = args.find((a) => a.startsWith("--limit="));
const limit = argLimit ? Number(argLimit.split("=")[1]) : 10;
const dryRun = args.includes("--dry-run");
const takeAll = args.includes("--all");

if (!Number.isFinite(limit) || limit < 1) {
  console.error(`--limit must be a positive integer, got ${argLimit}`);
  process.exit(1);
}

// ── Helpers (mirror src/lib/nex-food/schema.ts) ─────────────────────────────

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function formatPublicListingRef(year, id) {
  const digits = [];
  let n = id;
  for (let i = 0; i < 5; i++) {
    digits.unshift(CROCKFORD[n & 31] ?? "0");
    n >>>= 5;
  }
  return `#FL-${year}-${digits.join("")}`;
}

function computeDedupeHash({ businessName, address, phone, coordinatesLng, coordinatesLat }) {
  const nameNorm = businessName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const addrNorm = (address ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const phoneLast6 = (phone ?? "").replace(/\D+/g, "").slice(-6);
  const lngR = coordinatesLng != null ? coordinatesLng.toFixed(3) : "";
  const latR = coordinatesLat != null ? coordinatesLat.toFixed(3) : "";
  return [nameNorm, addrNorm, phoneLast6, latR, lngR].join("|");
}

// ── Overpass ───────────────────────────────────────────────────────────────

const OVERPASS_QUERY = `[out:json][timeout:60];
(
  node["amenity"~"^(restaurant|cafe|fast_food|ice_cream)$"](${YOGYA_BBOX.join(",")});
);
out body meta 2000;`;

function readCacheIfFresh() {
  if (!existsSync(CACHE_FILE)) return null;
  const ageMs = Date.now() - statSync(CACHE_FILE).mtimeMs;
  if (ageMs > CACHE_TTL_MS) return null;
  try {
    const raw = readFileSync(CACHE_FILE, "utf8");
    const json = JSON.parse(raw);
    console.log(`  overpass cache hit      : ${CACHE_FILE}  age=${Math.round(ageMs / 1000)}s`);
    console.log(`  raw elements returned   : ${json.elements?.length ?? 0}`);
    return { json, endpoint: "cache" };
  } catch {
    return null;
  }
}

function writeCache(json) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(json), "utf8");
}

async function fetchFromOverpass() {
  const cached = readCacheIfFresh();
  if (cached) return cached;

  const body = "data=" + encodeURIComponent(OVERPASS_QUERY);
  let lastErr;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    // 3 attempts per endpoint with jittered backoff · Overpass 5xx is common.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": USER_AGENT,
          },
          body,
          signal: AbortSignal.timeout(90_000),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${endpoint}`);
        const json = await resp.json();
        console.log(`  overpass endpoint used  : ${endpoint} (attempt ${attempt})`);
        console.log(`  raw elements returned   : ${json.elements?.length ?? 0}`);
        writeCache(json);
        return { json, endpoint };
      } catch (err) {
        lastErr = err;
        console.log(`  overpass ${endpoint} attempt ${attempt}: ${err.message}`);
        if (attempt < 3) {
          const delay = 2000 * attempt + Math.floor(Math.random() * 1000);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    console.log(`  overpass ${endpoint}: exhausted, trying next mirror...`);
  }
  throw new Error(`All Overpass mirrors failed: ${lastErr?.message}`);
}

// ── POI transform ──────────────────────────────────────────────────────────

function buildAddress(tags) {
  const parts = [
    [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ").trim(),
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter((p) => p && p.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

function extractSocialLinks(tags) {
  const links = {};
  if (tags["contact:instagram"] || tags.instagram) links.instagram = tags["contact:instagram"] ?? tags.instagram;
  if (tags["contact:facebook"] || tags.facebook) links.facebook = tags["contact:facebook"] ?? tags.facebook;
  if (tags["contact:twitter"] || tags.twitter) links.twitter = tags["contact:twitter"] ?? tags.twitter;
  if (tags["contact:tiktok"] || tags.tiktok) links.tiktok = tags["contact:tiktok"] ?? tags.tiktok;
  if (tags["contact:youtube"] || tags.youtube) links.youtube = tags["contact:youtube"] ?? tags.youtube;
  return Object.keys(links).length > 0 ? links : null;
}

function extractOpeningInformation(tags) {
  const hours = tags.opening_hours;
  if (!hours) return null;
  // V1 · store the raw OSM opening_hours string verbatim + timezone hint.
  // Phase 4 verification workflow will parse it into the structured
  // NexFoodOpeningInformation shape when we're ready to support that UI.
  return {
    timezone: "Asia/Jakarta",
    notes: `OSM opening_hours: ${hours}`,
  };
}

function transformOsmNode(element, indexAmongCategory) {
  const t = element.tags ?? {};
  const amenity = t.amenity;
  const category = AMENITY_TO_CATEGORY[amenity];
  if (!category) return null;
  if (!t.name || t.name.trim().length === 0) return null;

  const phone = t["contact:phone"] ?? t.phone ?? null;
  const website = t["contact:website"] ?? t.website ?? null;
  const address = buildAddress(t);
  const coordinatesLat = typeof element.lat === "number" ? element.lat : null;
  const coordinatesLng = typeof element.lon === "number" ? element.lon : null;

  return {
    businessName: t.name.trim(),
    category,
    address,
    city: "Yogyakarta",
    district: t["addr:suburb"] ?? t["addr:district"] ?? null,
    coordinatesLat,
    coordinatesLng,
    phone,
    whatsappNumber: null,        // owner-supplied later (Phase 5/6 outreach + claim)
    website,
    publicSocialLinks: extractSocialLinks(t),
    openingInformation: extractOpeningInformation(t),
    source: "openstreetmap_overpass_v1",
    sourceReference: `osm/node/${element.id}`,
    sourceIngestedAt: new Date().toISOString(),
    sourceLicenceTerms: OSM_ODBL_LICENCE,
    dedupeHash: computeDedupeHash({
      businessName: t.name.trim(),
      address,
      phone,
      coordinatesLng,
      coordinatesLat,
    }),
    createdBy: "osm_yogyakarta_importer_v1",
  };
}

// ── Balanced dry-run selection ─────────────────────────────────────────────

function pickBalanced(records, target) {
  const perCategory = Math.max(1, Math.floor(target / 4));
  const buckets = {
    "restaurant": [],
    "coffee-cafe": [],
    "ice-cream-dessert": [],
    "fast-food": [],
  };
  for (const r of records) buckets[r.category]?.push(r);
  // Preference: records with the richest data (phone + website + hours) first.
  const rank = (r) =>
    (r.phone ? 1 : 0) + (r.website ? 1 : 0) + (r.openingInformation ? 1 : 0);
  for (const k of Object.keys(buckets)) buckets[k].sort((a, b) => rank(b) - rank(a));
  const picked = [];
  for (const k of Object.keys(buckets)) picked.push(...buckets[k].slice(0, perCategory));
  // Top up to target from remaining pool if any category is thin (e.g. ice_cream).
  const usedIds = new Set(picked.map((r) => r.sourceReference));
  const remaining = records
    .filter((r) => !usedIds.has(r.sourceReference))
    .sort((a, b) => rank(b) - rank(a));
  while (picked.length < target && remaining.length > 0) picked.push(remaining.shift());
  return picked.slice(0, target);
}

// ── Insert ─────────────────────────────────────────────────────────────────

// Merge-policy-aware fields · these are the only fields an OSM re-import can
// touch on an existing row, AND only when the field's current provenance is
// 'source_import' or NULL. Owner/admin verified fields are never overwritten.
const OSM_IMPORT_FIELDS = [
  "business_name","category","address","city","district",
  "coordinates_lng","coordinates_lat","phone","whatsapp_number","website",
  "public_social_links","opening_information",
];

const INSERT_SQL = `
INSERT INTO nex.food_business (
  public_listing_ref,
  business_name, category, address, city, district,
  coordinates_lng, coordinates_lat,
  phone, whatsapp_number, website, public_social_links, opening_information,
  source, source_reference, source_ingested_at, source_licence_terms,
  dedupe_hash,
  claim_status, owner_status,
  hero_image_url, hero_image_source, hero_image_approved, hero_image_provenance,
  rating, rating_source, review_count, review_count_source,
  created_by
) VALUES (
  $1,
  $2, $3, $4, $5, $6,
  $7, $8,
  $9, $10, $11, $12, $13,
  $14, $15, $16, $17,
  $18,
  'discovered', 'unknown',
  NULL, NULL, false, NULL,
  NULL, NULL, NULL, NULL,
  $19
)
ON CONFLICT DO NOTHING
RETURNING public_listing_ref, business_name, category, district
`;

async function writeSnapshot(pool, r, businessRefOrNull) {
  // Always write an immutable snapshot per import event · per pinned layered
  // discovery doctrine. Even skipped re-imports get a snapshot so we have a
  // full history of what OSM said and when.
  await pool.query(
    `INSERT INTO nex.food_business_source_snapshot
       (business_ref, source, source_reference, source_ingested_at,
        source_licence_terms, raw_payload, ingested_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (source, source_reference, source_ingested_at) DO NOTHING`,
    [
      businessRefOrNull, r.source, r.sourceReference, r.sourceIngestedAt,
      r.sourceLicenceTerms, JSON.stringify(r), r.createdBy,
    ]
  );
}

async function writeInitialProvenance(pool, publicRef, r) {
  // On fresh insert, every populated field starts as 'source_import'.
  for (const field of OSM_IMPORT_FIELDS) {
    const camel = field.replace(/_(\w)/g, (_, c) => c.toUpperCase());
    const value = r[camel];
    if (value == null) continue;
    await pool.query(
      `INSERT INTO nex.food_business_field_provenance
         (business_ref, field_name, trust_layer, written_at, written_by, source_reference)
       VALUES ($1, $2, 'source_import', $3, $4, $5)
       ON CONFLICT (business_ref, field_name) DO NOTHING`,
      [publicRef, field, r.sourceIngestedAt, r.createdBy, r.sourceReference]
    );
  }
}

async function insertRecord(pool, r, publicRef) {
  const params = [
    publicRef,
    r.businessName, r.category, r.address, r.city, r.district,
    r.coordinatesLng, r.coordinatesLat,
    r.phone, r.whatsappNumber, r.website,
    r.publicSocialLinks ? JSON.stringify(r.publicSocialLinks) : null,
    r.openingInformation ? JSON.stringify(r.openingInformation) : null,
    r.source, r.sourceReference, r.sourceIngestedAt, r.sourceLicenceTerms,
    r.dedupeHash,
    r.createdBy,
  ];
  const result = await pool.query(INSERT_SQL, params);
  const row = result.rows[0] ?? null;
  if (row) {
    await writeSnapshot(pool, r, publicRef);
    await writeInitialProvenance(pool, publicRef, r);
  } else {
    // Row already exists (dedupe_hash collision handled at UI/report level
    // via Phase 3 scanner). Snapshot the import event with null business_ref
    // so the raw fact of the fetch is preserved.
    await writeSnapshot(pool, r, null);
  }
  return row;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    console.error("NEX_POSTGRES_URL not set · aborting");
    process.exit(1);
  }

  console.log("── NEX Food · Yogyakarta OSM Overpass Import ──");
  console.log(`  mode                    : ${dryRun ? "DRY RUN (no INSERTs)" : "APPLY"}`);
  console.log(`  target rows             : ${takeAll ? "ALL" : limit}`);
  console.log(`  bounding box (S,W,N,E)  : ${YOGYA_BBOX.join(", ")}`);
  console.log("");

  const { json } = await fetchFromOverpass();
  const raw = json.elements ?? [];
  const transformed = raw.map((e, i) => transformOsmNode(e, i)).filter(Boolean);
  console.log(`  transformed records     : ${transformed.length}`);

  const perCategory = {};
  for (const r of transformed) perCategory[r.category] = (perCategory[r.category] ?? 0) + 1;
  console.log(`  per-category counts     :`);
  for (const [k, v] of Object.entries(perCategory)) console.log(`    ${k.padEnd(22)} ${v}`);
  console.log("");

  const toInsert = takeAll ? transformed : pickBalanced(transformed, limit);
  console.log(`  selected for insert     : ${toInsert.length}`);
  const selectedByCategory = {};
  for (const r of toInsert) selectedByCategory[r.category] = (selectedByCategory[r.category] ?? 0) + 1;
  for (const [k, v] of Object.entries(selectedByCategory)) console.log(`    ${k.padEnd(22)} ${v}`);
  console.log("");

  if (dryRun) {
    console.log("── DRY RUN · would insert these records ──");
    toInsert.forEach((r, i) => {
      const ref = formatPublicListingRef(2026, i + 1);
      console.log(`  ${ref}  [${r.category}]  ${r.businessName}`);
      console.log(`      addr=${r.address ?? "—"}`);
      console.log(`      phone=${r.phone ?? "—"}  website=${r.website ?? "—"}`);
      console.log(`      lat=${r.coordinatesLat}  lng=${r.coordinatesLng}`);
      console.log(`      dedupe=${r.dedupeHash.slice(0, 60)}...`);
    });
    console.log("");
    console.log("PASS · dry run complete · no DB writes performed");
    process.exit(0);
  }

  const pool = new pg.Pool({ connectionString: url });

  // Pre-load existing dedupe_hashes so we skip already-ingested POIs cheaply
  // instead of relying on unique-constraint failures (dedupe_hash is not
  // unique · Phase 3 scanner handles fuzzy near-duplicates separately).
  const existing = await pool.query(
    `SELECT dedupe_hash FROM nex.food_business WHERE source = 'openstreetmap_overpass_v1'`
  );
  const seenHashes = new Set(existing.rows.map((r) => r.dedupe_hash));

  // Compute the next public_listing_ref counter so re-runs never collide.
  const maxRef = await pool.query(
    `SELECT public_listing_ref FROM nex.food_business
     WHERE public_listing_ref LIKE '#FL-2026-%'
     ORDER BY public_listing_ref DESC LIMIT 1`
  );
  const CROCKFORD_LOCAL = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let nextCounter = 1;
  if (maxRef.rowCount > 0) {
    // Decode the 5-char Crockford suffix back to an integer
    const suffix = maxRef.rows[0].public_listing_ref.split("-").at(-1);
    if (suffix && suffix.length === 5) {
      let n = 0;
      for (const c of suffix) {
        const v = CROCKFORD_LOCAL.indexOf(c);
        if (v < 0) { n = 0; break; }
        n = (n << 5) + v;
      }
      nextCounter = n + 1;
    }
  }

  let inserted = 0;
  let skipped = 0;
  let dedupeSkipped = 0;

  for (const r of toInsert) {
    if (seenHashes.has(r.dedupeHash)) {
      dedupeSkipped++;
      continue;   // already in DB from a prior run · quiet skip
    }
    const publicRef = formatPublicListingRef(2026, nextCounter++);
    try {
      const row = await insertRecord(pool, r, publicRef);
      if (row) {
        inserted++;
        seenHashes.add(r.dedupeHash);
        if (inserted <= 10 || inserted % 50 === 0) {
          console.log(`  ✓ inserted ${row.public_listing_ref}  [${row.category}]  ${row.business_name}`);
        }
      } else {
        skipped++;
        console.log(`  · skipped (constraint) ${publicRef}  ${r.businessName}`);
      }
    } catch (err) {
      console.log(`  ✗ FAILED  ${publicRef}  ${r.businessName}: ${err.message}`);
    }
  }

  await pool.end();

  console.log("");
  console.log(`── Summary ──`);
  console.log(`  inserted           : ${inserted}`);
  console.log(`  skipped (dedupe)   : ${dedupeSkipped}`);
  console.log(`  skipped (conflict) : ${skipped}`);
  console.log(`  attempted          : ${toInsert.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
