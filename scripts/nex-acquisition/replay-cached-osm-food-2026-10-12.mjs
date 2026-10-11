#!/usr/bin/env node
// scripts/nex-acquisition/replay-cached-osm-food-2026-10-12.mjs
//
// Fallback source · founder-authorised pass 6 · 2026-10-12.
//
// Overpass public mirrors are currently degraded (5 of 5 return 500/504 OR
// 200 with empty elements + sequence-number timestamp). Verified today
// using the engine's exact query format. The sealed acquisition pipeline
// needs a resilient route to NEW candidates when Overpass is unavailable.
//
// This script reuses the primitives the live Walker uses · classifier,
// extractCandidate logic, and dedupeHash function · but reads from
// already-committed raw Overpass response caches under
// scripts/nex-acquisition/.cache/overpass/food*.json instead of hitting
// Overpass live. Elements that are NOT already in nex.food_business are
// classified, hashed, and INSERTed into food_business. The sealed
// _continuous-food-ingestion.mjs run that follows picks them up and
// drives them through resolver → decision → write → promotion.
//
// What this does NOT do:
//   · Does NOT bypass the resolver, decision log, or precheckHandoff.
//   · Does NOT change source_registry.can_display for any vertical.
//   · Does NOT invent coordinates, phone, email, or ownership data.
//   · Does NOT touch owner_verified rows (not relevant - fresh inserts).
//   · Does NOT touch nex.business_canonical directly.
//   · Does NOT run on live Overpass (that path is blocked today).
//
// Scope: one-shot ingestion of cache-replay candidates. The resolver
// decides whether each becomes a new canonical, is merged, or is held
// for review. This script only widens the funnel at Stage 0.
//
// Flags:
//   --dry-run     count-only (no DB writes)
//   --limit N     cap total inserts
//
// Rollback (reversible by this script's unique marker):
//   DELETE FROM nex.food_business
//    WHERE created_by LIKE 'agent:cache-replay:2026-10-12%';

import pg from "pg";
import { readdirSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { foodYogyakartaConfig } from "./configs/food-yogyakarta.mjs";

const CACHE_ROOTS = [
  "scripts/nex-acquisition/.cache/overpass",
  "scripts/nex-food/.cache",
  "data/nex-agent-workspaces/task-7c99d25a/scripts/nex-acquisition/.cache/overpass",
];
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const MARKER = "agent:cache-replay:2026-10-12";

// ─── Pure helpers ·  mirrored verbatim from engine.mjs so provenance of
//     dedupe_hash matches live-cycle rows exactly. ────────────────────
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
function crockfordFromHash(h) {
  // Take 25 bits from the SHA256 of the input and emit 5 Crockford chars.
  const buf = createHash("sha256").update(h).digest();
  let n = buf.readUInt32BE(0) >>> 7;
  let s = "";
  for (let i = 0; i < 5; i++) { s = CROCKFORD[n & 31] + s; n = n >>> 5; }
  return s;
}
function publicRefFor(sourceRef) {
  return `#FL-2026-${crockfordFromHash(sourceRef)}`;
}

// ─── OSM element → candidate · mirrors engine's extractCandidate ───────
function extractCandidate(el, classifier) {
  const tags = el.tags ?? {};
  const name = tags.name ?? tags["name:en"] ?? tags["name:id"];
  if (!name) return null;
  let lat = null, lng = null;
  if (el.type === "node") { lat = el.lat; lng = el.lon; }
  else if (el.center)      { lat = el.center.lat; lng = el.center.lon; }
  if (lat == null || lng == null) return null;
  const amenity = tags.amenity;
  const shop    = tags.shop;
  const cuisine = tags.cuisine;
  const cls = classifier(amenity, shop, cuisine, tags);
  if (!cls?.primary) return null;
  const addressParts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
  ].filter(Boolean);
  const address = addressParts.length ? addressParts.join(", ") : null;
  const whatsapp = tags["contact:whatsapp"] ?? null;
  const phone    = tags["contact:phone"]    ?? tags.phone   ?? null;
  const website  = tags["contact:website"]  ?? tags.website ?? null;
  const osmTs    = el.timestamp ? new Date(el.timestamp).toISOString() : null;
  return {
    name,
    category: cls.primary,
    categories: cls.secondary ?? [],
    address,
    lat, lng,
    whatsapp, phone, website,
    rawTags: tags,
    osmId: `${el.type}/${el.id}`,
    sourceType: "osm_overpass",
    sourceReference: `${el.type}/${el.id}`,
    sourceLicenceTerms: "ODbL 1.0 · © OpenStreetMap contributors · https://openstreetmap.org/copyright",
    sourceUpdatedAt: osmTs,
    lastVerifiedAt: osmTs,
    verificationSource: osmTs ? "osm_element_timestamp" : null,
  };
}

