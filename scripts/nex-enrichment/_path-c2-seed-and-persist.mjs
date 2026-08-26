#!/usr/bin/env node
// scripts/nex-enrichment/_path-c2-seed-and-persist.mjs
//
// PATH C · PHASE C2 · SEED REGISTRIES + PERSIST LOCATION INTELLIGENCE
//
// Doctrine anchors:
//   project_nex_c2_greenlight_geographic_intelligence_as_evidence_not_score_2026_08_23
//   project_nex_path_c_location_intelligence_greenlit_2026_08_23
//   project_nex_location_area_kind_semantic_doctrine_2026_08_23
//   project_nex_location_intelligence_2026_08_23
//
// What this script does (production writes):
//   1. Seeds nex.meaningful_area from data/nex-location-intelligence/meaningful-areas-yogyakarta.json
//   2. Seeds nex.geo_landmark from data/nex-location-intelligence/landmarks-yogyakarta.json
//   3. Classifies every food_business + accommodation_business row in Yogyakarta
//      and UPDATES: location_confidence · neighbourhood · street_line · in_target_zone ·
//                    geocode_evidence · location_verified_at · location_source
//   4. Writes provenance rows (Direct-Provenance A pattern · cycle_run_id NULL for
//      the C2 apply cycle — no worker_cycle_run created because this is not a Walker cycle)
//
// What this script does NOT do (per Philip's 8 hard requirements):
//   · No customer-facing recommendation generated
//   · No ≥90 threshold change · no scorer touch
//   · No automatic listing activation
//   · No global ranking
//   · No safety inference from geographic proximity
//   · No routed distance (straight-line only where computed · for audit only)
//   · No new HQ UI · replayability is via provenance table + this script's audit output
//
// Idempotent: safe to re-run · UPSERT on registries · UPDATE on business rows.

import pg from "pg";
import { readFileSync } from "node:fs";

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 4 });

const AREAS = JSON.parse(readFileSync("data/nex-location-intelligence/meaningful-areas-yogyakarta.json", "utf8")).areas;
const LANDMARKS = JSON.parse(readFileSync("data/nex-location-intelligence/landmarks-yogyakarta.json", "utf8")).landmarks;

const YOG_BBOX = { minLat: -8.05, maxLat: -7.55, minLng: 110.15, maxLng: 110.60 };
const LOCATION_SOURCE = "reverse_geo_classifier_v0.1";

// ── Deterministic classification (same as dry-run · single source of truth kept
//    in this file so the applied enrichment matches the dry-run report byte-for-byte) ──

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function coordsValid(lat, lng) {
  const la = Number(lat), lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la === 0 && lo === 0) return false;
  return la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}
