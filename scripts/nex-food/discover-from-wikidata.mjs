#!/usr/bin/env node
// NEX Food · Wikidata SPARQL discovery agent · Phase 8.2c.
//
// Queries Wikidata's public SPARQL endpoint for food establishments in
// Yogyakarta. CC0 licence · no API key · no billing · no attribution required
// (courtesy backlink appropriate).
//
// Two complementary queries run:
//   1. Admin-hierarchy query · items whose "located in administrative
//      territorial entity" (P131) transitively resolves to Yogyakarta City
//      (Q3894), Sleman (Q3819), Bantul (Q3820) — the food-relevant admin area
//   2. Bounding-box geo query · any Wikidata item with coordinates inside
//      the Yogyakarta City bounding box AND instance-of a food establishment
//
// Wikidata concepts used:
//   Q11707       · restaurant
//   Q30022       · cafe
//   Q17103293    · fast food restaurant
//   Q848313      · coffeehouse
//   Q149566      · bakery
//   Q839954      · culinary institution (broad · subclass of catering)
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-food/discover-from-wikidata.mjs
//     [--dry-run]

import pg from "pg";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, ".cache", "wikidata");
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const pgUrl = process.env.NEX_POSTGRES_URL;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

const pool = new pg.Pool({ connectionString: pgUrl });
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

// Wikidata REQUIRES an identifying User-Agent (they enforce this)
const UA = "NEX-Food-Discovery/1.0 (https://nex.example/food; philip@nex.example) · SPARQL discovery for Yogyakarta food listings · respects rate limits";
const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const FETCH_TIMEOUT_MS = 60000;   // SPARQL queries can be slow

// Admin-hierarchy query · everything under Yogyakarta / Sleman / Bantul admin
// that is a food establishment. Uses P31/P279* to include subclasses.
const ADMIN_QUERY = `
SELECT DISTINCT ?item ?itemLabel ?coord ?website ?phone ?address ?instanceOfLabel ?adminLabel WHERE {
  VALUES ?type { wd:Q11707 wd:Q30022 wd:Q17103293 wd:Q848313 wd:Q149566 wd:Q839954 }
  ?item wdt:P31/wdt:P279* ?type.
  ?item wdt:P131* ?admin.
  VALUES ?admin { wd:Q3894 wd:Q3819 wd:Q3820 }
  OPTIONAL { ?item wdt:P625 ?coord. }
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL { ?item wdt:P1329 ?phone. }
  OPTIONAL { ?item wdt:P969 ?address. }
  OPTIONAL { ?item wdt:P31 ?instanceOf. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,id". }
}
LIMIT 500
`;

// Bounding-box geo query · Yogyakarta City rough bbox
// SW (-7.85, 110.35) · NE (-7.75, 110.42) · matches our OSM sweep bbox
const GEO_QUERY = `
SELECT DISTINCT ?item ?itemLabel ?coord ?website ?phone ?address ?instanceOfLabel WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(110.35 -7.85)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(110.42 -7.75)"^^geo:wktLiteral .
  }
  VALUES ?type { wd:Q11707 wd:Q30022 wd:Q17103293 wd:Q848313 wd:Q149566 wd:Q839954 }
  ?item wdt:P31/wdt:P279* ?type.
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL { ?item wdt:P1329 ?phone. }
  OPTIONAL { ?item wdt:P969 ?address. }
  OPTIONAL { ?item wdt:P31 ?instanceOf. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,id". }
}
LIMIT 500
`;

// ── Cache helpers (30-day · SPARQL results are stable) ─────────────────────

function cacheKey(name) {
  return createHash("sha1").update(name).digest("hex").slice(0, 16);
}
function readCache(name) {
  const p = join(CACHE_DIR, `${cacheKey(name)}.json`);
  if (!existsSync(p)) return null;
  const age = Date.now() - statSync(p).mtimeMs;
  if (age > CACHE_TTL_MS) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}
function writeCache(name, data) {
  const p = join(CACHE_DIR, `${cacheKey(name)}.json`);
  writeFileSync(p, JSON.stringify(data), "utf8");
}

// ── SPARQL client ──────────────────────────────────────────────────────────

async function sparqlQuery(name, query) {
  const cached = readCache(name);
  if (cached) return { cached: true, data: cached };

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/sparql-results+json",
        "User-Agent": UA,
      },
      body: "query=" + encodeURIComponent(query),
      signal: ac.signal,
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(`SPARQL ${resp.status}: ${err.slice(0, 200)}`);
    }
    const data = await resp.json();
    writeCache(name, data);
    return { cached: false, data };
  } finally { clearTimeout(t); }
}

// Parse Wikidata Point WKT · "Point(110.3644 -7.8014)" → { lat, lng }
function parseWktPoint(wkt) {
  if (!wkt) return { lat: null, lng: null };
  const m = String(wkt).match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!m) return { lat: null, lng: null };
  return { lng: Number(m[1]), lat: Number(m[2]) };
}