// ─── City resolution from coordinates ·  uses the catalogue bboxes ────
function loadCityCatalogue() {
  const cat = JSON.parse(readFileSync("data/nex-city-catalogue.json", "utf8"));
  // Sort by bbox size · check smallest first so a tourist pocket wins
  // over a bigger administrative polygon when both contain the point.
  return [...cat.cities].sort((a, b) => {
    const aA = (a.bboxNe[0] - a.bboxSw[0]) * (a.bboxNe[1] - a.bboxSw[1]);
    const bA = (b.bboxNe[0] - b.bboxSw[0]) * (b.bboxNe[1] - b.bboxSw[1]);
    return aA - bA;
  });
}
function cityForCoords(lat, lng, catalogue) {
  for (const c of catalogue) {
    if (lat >= c.bboxSw[0] && lat <= c.bboxNe[0] && lng >= c.bboxSw[1] && lng <= c.bboxNe[1]) {
      return c.canonical;
    }
  }
  return null;
}

async function main() {
  const DRY_RUN = process.argv.includes("--dry-run");
  const idx = process.argv.indexOf("--limit");
  const LIMIT = idx >= 0 ? Number(process.argv[idx + 1]) || Infinity : Infinity;

  const classifier = foodYogyakartaConfig.osmOverpass.classifier;
  if (typeof classifier !== "function") {
    throw new Error("food classifier not available from foodYogyakartaConfig.osmOverpass.classifier");
  }
  const catalogue = loadCityCatalogue();

  const client = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
  await client.connect();
  await client.query("SET default_transaction_read_only = on");
  const existing = await client.query(`
    SELECT source_reference FROM nex.food_business WHERE country='ID' AND source_reference IS NOT NULL
  `);
  const haveRef = new Set();
  for (const row of existing.rows) {
    haveRef.add(row.source_reference);
    haveRef.add(row.source_reference.replace(/^osm\//, ""));
  }
  await client.query("SET default_transaction_read_only = off");
  console.log(JSON.stringify({ phase: "existing-refs", n: haveRef.size }));

  // Scan food caches for missing candidates.
  const seenRef = new Set();
  const candidates = [];
  let filesScanned = 0, elementsScanned = 0;
  for (const root of CACHE_ROOTS) {
    if (!existsSync(root)) continue;
    for (const f of readdirSync(root)) {
      if (!(f.startsWith("food") || f.startsWith("food-v2")) || !f.endsWith(".json")) continue;
      filesScanned++;
      let data;
      try { data = JSON.parse(readFileSync(`${root}/${f}`, "utf8")); } catch { continue; }
      for (const el of data.elements ?? []) {
        elementsScanned++;
        const ref = `${el.type}/${el.id}`;
        if (seenRef.has(ref)) continue;
        if (haveRef.has(ref)) continue;
        const cand = extractCandidate(el, classifier);
        if (!cand) continue;
        seenRef.add(ref);
        // Prefer the catalogue (canonical city names) over `addr:city` (OSM
        // contributor-set · inconsistent · 'South Jakarta' vs 'Jakarta
        // Selatan' vs 'DKI Jakarta'). Mirrors live Walker which uses
        // config.city (fixed per run). Only fall back to `addr:city` when
        // the catalogue bbox lookup fails · still skip if neither works.
        const city = cityForCoords(cand.lat, cand.lng, catalogue) || cand.rawTags["addr:city"];
        if (!city) continue;
        cand.city = city;
        cand.publicRef = publicRefFor(cand.sourceReference);
        cand.dedupeHash = computeDedupeHash({
          name: cand.name,
          address: cand.address,
          phone: cand.phone,
          lat: cand.lat,
          lng: cand.lng,
        });
        candidates.push(cand);
      }
    }
  }
  console.log(JSON.stringify({
    phase: "scan-done",
    files_scanned: filesScanned,
    elements_scanned: elementsScanned,
    candidates_eligible: candidates.length,
  }));

  // City distribution for the honest pre-insert view.
  const byCity = candidates.reduce((a, c) => { a[c.city] = (a[c.city] || 0) + 1; return a; }, {});
  console.log(JSON.stringify({ phase: "by-city", by_city: byCity }));

  if (DRY_RUN) {
    await client.end();
    console.log(JSON.stringify({ phase: "dry-run-exit", would_insert: candidates.length }));
    return;
  }

  // Create a real worker_cycle_run row so food_business.cycle_run_id FK
  // resolves. We register the cycle up-front, then update records_processed
  // + finished_at at the end. Mirrors reliability.mjs's startCycleRun shape.
  const workerId = `${MARKER}:${randomUUID().slice(0, 8)}`;
  const workerCycleRun = await client.query(
    `INSERT INTO nex.worker_cycle_run
       (worker_id, worker_type, worker_config, started_at, status)
     VALUES ($1, 'acquisition', 'food:cache-replay:2026-10-12', now(), 'running')
     RETURNING id`,
    [workerId],
  );
  const cycleRunId = workerCycleRun.rows[0].id;
  console.log(JSON.stringify({ phase: "cycle-registered", cycle_run_id: cycleRunId, worker_id: workerId }));
  const batched = candidates.slice(0, LIMIT);
  const BATCH = 100;
  let inserted = 0, conflicts = 0;
  for (let i = 0; i < batched.length; i += BATCH) {
    const chunk = batched.slice(i, i + BATCH);
    await client.query("BEGIN");
    try {
      for (const cand of chunk) {
        // Rely on nex.food_business unique constraints · ON CONFLICT skips.
        const res = await client.query(
          `INSERT INTO nex.food_business (
             public_listing_ref, business_name, category, categories, address, city,
             coordinates_lng, coordinates_lat,
             whatsapp_number, phone, website,
             source, source_reference, source_ingested_at, source_licence_terms,
             source_updated_at, last_verified_at, verification_source,
             dedupe_hash, claim_status, owner_status, created_by, country,
             worker_id, cycle_run_id
           ) VALUES (
             $1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10, $11,
             $12, $13, now(), $14, $15, $16, $17,
             $18, 'discovered', 'unknown', $19, 'ID', $20, $21
           )
           ON CONFLICT DO NOTHING
           RETURNING internal_id`,
          [
            cand.publicRef, cand.name, cand.category, cand.categories,
            cand.address, cand.city, cand.lng, cand.lat,
            cand.whatsapp, cand.phone, cand.website,
            cand.sourceType, cand.sourceReference, cand.sourceLicenceTerms,
            cand.sourceUpdatedAt, cand.lastVerifiedAt, cand.verificationSource,
            cand.dedupeHash, workerId,
            workerId, cycleRunId,
          ],
        );
        if (res.rowCount === 1) inserted++;
        else conflicts++;
      }
      await client.query("COMMIT");
      console.log(JSON.stringify({ phase: "batch", batch_index: Math.floor(i / BATCH) + 1, inserted_total: inserted, conflicts_total: conflicts }));
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(JSON.stringify({ phase: "batch-error", error: e.message }));
      throw e;
    }
  }
  // Close the worker_cycle_run row.
  await client.query(
    `UPDATE nex.worker_cycle_run
        SET finished_at = now(), status = 'completed',
            records_processed = $2, records_new = $2
      WHERE id = $1`,
    [cycleRunId, inserted],
  );
  // Readback.
  const after = await client.query(`SELECT count(*)::int AS n FROM nex.food_business WHERE created_by LIKE $1 || '%'`, [MARKER]);
  const unlinked = await client.query(`SELECT count(*)::int AS n FROM nex.food_business WHERE country='ID' AND canonical_business_id IS NULL`);
  console.log(JSON.stringify({
    phase: "done",
    cycle_run_id: cycleRunId,
    worker_id: workerId,
    inserted,
    conflicts_skipped: conflicts,
    cache_replay_rows_persisted: after.rows[0].n,
    food_unlinked_after: unlinked.rows[0].n,
  }));
  await client.end();
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
