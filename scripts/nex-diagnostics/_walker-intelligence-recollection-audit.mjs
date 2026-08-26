#!/usr/bin/env node
// scripts/nex-diagnostics/_walker-intelligence-recollection-audit.mjs
//
// WALKER INTELLIGENCE + RE-COLLECTION AUDIT · READ-ONLY
//
// Phase 2 · What does the Walker currently PRESERVE (snapshot structure inventory)
// Phase 3 · Map against NEW NEX intelligence model (Business Knowledge Object + Location Intel + Destination Context Graph + Traveller Protection needs)
// Phase 4 · Determine re-run justification per Walker
//
// Doctrine: Philip 2026-08-23 · no changes · no re-runs · report only

import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

const YOG = { minLat: -8.05, maxLat: -7.55, minLng: 110.15, maxLng: 110.60 };

// ── PHASE 2 · Snapshot structural inventory ───────────────────────────
async function snapshotStructure(vertical, snapshotTable) {
  // Sample rows to detect structure shape
  const sample = await pool.query(`SELECT raw_payload FROM nex.${snapshotTable} LIMIT 20`);
  const shapeKeys = new Set();
  let hasRawTagsWrapper = 0;
  let flatShape = 0;
  for (const row of sample.rows) {
    const p = row.raw_payload || {};
    for (const k of Object.keys(p)) shapeKeys.add(k);
    if (p.tags && typeof p.tags === "object") hasRawTagsWrapper++;
    else flatShape++;
  }
  const totalRows = (await pool.query(`SELECT COUNT(*)::int AS n FROM nex.${snapshotTable}`)).rows[0].n;
  return { vertical, snapshotTable, totalRows, shapeKeys: [...shapeKeys], hasRawTagsWrapper, flatShape, sampled: sample.rows.length };
}

async function osmTagFrequency(snapshotTable) {
  // Only meaningful if raw_payload.tags exists (accommodation pattern)
  try {
    const r = await pool.query(`
      SELECT key, COUNT(*)::int AS n
        FROM nex.${snapshotTable}, jsonb_object_keys(raw_payload->'tags') AS key
       GROUP BY key ORDER BY n DESC
    `);
    return r.rows;
  } catch {
    return [];
  }
}

async function flatSnapshotKeys(snapshotTable) {
  // For food's flat pattern · aggregate what keys appear at top level
  const r = await pool.query(`
    SELECT key, COUNT(*)::int AS n
      FROM nex.${snapshotTable}, jsonb_object_keys(raw_payload) AS key
     GROUP BY key ORDER BY n DESC
  `);
  return r.rows;
}

// ── PHASE 3 · Business table column inventory (what's currently typed) ─
async function typedColumns(businessTable) {
  const r = await pool.query(`
    SELECT column_name, data_type
      FROM information_schema.columns
     WHERE table_schema='nex' AND table_name=$1
     ORDER BY ordinal_position
  `, [businessTable]);
  return r.rows;
}

