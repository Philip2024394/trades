#!/usr/bin/env node
// scripts/nex-enrichment/_path-c-location-intel-dryrun.mjs
//
// PATH C · LOCATION INTELLIGENCE · DRY-RUN CLASSIFIER
//
// Doctrine anchors:
//   project_nex_path_c_location_intelligence_greenlit_2026_08_23
//   project_nex_location_intelligence_2026_08_23
//   project_nex_location_distance_intelligence_precision_matched_to_confidence_2026_08_23
//
// Reads:  nex.food_business + nex.accommodation_business (coordinates + address only)
//         data/nex-location-intelligence/meaningful-areas-yogyakarta.json
//         data/nex-location-intelligence/landmarks-yogyakarta.json
// Writes: NOTHING (dry-run only · migration 087 is written but NOT applied)
// Reports:
//   · State transitions per vertical: CITY → EXACT/STREET/AREA/CITY/UNKNOWN
//   · Neighbourhood assignment counts per meaningful area
//   · Destination reasoning UNLOCKS (concrete examples of what's now possible)
//   · Distance-to-landmark distributions per vertical
//   · What Path C alone can't do (honest limits)

import pg from "pg";
import { readFileSync } from "node:fs";

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

// ── Load seed registries ─────────────────────────────────────────────
const AREAS = JSON.parse(readFileSync("data/nex-location-intelligence/meaningful-areas-yogyakarta.json", "utf8")).areas;
const LANDMARKS = JSON.parse(readFileSync("data/nex-location-intelligence/landmarks-yogyakarta.json", "utf8")).landmarks;

// Yogyakarta broad in-scope bbox (city + surrounding regencies for tourism corridors)
const YOG_BBOX = { minLat: -8.05, maxLat: -7.55, minLng: 110.15, maxLng: 110.60 };

// ── Deterministic classification helpers ──────────────────────────────
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
  const la = Number(lat), lo = Number(lng);
  return la >= bbox.minLat && la <= bbox.maxLat && lo >= bbox.minLng && lo <= bbox.maxLng;
}
function coordPrecision(v) {
  if (v == null) return 0;
  const s = String(v);
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}
function isNonBlank(s) { return typeof s === "string" && s.trim().length > 0; }
function addressHasStreetNumber(a) { return isNonBlank(a) && /\d/.test(a); }

