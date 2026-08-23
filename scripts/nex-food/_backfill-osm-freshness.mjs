// Backfill source_updated_at + last_verified_at + verification_source for
// existing food_business rows from cached OSM data.
//
// Sources of truth (checked in priority order):
//   1. scripts/nex-food/.cache/osm-yogyakarta.json (full-city ingest cache)
//   2. scripts/nex-acquisition/.cache/overpass/*.json (Walker cycle caches)
//
// For each row where source='osm_overpass' and source_reference='node/xxx' or
// 'way/xxx' or 'relation/xxx', find the matching element in cache and extract
// its `timestamp` field (OSM's own record of when element was last edited).
//
// Doctrine (Philip 2026-08-21):
//   · Discovery date does NOT masquerade as verification date
//   · If cache has no timestamp for a record, leave last_verified_at NULL
//     (record stays UNVERIFIED · admin/owner/walker-reverify must supply
//     credible evidence)
//   · Never overwrite last_verified_at set by owner_otp or admin_manual
//     (owner_otp is FRESHER than any OSM timestamp)
//
// SAFE TO RE-RUN · idempotent · only fills NULLs.

import pg from "pg";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const CACHE_FILES = [
  join(__dirname, ".cache", "osm-yogyakarta.json"),
];
// Walker cycle caches
const WALKER_CACHE_DIR = join(__dirname, "..", "nex-acquisition", ".cache", "overpass");
if (existsSync(WALKER_CACHE_DIR)) {
  for (const f of readdirSync(WALKER_CACHE_DIR)) {
    if (f.endsWith(".json")) CACHE_FILES.push(join(WALKER_CACHE_DIR, f));
  }
}

console.log("── OSM Freshness Backfill ──");
console.log(`  cache files scanned: ${CACHE_FILES.length}`);

// Build in-memory map: source_reference → { timestamp, foundIn }
// If multiple caches have the same element with different timestamps, use the
// LATEST timestamp (element was updated between caches).
const elementIndex = new Map();
let totalElements = 0;
for (const cacheFile of CACHE_FILES) {
  if (!existsSync(cacheFile)) continue;
  try {
    const data = JSON.parse(readFileSync(cacheFile, "utf8"));
    const els = data.elements ?? [];
    totalElements += els.length;
    for (const el of els) {
      if (!el.type || !el.id || !el.timestamp) continue;
      const key = `${el.type}/${el.id}`;
      const existing = elementIndex.get(key);
      if (!existing || new Date(el.timestamp) > new Date(existing.timestamp)) {
        elementIndex.set(key, { timestamp: el.timestamp, foundIn: cacheFile });
      }
    }
  } catch (err) {
    console.log(`  ⚠ failed to parse ${cacheFile}: ${err.message}`);
  }
}
console.log(`  cache elements loaded: ${totalElements} (${elementIndex.size} unique with timestamps)`);
console.log("");

// Load candidates · records that need backfill
const candidates = await pool.query(`
  SELECT public_listing_ref, source, source_reference, source_ingested_at
  FROM nex.food_business
  WHERE source = 'osm_overpass'
    AND source_reference IS NOT NULL
    AND (last_verified_at IS NULL OR verification_source IS NULL)
    AND verification_source IS DISTINCT FROM 'owner_otp'
    AND verification_source IS DISTINCT FROM 'admin_manual'
`);
console.log(`  candidates for backfill: ${candidates.rowCount}`);
console.log("");

let matched = 0, unmatched = 0, updated = 0;
for (const row of candidates.rows) {
  const info = elementIndex.get(row.source_reference);
  if (!info) { unmatched++; continue; }
  matched++;
  const upd = await pool.query(
    `UPDATE nex.food_business
     SET source_updated_at = $2::timestamptz,
         last_verified_at  = $2::timestamptz,
         verification_source = 'osm_element_timestamp'
     WHERE public_listing_ref = $1
       AND verification_source IS DISTINCT FROM 'owner_otp'
       AND verification_source IS DISTINCT FROM 'admin_manual'
     RETURNING public_listing_ref`,
    [row.public_listing_ref, info.timestamp]
  );
  if (upd.rowCount > 0) updated++;
}

console.log(`── Backfill summary ──`);
console.log(`  matched to cache:    ${matched}`);
console.log(`  unmatched (no cache entry): ${unmatched}`);
console.log(`  DB rows updated:     ${updated}`);
console.log("");

// Post-backfill freshness distribution
const dist = await pool.query(`SELECT * FROM nex.food_business_freshness_summary WHERE city='Yogyakarta'`);
console.log("── Freshness distribution · AFTER backfill ──");
for (const r of dist.rows) {
  const total = Number(r.total);
  const pct = (n) => total > 0 ? ((Number(n)/total)*100).toFixed(1) + "%" : "0%";
  console.log(`  ${r.city}`);
  console.log(`    FRESH      ${String(r.fresh).padStart(4)}   ${pct(r.fresh)}   (<12mo)`);
  console.log(`    AGING      ${String(r.aging).padStart(4)}   ${pct(r.aging)}   (12-18mo)`);
  console.log(`    STALE      ${String(r.stale).padStart(4)}   ${pct(r.stale)}   (18-24mo)`);
  console.log(`    EXPIRED    ${String(r.expired).padStart(4)}   ${pct(r.expired)}   (>=24mo · cannot be presented as currently operating)`);
  console.log(`    UNVERIFIED ${String(r.unverified).padStart(4)}   ${pct(r.unverified)}   (no credible evidence)`);
  console.log(`    TOTAL      ${String(total).padStart(4)}`);
}
console.log("");

// Also breakdown by claim_status × freshness (matters for Commercial Universe decision)
const commercialFresh = await pool.query(`
  SELECT
    count(*) FILTER (WHERE claim_status IN ('listed','invited','claimed','paying') AND (last_verified_at IS NOT NULL AND now() - last_verified_at < interval '12 months'))::int AS commercial_fresh,
    count(*) FILTER (WHERE claim_status IN ('listed','invited','claimed','paying') AND (last_verified_at IS NULL OR now() - last_verified_at >= interval '12 months'))::int AS commercial_non_fresh,
    count(*) FILTER (WHERE claim_status = 'discovered')::int AS discovered_all
  FROM nex.food_business
  WHERE city = 'Yogyakarta'
`);
console.log("── Commercial candidate impact ──");
for (const r of commercialFresh.rows) {
  console.log(`  currently-visible claim_status (listed/invited/claimed/paying):`);
  console.log(`    FRESH (< 12mo verified)     : ${r.commercial_fresh}  ← would remain in Commercial Universe if freshness filter added`);
  console.log(`    NON-FRESH (>=12mo or unverified): ${r.commercial_non_fresh}  ← would fall OUT of Commercial Universe if freshness filter added`);
  console.log(`  discovered (all): ${r.discovered_all}  ← not in Commercial Universe regardless`);
}

// Verification source distribution
const bySource = await pool.query(`
  SELECT verification_source, count(*)::int AS n
  FROM nex.food_business
  WHERE city = 'Yogyakarta' AND last_verified_at IS NOT NULL
  GROUP BY verification_source
  ORDER BY n DESC
`);
console.log("");
console.log("── Verified records by evidence source ──");
if (bySource.rowCount === 0) console.log("  (none)");
else for (const r of bySource.rows) console.log(`  ${(r.verification_source||"").padEnd(28)}  ${r.n}`);

await pool.end();