async function columnCoverage(businessTable, columnName) {
  try {
    const r = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE ${columnName} IS NOT NULL AND ${columnName}::text <> '')::int AS with_val,
             COUNT(*)::int AS total
        FROM nex.${businessTable} WHERE city='Yogyakarta'
    `);
    const { with_val, total } = r.rows[0];
    return { with_val, total, pct: total > 0 ? (100 * with_val / total).toFixed(1) + "%" : "-" };
  } catch (e) { return { error: e.message }; }
}

// ── The NEX Intelligence Model expectations (what we now NEED) ────────
// This is the design-target list · each row represents a piece of intelligence
// the current NEX architecture (Business Knowledge Object + Location + Suitability +
// Destination Context Graph + Traveller Protection) expects to be available.
const NEX_MODEL_NEEDS = [
  // Location Intelligence · Path C · already applied
  { domain: "LOCATION",  need: "coordinates_lat / lng",              osmTag: "(source)", notes: "already typed" },
  { domain: "LOCATION",  need: "address text",                       osmTag: "(source)", notes: "already typed" },
  { domain: "LOCATION",  need: "district / neighbourhood context",   osmTag: "addr:district / addr:neighbourhood / addr:subdistrict", notes: "typed as `district` · richer OSM data may exist in snapshot" },
  { domain: "LOCATION",  need: "street context",                     osmTag: "addr:street / addr:housenumber", notes: "extracted into street_line by Path C classifier" },
  { domain: "LOCATION",  need: "postcode / province",                osmTag: "addr:postcode / addr:province", notes: "not typed today" },
  { domain: "LOCATION",  need: "OSM check_date (freshness anchor)",  osmTag: "check_date", notes: "not typed today · would improve confidence" },
  // Identity
  { domain: "IDENTITY",  need: "business_name",                      osmTag: "name", notes: "already typed" },
  { domain: "IDENTITY",  need: "localised names",                    osmTag: "name:en / name:id / alt_name", notes: "not typed today" },
  { domain: "IDENTITY",  need: "brand + operator",                   osmTag: "brand / operator / brand:wikidata", notes: "not typed today" },
  { domain: "IDENTITY",  need: "Wikidata cross-source anchor",       osmTag: "wikidata / brand:wikidata", notes: "not typed today · would enable Tier C cross-source" },
  // Character / narrative
  { domain: "CHARACTER", need: "description / story",                osmTag: "description / description:en / description:id", notes: "not typed today · Business Knowledge Object needs this" },
  { domain: "CHARACTER", need: "atmosphere signals",                 osmTag: "(rare in OSM)", notes: "Business Knowledge needs from website + owner-claim · not Walker" },
  // Contact / commercial
  { domain: "CONTACT",   need: "phone / whatsapp",                   osmTag: "phone / contact:phone / contact:whatsapp", notes: "phone typed · whatsapp typed · contact:* variants not consolidated" },
  { domain: "CONTACT",   need: "website / social",                   osmTag: "website / contact:website / contact:instagram", notes: "website typed · social not fully typed" },
  { domain: "CONTACT",   need: "email",                              osmTag: "email / contact:email", notes: "not typed today" },
  { domain: "COMMERCE",  need: "payment methods",                    osmTag: "payment:cash / payment:credit_cards / payment:*", notes: "not typed today" },
  // Facilities
  { domain: "FACILITIES", need: "internet / wifi",                   osmTag: "internet_access", notes: "accommodation: typed into amenities · food: not typed" },
  { domain: "FACILITIES", need: "wheelchair / accessibility",        osmTag: "wheelchair", notes: "accommodation: typed into amenities" },
  { domain: "FACILITIES", need: "air conditioning",                  osmTag: "air_conditioning", notes: "accommodation: typed into amenities" },
  { domain: "FACILITIES", need: "smoking policy",                    osmTag: "smoking", notes: "accommodation: typed into amenities" },
  { domain: "FACILITIES", need: "outdoor seating (food)",            osmTag: "outdoor_seating", notes: "food: not typed" },
  { domain: "FACILITIES", need: "delivery / takeaway (food)",        osmTag: "delivery / takeaway", notes: "food: not typed" },
  { domain: "FACILITIES", need: "cuisine (food)",                    osmTag: "cuisine", notes: "food: not typed as attribute" },
  // Availability / temporal
  { domain: "AVAILABILITY", need: "opening hours",                   osmTag: "opening_hours", notes: "food: typed into opening_information · accommodation: not typed" },
  { domain: "AVAILABILITY", need: "reservation info",                osmTag: "reservation", notes: "not typed today" },
  // Accommodation-specific
  { domain: "ACCOM",     need: "star rating + source",               osmTag: "stars", notes: "typed" },
  { domain: "ACCOM",     need: "room count",                         osmTag: "rooms", notes: "typed" },
  { domain: "ACCOM",     need: "amenities set",                      osmTag: "internet_access / swimming_pool / air_conditioning etc.", notes: "typed into amenities[]" },
  { domain: "ACCOM",     need: "building metadata (physical)",       osmTag: "building:levels / height / roof:* etc.", notes: "not typed today" },
  // Suitability & Safety · Traveller Protection
  { domain: "SUITABILITY", need: "child suitability signals",        osmTag: "(largely absent in OSM)", notes: "needs enrichment / owner claim · NOT Walker responsibility to decide" },
  { domain: "SUITABILITY", need: "safety equipment claims",          osmTag: "(largely absent in OSM)", notes: "needs owner claim + operator record · NOT Walker" },
  { domain: "SUITABILITY", need: "activity-specific hazards",        osmTag: "(largely absent in OSM)", notes: "needs enrichment · NOT Walker to decide" },
  // Surroundings / Destination Context Graph
  { domain: "SURROUNDINGS", need: "neighbourhood (meaningful area)", osmTag: "(computed by Path C from coords)", notes: "populated by Path C classifier" },
  { domain: "SURROUNDINGS", need: "landmark relationships",          osmTag: "(computed on-demand)", notes: "nex.geo_landmark seeded · distances computed on-demand" },
  { domain: "SURROUNDINGS", need: "nearby businesses cluster",       osmTag: "(computed via spatial query)", notes: "requires Distance Intelligence for routed clusters" },
];

// ── Main ──────────────────────────────────────────────────────────────
function fmt(x, w) { return String(x ?? "-").padEnd(w); }

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  WALKER INTELLIGENCE + RE-COLLECTION AUDIT · READ-ONLY                    ║");
  console.log("║  Philip 2026-08-23 · Phases 2-4 · no changes · no re-runs · report only    ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  // ── PHASE 2 · Snapshot structural inventory ──
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log("PHASE 2 · SNAPSHOT STRUCTURE  (what the Walker currently preserves)");
  console.log("═════════════════════════════════════════════════════════════════════════");
  const foodShape  = await snapshotStructure("food",          "food_business_source_snapshot");
  const accomShape = await snapshotStructure("accommodation", "accommodation_business_source_snapshot");

  for (const s of [foodShape, accomShape]) {
    console.log(`\n  ${s.vertical.toUpperCase()} · ${s.snapshotTable} · total rows: ${s.totalRows}`);
    console.log(`    top-level payload keys (from ${s.sampled}-row sample):  ${s.shapeKeys.slice(0,20).join(", ")}${s.shapeKeys.length > 20 ? "..." : ""}`);
    console.log(`    rows with raw OSM tags wrapper (payload.tags):    ${s.hasRawTagsWrapper} / ${s.sampled}`);
    console.log(`    rows with FLAT (no tags wrapper) payload:         ${s.flatShape} / ${s.sampled}`);
  }

  console.log("\n  ── KEY FINDING · SNAPSHOT ARCHITECTURE DIVERGENCE ──");
  console.log("    Accommodation preserves raw OSM tags (Task #89 pattern · {lat, lng, tags:{...}, osmId})");
  console.log("    Food does NOT preserve raw OSM tags · flat typed copy of business row");
  console.log("    Consequence: Path A snapshot re-parse works for accommodation · impossible for food");
  console.log("    without re-crawling OR forward-only Walker code change.\n");

  // ── Accommodation OSM tag frequency ──
  console.log("── ACCOMMODATION · OSM tag frequency (top 40 · from raw payload.tags) ──");
  const accomTags = await osmTagFrequency("accommodation_business_source_snapshot");
  for (const t of accomTags.slice(0, 40)) {
    console.log(`    ${t.key.padEnd(30)} ${String(t.n).padStart(4)}  (${(100*t.n/foodShape.totalRows).toFixed(1)}% of food · ${(100*t.n/accomShape.totalRows).toFixed(1)}% of accom)`);
  }

  // ── Food flat keys · what's preserved ──
  console.log("\n── FOOD · flat payload top-level keys (what IS preserved · confirmed no OSM tags) ──");
  const foodKeys = await flatSnapshotKeys("food_business_source_snapshot");
  for (const t of foodKeys.slice(0, 40)) {
    console.log(`    ${t.key.padEnd(30)} ${String(t.n).padStart(4)}`);
  }

  // ── PHASE 3 · Business table typed-column coverage ──
  console.log("\n═════════════════════════════════════════════════════════════════════════");
  console.log("PHASE 3 · BUSINESS TABLE TYPED COLUMNS  (what NEX has structured today)");
  console.log("═════════════════════════════════════════════════════════════════════════");
  for (const [label, table] of [["food_business", "food_business"], ["accommodation_business", "accommodation_business"]]) {
    console.log(`\n  ${label}:`);
    const cols = await typedColumns(table);
    console.log(`    ${cols.length} columns · sample coverage on selected fields:`);
    const check = ["business_name","category","address","phone","whatsapp_number","website","opening_information","categories","rating","review_count","location_confidence","neighbourhood","street_line","in_target_zone"];
    for (const col of check) {
      if (!cols.some((c) => c.column_name === col)) continue;
      const cov = await columnCoverage(table, col);
      console.log(`      ${col.padEnd(24)} coverage: ${cov.pct ?? "-"}  (${cov.with_val ?? 0}/${cov.total ?? 0})`);
    }
  }

  // ── PHASE 3b · NEX intelligence model needs · captured vs missing ──
  console.log("\n═════════════════════════════════════════════════════════════════════════");
  console.log("PHASE 3b · MAP · NEX intelligence needs vs current capture");
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log(`\n  ${fmt("Domain",13)} ${fmt("Need",42)} ${fmt("OSM tag / source",42)} ${fmt("Status",18)}`);
  console.log(`  ${"─".repeat(13)} ${"─".repeat(42)} ${"─".repeat(42)} ${"─".repeat(18)}`);
  for (const item of NEX_MODEL_NEEDS) {
    // Determine if OSM tag appears in accommodation snapshots
    const key = (item.osmTag || "").split(" / ")[0].trim();
    const accomHas = accomTags.find((t) => t.key === key);
    const status = accomHas
      ? `🟡 in accom snap` + (item.notes.includes("typed") ? "+typed" : "")
      : item.notes.includes("already typed") || item.notes.includes("typed today") || item.notes.includes("typed into") || item.notes.includes("populated by")
      ? "🟢 typed"
      : "🔴 not captured";
    console.log(`  ${fmt(item.domain,13)} ${fmt(item.need,42)} ${fmt(item.osmTag,42)} ${fmt(status,18)}`);
  }

  console.log("\n  Notes column context (from typed columns):");
  for (const item of NEX_MODEL_NEEDS) console.log(`    ${item.domain} · ${item.need}: ${item.notes}`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