// Category mapping · Wikidata instance-of label → NEX category
function wikidataInstanceToNexCategory(instanceLabel) {
  const s = String(instanceLabel ?? "").toLowerCase();
  if (s.includes("cafe") || s.includes("café") || s.includes("coffeehouse") || s.includes("coffee")) return "coffee-cafe";
  if (s.includes("fast food") || s.includes("fast-food")) return "fast-food";
  if (s.includes("bakery")) return "ice-cream-dessert";
  if (s.includes("ice cream")) return "ice-cream-dessert";
  return "restaurant";
}

// ── Dedupe helpers (shared shape with other discovery agents) ──────────────

function normaliseName(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function computeDedupeHash({ name, address, phone, lat, lng }) {
  const nameNorm = normaliseName(name);
  const addrNorm = normaliseName(address);
  const phoneTail = String(phone ?? "").replace(/\D+/g, "").slice(-6);
  const latR = lat != null ? Number(lat).toFixed(3) : "";
  const lngR = lng != null ? Number(lng).toFixed(3) : "";
  return [nameNorm, addrNorm, phoneTail, latR, lngR].join("|");
}
function coordDist(aLat, aLng, bLat, bLng) {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return null;
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
function tokenJaccard(a, b) {
  const A = new Set(a.split(/\s+/).filter(Boolean));
  const B = new Set(b.split(/\s+/).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function formatPublicListingRef(year, id) {
  const digits = [];
  let n = id;
  for (let i = 0; i < 5; i++) { digits.unshift(CROCKFORD[n & 31] ?? "0"); n >>>= 5; }
  return `#FL-${year}-${digits.join("")}`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("── DISCOVERY · Wikidata SPARQL ──");
  console.log(`  mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
  console.log(`  endpoint: ${SPARQL_ENDPOINT}`);
  console.log(`  licence: CC0 · attribution not required`);
  console.log("");

  // Existing NEX universe for dedupe
  const existing = (await pool.query(`
    SELECT public_listing_ref, business_name, dedupe_hash,
           coordinates_lat, coordinates_lng
    FROM nex.food_business
  `)).rows;
  const existingByHash = new Map(existing.map((r) => [r.dedupe_hash, r]));
  console.log(`  existing NEX universe: ${existing.length}`);
  console.log("");

  // Determine next public_listing_ref counter
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

  // Run both queries · dedupe by Wikidata QID
  console.log("  running admin-hierarchy query...");
  let adminResp;
  try { adminResp = await sparqlQuery("admin", ADMIN_QUERY); }
  catch (err) { console.log(`  ✗ admin query FAILED: ${err.message}`); adminResp = { data: { results: { bindings: [] } } }; }
  console.log(`    → ${adminResp.data.results.bindings.length} rows ${adminResp.cached ? "(cache)" : ""}`);

  console.log("  running geo-box query...");
  let geoResp;
  try { geoResp = await sparqlQuery("geo", GEO_QUERY); }
  catch (err) { console.log(`  ✗ geo query FAILED: ${err.message}`); geoResp = { data: { results: { bindings: [] } } }; }
  console.log(`    → ${geoResp.data.results.bindings.length} rows ${geoResp.cached ? "(cache)" : ""}`);

  // Aggregate by Wikidata QID
  const candidates = new Map();
  for (const row of [...adminResp.data.results.bindings, ...geoResp.data.results.bindings]) {
    const qid = row.item?.value?.split("/").pop();
    if (!qid) continue;
    if (candidates.has(qid)) {
      // Merge · fill any missing fields from second source
      const existing = candidates.get(qid);
      for (const k of ["itemLabel","coord","website","phone","address","instanceOfLabel","adminLabel"]) {
        if (!existing[k] && row[k]?.value) existing[k] = row[k].value;
      }
    } else {
      candidates.set(qid, {
        qid,
        itemLabel: row.itemLabel?.value ?? "",
        coord: row.coord?.value,
        website: row.website?.value,
        phone: row.phone?.value,
        address: row.address?.value,
        instanceOfLabel: row.instanceOfLabel?.value ?? "",
        adminLabel: row.adminLabel?.value,
      });
    }
  }
  console.log(`  unique Wikidata items: ${candidates.size}`);
  console.log("");

  // Classify each candidate
  let exactMatch = 0, fuzzyHigh = 0, fuzzyAmbig = 0, newInserts = 0, unnamed = 0;
  const sampleNew = [];
  const sampleAmbiguous = [];

  for (const c of candidates.values()) {
    if (!c.itemLabel || c.itemLabel.startsWith("Q")) { unnamed++; continue; }
    const { lat, lng } = parseWktPoint(c.coord);
    const hash = computeDedupeHash({ name: c.itemLabel, address: c.address, phone: c.phone, lat, lng });

    if (existingByHash.has(hash)) { exactMatch++; continue; }

    // Fuzzy match against existing
    let bestScore = 0, bestExisting = null;
    for (const ex of existing) {
      const nameScore = tokenJaccard(normaliseName(ex.business_name), normaliseName(c.itemLabel));
      const dist = coordDist(ex.coordinates_lat, ex.coordinates_lng, lat, lng);
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
    if (bestExisting && bestScore >= 0.60) {
      fuzzyAmbig++;
      if (sampleAmbiguous.length < 5) sampleAmbiguous.push({ wd: c.itemLabel, nex: bestExisting.business_name, score: bestScore.toFixed(2) });
      continue;
    }

    // NEW
    newInserts++;
    const publicRef = formatPublicListingRef(2026, nextCounter++);
    const category = wikidataInstanceToNexCategory(c.instanceOfLabel);
    if (sampleNew.length < 10) {
      sampleNew.push({
        publicRef, name: c.itemLabel, qid: c.qid, category,
        address: c.address, phone: c.phone, website: c.website,
        instanceOf: c.instanceOfLabel, hasCoord: lat != null,
      });
    }
    if (dryRun) continue;

    try {
      const ins = await pool.query(
        `INSERT INTO nex.food_business (
           public_listing_ref, business_name, category, address, city,
           coordinates_lng, coordinates_lat,
           phone, website,
           source, source_reference, source_ingested_at, source_licence_terms,
           dedupe_hash, claim_status, owner_status, created_by
         ) VALUES (
           $1, $2, $3, $4, 'Yogyakarta', $5, $6, $7, $8,
           'wikidata_sparql', $9, now(),
           'CC0 · Wikidata · https://creativecommons.org/publicdomain/zero/1.0/',
           $10, 'discovered', 'unknown', 'agent:wikidata_sparql:v1'
         )
         ON CONFLICT DO NOTHING
         RETURNING public_listing_ref`,
        [publicRef, c.itemLabel, category, c.address ?? null, lng, lat,
         c.phone ?? null, c.website ?? null,
         `wikidata/${c.qid}`, hash]
      );
      if (ins.rowCount > 0) {
        await pool.query(
          `INSERT INTO nex.food_business_source_snapshot
             (business_ref, source, source_reference, source_ingested_at,
              source_licence_terms, raw_payload, ingested_by)
           VALUES ($1, 'wikidata_sparql', $2, now(),
                   'CC0 · Wikidata', $3, 'agent:wikidata_sparql:v1')`,
          [publicRef, `wikidata/${c.qid}`, JSON.stringify(c)]
        );
        // Field provenance
        const fields = ["business_name","category"];
        if (lat != null) { fields.push("coordinates_lat"); fields.push("coordinates_lng"); }
        if (c.address) fields.push("address");
        if (c.phone) fields.push("phone");
        if (c.website) fields.push("website");
        for (const f of fields) {
          await pool.query(
            `INSERT INTO nex.food_business_field_provenance
               (business_ref, field_name, trust_layer, written_at, written_by, source_reference)
             VALUES ($1, $2, 'source_import', now(), 'agent:wikidata_sparql:v1', $3)
             ON CONFLICT (business_ref, field_name) DO NOTHING`,
            [publicRef, f, `wikidata/${c.qid}`]
          );
        }
      }
    } catch (err) {
      console.log(`  ✗ insert failed ${publicRef} ${c.itemLabel}: ${err.message}`);
      newInserts--;
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────

  console.log("── CLASSIFICATION ──");
  console.log(`  EXACT MATCH (existing hash)              : ${exactMatch}`);
  console.log(`  HIGH-CONFIDENCE FUZZY (existing · enrich): ${fuzzyHigh}`);
  console.log(`  AMBIGUOUS FUZZY (needs review)           : ${fuzzyAmbig}`);
  console.log(`  Unnamed (skipped · Wikidata QID label)   : ${unnamed}`);
  console.log(`  NEW · inserted as claim_status=discovered: ${newInserts}`);
  console.log("");

  if (sampleAmbiguous.length > 0) {
    console.log("── Sample AMBIGUOUS matches (needs review) ──");
    for (const a of sampleAmbiguous) {
      console.log(`  score=${a.score}  WD "${a.wd}"  ↔  NEX "${a.nex}"`);
    }
    console.log("");
  }

  console.log("── Sample of NEW businesses (first 10) ──");
  for (const s of sampleNew) {
    console.log(`  ${s.publicRef}  ${s.name.slice(0, 45).padEnd(45)}  [${s.category}]`);
    console.log(`      wikidata: https://www.wikidata.org/wiki/${s.qid}`);
    if (s.instanceOf) console.log(`      type: ${s.instanceOf}`);
    if (s.address) console.log(`      addr: ${s.address}`);
    if (s.phone) console.log(`      phone: ${s.phone}`);
    if (s.website) console.log(`      website: ${s.website}`);
    console.log(`      has coordinates: ${s.hasCoord ? "yes" : "NO"}`);
  }
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