/** Extract a normalised street name from an address string, or null if not derivable */
function extractStreetLine(address) {
  if (!isNonBlank(address)) return null;
  // Indonesian address patterns: "Jl. Foo Bar", "Jalan Foo Bar", "Jl Foo Bar"
  const m = address.match(/\b(Jl\.?|Jalan)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\.\-']+?)(?=,|\d|$)/i);
  if (m) return `Jl. ${m[2].trim()}`;
  return null;
}

/** Assign a meaningful area to coords · returns {area_id, area_kind, distance_km, confidence, tags[]} or null.
 *  Precedence-aware per project_nex_location_area_kind_semantic_doctrine_2026_08_23:
 *    1. Iterate areas in precedence order (neighbourhood=1 · corridor/belt=2 · fallback=99)
 *    2. Within same precedence, tie-break by smallest distance/radius ratio
 *    3. First match wins (soft-boundary allowance up to 1.5× radius)
 */
function assignMeaningfulArea(lat, lng) {
  if (!coordsValid(lat, lng)) return null;

  // Group areas by precedence and process in ascending precedence order.
  const byPrecedence = new Map();
  for (const a of AREAS) {
    if (!byPrecedence.has(a.precedence)) byPrecedence.set(a.precedence, []);
    byPrecedence.get(a.precedence).push(a);
  }
  const precedenceOrder = [...byPrecedence.keys()].sort((a, b) => a - b);

  for (const p of precedenceOrder) {
    const areasAtP = byPrecedence.get(p);
    let best = null;
    for (const a of areasAtP) {
      const d = haversineKm(lat, lng, a.centroid_lat, a.centroid_lng);
      const ratio = d / a.radius_km;
      if (ratio > 1.5) continue;
      const confidence = ratio <= 1.0 ? 1.0 : 0.5;
      if (!best || ratio < best.ratio) {
        best = {
          area_id: a.area_id, name: a.name, area_kind: a.area_kind,
          distance_km: d, ratio, confidence, character_tags: a.character_tags,
          brain_phrasing_hint: a.brain_phrasing_hint,
        };
      }
    }
    if (best) return best;
  }
  return null;
}

/** Compose a natural-language phrasing per area_kind (Brain-ready templates) */
function phrasingForArea(area, businessCategory, walkDetail) {
  if (!area) return `This ${businessCategory} · location not confirmed within a meaningful area`;
  const walkPart = walkDetail ? ` · ${walkDetail}` : "";
  switch (area.area_kind) {
    case "neighbourhood":
      return `This ${businessCategory} is in the ${area.name} neighbourhood${walkPart}.`;
    case "corridor":
      return `This ${businessCategory} is in the ${area.name} — a convenient base for the temple${walkPart}.`;
    case "belt":
      return `This ${businessCategory} is in the ${area.name} area · a cooler mountain/resort belt${walkPart}.`;
    case "fallback":
      return `This ${businessCategory} is in the wider ${area.name} area · no more specific match yet${walkPart}.`;
    default:
      return `This ${businessCategory} is in ${area.name}${walkPart}.`;
  }
}

/** Classify a business into one of the 5 location_confidence states */
function classifyLocation(row) {
  const rules = [];
  const rec = { location_confidence: "UNKNOWN", neighbourhood: null, street_line: null, in_target_zone: null, rules };

  if (!coordsValid(row.coordinates_lat, row.coordinates_lng)) {
    rules.push("no_valid_coord");
    return rec;
  }

  const inBbox = coordsInBbox(row.coordinates_lat, row.coordinates_lng);
  rec.in_target_zone = inBbox;
  if (!inBbox) {
    rec.location_confidence = "CITY";  // valid coord but out-of-scope regency → still knowable, just not target zone
    rules.push("valid_coord_but_out_of_bbox");
    return rec;
  }

  // In-scope · attempt neighbourhood
  const areaMatch = assignMeaningfulArea(row.coordinates_lat, row.coordinates_lng);
  if (areaMatch) {
    rec.neighbourhood = areaMatch.name;
    rec.area_id = areaMatch.area_id;
    rec.area_kind = areaMatch.area_kind;
    rec.area_confidence = areaMatch.confidence;
    rec.character_tags = areaMatch.character_tags;
    rec.brain_phrasing_hint = areaMatch.brain_phrasing_hint;
    rules.push(`area=${areaMatch.area_id}@${areaMatch.confidence}@kind=${areaMatch.area_kind}`);
  }

  const preciseCoord = coordPrecision(row.coordinates_lat) >= 5 && coordPrecision(row.coordinates_lng) >= 5;
  const hasAddress = isNonBlank(row.address);
  const streetLine = extractStreetLine(row.address);
  if (streetLine) rec.street_line = streetLine;
  const streetNumber = addressHasStreetNumber(row.address);

  // 5-state assignment (per doctrine)
  //   EXACT   = in_bbox + precise + street_line + street number + neighbourhood + source_verified (owner/multi-source)
  //   STREET  = in_bbox + precise + address populated + neighbourhood
  //   AREA    = in_bbox + neighbourhood assigned
  //   CITY    = in_bbox (or out-of-bbox but valid coord) · no neighbourhood match
  //   UNKNOWN = no coord (handled above)
  //
  // We CANNOT reach EXACT during Path C alone because source-verified requires owner
  // claim funnel OR multi-source agreement (Path B/D) OR check_date freshness marker
  // which we haven't persisted yet. Path C ceiling is STREET.

  if (areaMatch && preciseCoord && hasAddress && streetLine) {
    rec.location_confidence = "STREET";
    rules.push("street_derivable_from_address");
    return rec;
  }
  if (areaMatch) {
    rec.location_confidence = "AREA";
    return rec;
  }
  rec.location_confidence = "CITY";
  rules.push("in_bbox_no_neighbourhood_match");
  return rec;
}

// ── Distance-to-landmark computation ─────────────────────────────────
function distancesToLandmarks(lat, lng, walkableKmCap = 1.0) {
  if (!coordsValid(lat, lng)) return [];
  return LANDMARKS
    .map((lm) => ({ landmark_id: lm.landmark_id, name: lm.name, category: lm.category, distance_km: haversineKm(lat, lng, lm.centroid_lat, lm.centroid_lng) }))
    .filter((d) => d.distance_km <= walkableKmCap)
    .sort((a, b) => a.distance_km - b.distance_km);
}

// ── Load rows ────────────────────────────────────────────────────────
async function loadRows(table) {
  const q = await pool.query(`
    SELECT public_listing_ref AS business_ref, business_name, category,
           coordinates_lat, coordinates_lng, address, district
      FROM nex.${table}
     WHERE city='Yogyakarta'
  `);
  return q.rows;
}

// ── Report ───────────────────────────────────────────────────────────
function fmtTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)));
  const line = (cells) => cells.map((c, i) => String(c ?? "").padEnd(widths[i])).join("  ");
  return [line(headers), line(widths.map((w) => "─".repeat(w))), ...rows.map(line)].join("\n");
}