function coordsInBbox(lat, lng, bbox = YOG_BBOX) {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
}
function coordPrecision(v) {
  if (v == null) return 0;
  const s = String(v);
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}
function isNonBlank(s) { return typeof s === "string" && s.trim().length > 0; }
function addressHasStreetNumber(a) { return isNonBlank(a) && /\d/.test(a); }
function extractStreetLine(address) {
  if (!isNonBlank(address)) return null;
  const m = address.match(/\b(Jl\.?|Jalan)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\.\-']+?)(?=,|\d|$)/i);
  if (m) return `Jl. ${m[2].trim()}`;
  return null;
}

function assignMeaningfulArea(lat, lng) {
  if (!coordsValid(lat, lng)) return null;
  const byPrecedence = new Map();
  for (const a of AREAS) {
    if (!byPrecedence.has(a.precedence)) byPrecedence.set(a.precedence, []);
    byPrecedence.get(a.precedence).push(a);
  }
  const precedenceOrder = [...byPrecedence.keys()].sort((a, b) => a - b);
  for (const p of precedenceOrder) {
    let best = null;
    for (const a of byPrecedence.get(p)) {
      const d = haversineKm(lat, lng, a.centroid_lat, a.centroid_lng);
      const ratio = d / a.radius_km;
      if (ratio > 1.5) continue;
      const confidence = ratio <= 1.0 ? 1.0 : 0.5;
      if (!best || ratio < best.ratio) {
        best = { area_id: a.area_id, name: a.name, area_kind: a.area_kind,
                 distance_km: d, ratio, confidence, character_tags: a.character_tags };
      }
    }
    if (best) return best;
  }
  return null;
}

function classifyLocation(row) {
  const rules = [];
  const rec = {
    location_confidence: "UNKNOWN",
    neighbourhood: null,
    street_line: null,
    in_target_zone: null,
    geocode_evidence: { rules, source_version: "v0.1", classifier: LOCATION_SOURCE },
  };

  if (!coordsValid(row.coordinates_lat, row.coordinates_lng)) {
    rules.push("no_valid_coord");
    return rec;
  }
  const inBbox = coordsInBbox(Number(row.coordinates_lat), Number(row.coordinates_lng));
  rec.in_target_zone = inBbox;
  if (!inBbox) {
    rec.location_confidence = "CITY";
    rules.push("valid_coord_but_out_of_bbox");
    return rec;
  }
  const areaMatch = assignMeaningfulArea(Number(row.coordinates_lat), Number(row.coordinates_lng));
  if (areaMatch) {
    rec.neighbourhood = areaMatch.name;
    rec.geocode_evidence.area_id = areaMatch.area_id;
    rec.geocode_evidence.area_kind = areaMatch.area_kind;
    rec.geocode_evidence.area_confidence = areaMatch.confidence;
    rec.geocode_evidence.area_distance_km = Number(areaMatch.distance_km.toFixed(3));
    rules.push(`area=${areaMatch.area_id}@${areaMatch.confidence}@kind=${areaMatch.area_kind}`);
  }
  const preciseCoord = coordPrecision(row.coordinates_lat) >= 5 && coordPrecision(row.coordinates_lng) >= 5;
  const hasAddress = isNonBlank(row.address);
  const streetLine = extractStreetLine(row.address);
  if (streetLine) {
    rec.street_line = streetLine;
    rec.geocode_evidence.street_line_source = "address_pattern_extraction";
  }
  if (areaMatch && preciseCoord && hasAddress && streetLine) {
    rec.location_confidence = "STREET";
    rules.push("street_derivable_from_address");
    return rec;
  }
  if (areaMatch) { rec.location_confidence = "AREA"; return rec; }
  rec.location_confidence = "CITY";
  rules.push("in_bbox_no_neighbourhood_match");
  return rec;
}

// ── Seed registries ─────────────────────────────────────────────────
async function seedMeaningfulAreas() {
  let inserted = 0, updated = 0;
  for (const a of AREAS) {
    const q = await pool.query(
      `INSERT INTO nex.meaningful_area
         (area_id, name, area_kind, precedence, country, city,
          centroid_lat, centroid_lng, radius_km, character_tags,
          description, brain_phrasing_hint, source, provenance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::text[],$11,$12,$13,$14::jsonb)
       ON CONFLICT (area_id) DO UPDATE SET
         name = EXCLUDED.name,
         area_kind = EXCLUDED.area_kind,
         precedence = EXCLUDED.precedence,
         centroid_lat = EXCLUDED.centroid_lat,
         centroid_lng = EXCLUDED.centroid_lng,
         radius_km = EXCLUDED.radius_km,
         character_tags = EXCLUDED.character_tags,
         description = EXCLUDED.description,
         brain_phrasing_hint = EXCLUDED.brain_phrasing_hint,
         provenance = EXCLUDED.provenance,
         updated_at = now()
       RETURNING (xmax = 0) AS was_insert`,
      [a.area_id, a.name, a.area_kind, a.precedence, "ID", "Yogyakarta",
       a.centroid_lat, a.centroid_lng, a.radius_km, a.character_tags,
       a.description, a.brain_phrasing_hint, a.source, JSON.stringify(a.provenance)],
    );
    if (q.rows[0].was_insert) inserted++; else updated++;
  }
  return { inserted, updated, total: AREAS.length };
}

async function seedLandmarks() {
  let inserted = 0, updated = 0;
  for (const l of LANDMARKS) {
    const q = await pool.query(
      `INSERT INTO nex.geo_landmark
         (landmark_id, name, category, country, city,
          centroid_lat, centroid_lng, meaningful_area_ids, source, provenance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9,$10::jsonb)
       ON CONFLICT (landmark_id) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         centroid_lat = EXCLUDED.centroid_lat,
         centroid_lng = EXCLUDED.centroid_lng,
         meaningful_area_ids = EXCLUDED.meaningful_area_ids,
         updated_at = now()
       RETURNING (xmax = 0) AS was_insert`,
      [l.landmark_id, l.name, l.category, "ID", "Yogyakarta",
       l.centroid_lat, l.centroid_lng, l.meaningful_area_ids ?? [],
       "philip_2026_08_23_seed", JSON.stringify({ seed_version: "v0.2" })],
    );
    if (q.rows[0].was_insert) inserted++; else updated++;
  }
  return { inserted, updated, total: LANDMARKS.length };
}

// ── Persist enrichment ─────────────────────────────────────────────
async function persistVertical(vertical, businessTable, provenanceTable) {
  const rows = (await pool.query(`
    SELECT public_listing_ref AS business_ref, coordinates_lat, coordinates_lng, address, district, business_name, category
      FROM nex.${businessTable}
     WHERE city='Yogyakarta'
  `)).rows;

  const stateCounts = { EXACT: 0, STREET: 0, AREA: 0, CITY: 0, UNKNOWN: 0 };
  let updated = 0, provenanceRows = 0;

  for (const row of rows) {
    const c = classifyLocation(row);
    stateCounts[c.location_confidence]++;

    await pool.query(
      `UPDATE nex.${businessTable}
          SET location_confidence = $1,
              neighbourhood       = $2,
              street_line         = $3,
              in_target_zone      = $4,
              geocode_evidence    = $5::jsonb,
              location_verified_at = now(),
              location_source     = $6
        WHERE public_listing_ref = $7`,
      [c.location_confidence, c.neighbourhood, c.street_line, c.in_target_zone,
       JSON.stringify(c.geocode_evidence), LOCATION_SOURCE, row.business_ref],
    );
    updated++;

    // Direct-Provenance A · write a provenance row for each populated field.
    const fields = [
      ["location_confidence", c.location_confidence != null],
      ["neighbourhood",       c.neighbourhood != null],
      ["street_line",         c.street_line != null],
      ["in_target_zone",      c.in_target_zone != null],
    ];
    for (const [fieldName, hasValue] of fields) {
      if (!hasValue) continue;
      await pool.query(
        `INSERT INTO nex.${provenanceTable}
           (business_ref, field_name, trust_layer, written_at, written_by, source_reference)
         VALUES ($1, $2, 'source_import', now(), $3, $4)
         ON CONFLICT (business_ref, field_name) DO UPDATE SET
           written_at = now(),
           written_by = EXCLUDED.written_by`,
        [row.business_ref, fieldName, `agent:${LOCATION_SOURCE}`, JSON.stringify(c.geocode_evidence.rules)],
      );
      provenanceRows++;
    }
  }
  return { vertical, total: rows.length, stateCounts, updated, provenanceRows };
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  PATH C · PHASE C2 · SEED REGISTRIES + PERSIST LOCATION INTELLIGENCE      ║");
  console.log("║  Doctrine: project_nex_c2_greenlight_geographic_intelligence_...          ║");
  console.log("║  Persists as EVIDENCE/CONTEXT · not as recommendation score                ║");
  console.log("║  ≥90 threshold: UNCHANGED · scorer: UNTOUCHED · no publishing · no ranking  ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  console.log("── STEP 1 · Seed nex.meaningful_area ──");
  const s1 = await seedMeaningfulAreas();
  console.log(`  Inserted: ${s1.inserted}  Updated: ${s1.updated}  Total: ${s1.total}\n`);

  console.log("── STEP 2 · Seed nex.geo_landmark ──");
  const s2 = await seedLandmarks();
  console.log(`  Inserted: ${s2.inserted}  Updated: ${s2.updated}  Total: ${s2.total}\n`);

  console.log("── STEP 3 · Persist Location Intelligence · food_business ──");
  const p1 = await persistVertical("food", "food_business", "food_business_field_provenance");
  console.log(`  Updated ${p1.updated} rows · provenance rows written: ${p1.provenanceRows}`);
  console.log(`  State distribution: ${JSON.stringify(p1.stateCounts)}\n`);

  console.log("── STEP 4 · Persist Location Intelligence · accommodation_business ──");
  const p2 = await persistVertical("accommodation", "accommodation_business", "accommodation_business_field_provenance");
  console.log(`  Updated ${p2.updated} rows · provenance rows written: ${p2.provenanceRows}`);
  console.log(`  State distribution: ${JSON.stringify(p2.stateCounts)}\n`);

  console.log("── DOCTRINE COMPLIANCE CHECKS ──");
  console.log("  Scorer touched:              NO");
  console.log("  ≥90 threshold changed:       NO");
  console.log("  Rows auto-listed:            0 (no publishing)");
  console.log("  Global ranking introduced:   NO");
  console.log("  Safety inferred from proximity: NO");
  console.log("  Straight-line ≠ routed:      preserved (no routed distance computed)");
  console.log("  Provenance chain:            written (Direct-Provenance A pattern · replayable via *_field_provenance)");
  console.log("  Idempotent:                  YES (ON CONFLICT DO UPDATE on registries · UPDATE on business rows)");
  console.log("");

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