async function analyseVertical(vertical, table) {
  const rows = await loadRows(table);
  const beforeState = { EXACT: 0, STREET: 0, AREA: 0, CITY: rows.length, UNKNOWN: 0 };  // all implicit-CITY today
  const afterState  = { EXACT: 0, STREET: 0, AREA: 0, CITY: 0, UNKNOWN: 0 };
  const neighbourhoodCounts = {};
  const rulesCounts = {};
  const streetLineCount = { with_street_line: 0, without: 0 };
  const walkableSet = { under_500m_to_any_landmark: 0, "500m_to_1km": 0, "1km_plus": 0 };
  const sampleClassifications = [];

  for (const row of rows) {
    const c = classifyLocation(row);
    afterState[c.location_confidence] = (afterState[c.location_confidence] || 0) + 1;
    if (c.neighbourhood) neighbourhoodCounts[c.neighbourhood] = (neighbourhoodCounts[c.neighbourhood] || 0) + 1;
    for (const r of c.rules) rulesCounts[r] = (rulesCounts[r] || 0) + 1;
    if (c.street_line) streetLineCount.with_street_line++; else streetLineCount.without++;

    // Walking distance profile to closest landmark
    if (coordsValid(row.coordinates_lat, row.coordinates_lng)) {
      const nearest = LANDMARKS
        .map((lm) => haversineKm(row.coordinates_lat, row.coordinates_lng, lm.centroid_lat, lm.centroid_lng))
        .sort((a, b) => a - b)[0];
      if (nearest < 0.5) walkableSet.under_500m_to_any_landmark++;
      else if (nearest < 1.0) walkableSet["500m_to_1km"]++;
      else walkableSet["1km_plus"]++;
    }

    if (sampleClassifications.length < 5 && c.location_confidence === "STREET") {
      sampleClassifications.push({ ref: row.business_ref, name: row.business_name, ...c });
    }
  }

  return { vertical, total: rows.length, beforeState, afterState, neighbourhoodCounts, rulesCounts, streetLineCount, walkableSet, sampleClassifications };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  PATH C · LOCATION INTELLIGENCE · DRY-RUN CLASSIFIER · no writes          ║");
  console.log("║  Doctrine: project_nex_path_c_location_intelligence_greenlit_2026_08_23   ║");
  console.log("║  Migration 087 written but NOT APPLIED · no schema change until greenlit   ║");
  console.log("║  Uses existing coords only · zero external API calls                      ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  console.log(`Meaningful-area seed loaded: ${AREAS.length} areas`);
  console.log(`Landmark seed loaded:        ${LANDMARKS.length} landmarks\n`);

  const food  = await analyseVertical("food", "food_business");
  const accom = await analyseVertical("accommodation", "accommodation_business");

  for (const r of [food, accom]) {
    console.log(`════════════════════════════════════════════════════════════════════════`);
    console.log(`VERTICAL: ${r.vertical}   ·   ${r.total} businesses`);
    console.log(`════════════════════════════════════════════════════════════════════════\n`);

    console.log("── STATE TRANSITIONS (Philip's requested CITY → EXACT/STREET/AREA/CITY/UNKNOWN) ──");
    console.log(fmtTable(
      ["State", "Before", "After", "Delta"],
      [
        ["EXACT",   r.beforeState.EXACT,   r.afterState.EXACT,   r.afterState.EXACT - r.beforeState.EXACT],
        ["STREET",  r.beforeState.STREET,  r.afterState.STREET,  r.afterState.STREET - r.beforeState.STREET],
        ["AREA",    r.beforeState.AREA,    r.afterState.AREA,    r.afterState.AREA - r.beforeState.AREA],
        ["CITY",    r.beforeState.CITY,    r.afterState.CITY,    r.afterState.CITY - r.beforeState.CITY],
        ["UNKNOWN", r.beforeState.UNKNOWN, r.afterState.UNKNOWN, r.afterState.UNKNOWN - r.beforeState.UNKNOWN],
      ],
    ));
    console.log("");

    console.log("── NEIGHBOURHOOD ASSIGNMENTS (per meaningful area) ──");
    const nRows = Object.entries(r.neighbourhoodCounts).sort((a, b) => b[1] - a[1]).map(([n, c]) => [n, c, `${(100*c/r.total).toFixed(1)}%`]);
    console.log(fmtTable(["Area", "Count", "% of total"], nRows));
    console.log("");

    console.log("── STREET-LINE EXTRACTION ──");
    console.log(`  Rows with street_line derivable from address: ${r.streetLineCount.with_street_line} (${(100*r.streetLineCount.with_street_line/r.total).toFixed(1)}%)`);
    console.log(`  Rows without derivable street_line:          ${r.streetLineCount.without}`);
    console.log("");

    console.log("── WALKING-DISTANCE-TO-LANDMARK PROFILE ──");
    console.log(`  <500m from any landmark:  ${r.walkableSet.under_500m_to_any_landmark} (${(100*r.walkableSet.under_500m_to_any_landmark/r.total).toFixed(1)}%)`);
    console.log(`  500m - 1km from landmark: ${r.walkableSet["500m_to_1km"]} (${(100*r.walkableSet["500m_to_1km"]/r.total).toFixed(1)}%)`);
    console.log(`  >1km from any landmark:   ${r.walkableSet["1km_plus"]} (${(100*r.walkableSet["1km_plus"]/r.total).toFixed(1)}%)`);
    console.log("");

    if (r.sampleClassifications.length > 0) {
      console.log("── SAMPLE STREET-STATE CLASSIFICATIONS (first 5) ──");
      for (const s of r.sampleClassifications) {
        console.log(`  ${s.ref}  ${s.name}`);
        console.log(`    state=${s.location_confidence}  neighbourhood="${s.neighbourhood}"  street_line="${s.street_line}"`);
      }
      console.log("");
    }
  }

  // ── Destination reasoning unlocks · concrete examples
  console.log(`════════════════════════════════════════════════════════════════════════`);
  console.log("DESTINATION REASONING UNLOCKS · what Path C makes possible");
  console.log(`════════════════════════════════════════════════════════════════════════\n`);

  // Pick one accommodation in Prawirotaman and one in Malioboro if available for concrete demo
  const accomRows = await loadRows("accommodation_business");
  for (const areaId of ["prawirotaman", "malioboro", "kaliurang"]) {
    const area = AREAS.find((a) => a.area_id === areaId);
    // find a business classified into this area
    const sample = accomRows.map((row) => ({ row, c: classifyLocation(row) })).find(({ c }) => c.area_id === areaId);
    if (!sample) continue;
    const { row, c } = sample;
    const nearby = distancesToLandmarks(row.coordinates_lat, row.coordinates_lng, 2.0);
    const nearestFew = nearby.slice(0, 6);
    console.log(`  Business: ${row.business_name}  (${row.business_ref})`);
    console.log(`  → assigned area: ${c.neighbourhood}  (state=${c.location_confidence}, character=[${(c.character_tags || []).join(", ")}])`);
    console.log(`  → nearby landmarks (within 2 km):`);
    for (const lm of nearestFew) console.log(`     · ${lm.name.padEnd(38)}  ${lm.distance_km.toFixed(2)} km  (${lm.category})`);
    console.log(`  → NEX Brain could now honestly say (area-kind-aware phrasing):`);
    const walkables = nearestFew.filter((lm) => lm.distance_km < 1.0);
    let walkDetail = null;
    if (walkables.length > 0) {
      const first = walkables[0];
      const walkMin = Math.round((first.distance_km * 1000) / 80); // ~80 m/min walking (straight-line · NOT routed)
      walkDetail = `about ${walkMin} min straight-line walk to ${first.name}`;
    }
    const areaObj = { name: c.neighbourhood, area_kind: c.area_kind };
    console.log(`     "${phrasingForArea(areaObj, row.category, walkDetail)}"`);
    console.log(`     (walk time is STRAIGHT-LINE only · routed walking time deferred to Distance Intelligence phase)`);
    console.log("");
  }

  console.log(`════════════════════════════════════════════════════════════════════════`);
  console.log("WHAT PATH C ALONE CANNOT DO (honest limits)");
  console.log(`════════════════════════════════════════════════════════════════════════\n`);
  console.log("  · Cannot reach EXACT state — that requires source-verified evidence (owner");
  console.log("    claim funnel · Path D · OR multi-source agreement · Path B). Path C ceiling");
  console.log("    is STREET at best.");
  console.log("  · Cannot change ≥90 candidate count directly — Task #88 Phase 1 scorer does");
  console.log("    NOT yet read location_confidence · neighbourhood · walkability. A scorer");
  console.log("    upgrade (Tier A location precision + Tier D neighbourhood-context signals)");
  console.log("    is required before Path C moves the ≥90 needle.");
  console.log("  · Cannot compute travel times — only straight-line distances. Routed times");
  console.log("    require OSRM/GraphHopper integration (Distance Intelligence · future Phase).");
  console.log("  · Cannot solve food's snapshot-architecture gap — Path C reads coords which");
  console.log("    food HAS (100% coverage). But street_line extraction depends on address text,");
  console.log("    where food is 19.7% populated and accommodation 18.5% populated.");
  console.log("");

  console.log("── DOCTRINE COMPLIANCE ──");
  console.log("  Walker touched:              NO");
  console.log("  Schema changed:              NO (migration 087 written but not applied)");
  console.log("  ≥90 threshold weakened:      NO");
  console.log("  Rows auto-listed:            0 (no publishing)");
  console.log("  Provenance preserved:        YES (every classification cites its rules)");
  console.log("  Truth Invariant:             satisfied (default state is CITY not EXACT · never fabricate exactness)");
  console.log("  Traveller Protection:        satisfied (no customer-facing change · precision matched to evidence)");
  console.log("");

  console.log("── NEXT-MOVE OPTIONS FOR PHILIP ──");
  console.log("  1. Apply migration 087 + persist enrichment (schema change · reversible via rollback script)");
  console.log("  2. Refine meaningful-area centroids/radii based on the distribution before applying");
  console.log("  3. Refine landmark list before applying");
  console.log("  4. Defer apply · move to scorer upgrade first (so ≥90 impact is measurable when Path C lands)");
  console.log("");

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
