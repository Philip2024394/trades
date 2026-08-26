#!/usr/bin/env node
// scripts/nex-enrichment/_path-a-food-persist.mjs
//
// PATH A · FOOD PERSIST
// Reads raw-tags snapshots from nex.food_business_source_snapshot (source='osm_overpass_rehit'
// OR any snapshot whose raw_payload contains a .tags object · i.e. future Walker cycles once
// the raw-tags snapshot writer activates). Extracts OSM attributes NEX Walker does not type
// and persists per-attribute evidence to nex.food_business.recovered_evidence + provenance.
//
// This script never runs against the live 806 backfill process. It only reads snapshots
// AFTER the backfill writes them. Safe to run repeatedly during backfill · idempotent ·
// each run reprocesses only the snapshots that currently exist.
//
// Doctrine anchors:
//   - Truth Invariant (2026-08-22): every recovered attribute carries source + reference +
//     snapshot_id + captured_at + raw_snippet · no invention
//   - Business Knowledge Object (2026-08-23): this write is the food overlay parallel to
//     accommodation P1 · BKO reads recovered_evidence + snapshot chain
//   - Walker stays pure acquisition (2026-08-22): scorer/threshold/listing untouched
//   - Direct-Provenance A (Task #74): provenance row per attribute
//
// What this writes:
//   1. nex.food_business.recovered_evidence      (JSONB per-attribute)
//   2. nex.food_business.evidence_recovered_at   (timestamp)
//   3. nex.food_business.evidence_source         ('osm_snapshot_replay_food_v0.1')
//   4. nex.food_business_field_provenance rows   (field_name='recovered:<key>')
//
// What this NEVER does:
//   - Modify Walker
//   - Change auto-list threshold
//   - Activate any listing
//   - Change customer-facing UI
//   - Introduce a ranking penalty
//   - Read snapshots that are NOT in raw-tags shape (skips flat legacy)
//   - Interfere with the running Overpass backfill process

import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 3 });

const EVIDENCE_SOURCE = "osm_snapshot_replay_food_v0.1";

// ── Shared OSM tag extractors (identical to accommodation P1) ──────────
const SHARED_EXTRACTORS = {
  brand:              (t) => t.brand ? { value: t.brand, raw_snippet: t.brand } : null,
  operator:           (t) => t.operator ? { value: t.operator, raw_snippet: t.operator } : null,
  name_en:            (t) => t["name:en"] ? { value: t["name:en"], raw_snippet: t["name:en"] } : null,
  name_id:            (t) => t["name:id"] ? { value: t["name:id"], raw_snippet: t["name:id"] } : null,
  alt_name:           (t) => t.alt_name ? { value: t.alt_name, raw_snippet: t.alt_name } : null,
  wikidata:           (t) => {
    const v = t.wikidata || t["brand:wikidata"];
    return v ? { value: v, raw_snippet: JSON.stringify({ wikidata: t.wikidata, brand_wikidata: t["brand:wikidata"] }) } : null;
  },
  description:        (t) => t.description ? { value: t.description, raw_snippet: t.description } : null,
  description_en:     (t) => t["description:en"] ? { value: t["description:en"], raw_snippet: t["description:en"] } : null,
  description_id:     (t) => t["description:id"] ? { value: t["description:id"], raw_snippet: t["description:id"] } : null,
  addr_postcode:      (t) => t["addr:postcode"] ? { value: t["addr:postcode"], raw_snippet: t["addr:postcode"] } : null,
  addr_province:      (t) => t["addr:province"] ? { value: t["addr:province"], raw_snippet: t["addr:province"] } : null,
  addr_district:      (t) => t["addr:district"] ? { value: t["addr:district"], raw_snippet: t["addr:district"] } : null,
  addr_neighbourhood: (t) => t["addr:neighbourhood"] ? { value: t["addr:neighbourhood"], raw_snippet: t["addr:neighbourhood"] } : null,
  addr_subdistrict:   (t) => t["addr:subdistrict"] ? { value: t["addr:subdistrict"], raw_snippet: t["addr:subdistrict"] } : null,
  addr_street_raw:    (t) => t["addr:street"] ? { value: t["addr:street"], raw_snippet: t["addr:street"] } : null,
  addr_housenumber:   (t) => t["addr:housenumber"] ? { value: t["addr:housenumber"], raw_snippet: t["addr:housenumber"] } : null,
  opening_hours:      (t) => t.opening_hours ? { value: t.opening_hours, raw_snippet: t.opening_hours } : null,
  check_date:         (t) => t.check_date ? { value: t.check_date, raw_snippet: t.check_date } : null,
  reservation:        (t) => t.reservation ? { value: t.reservation, raw_snippet: t.reservation } : null,
  email:              (t) => {
    const v = t.email || t["contact:email"];
    return v ? { value: v, raw_snippet: v } : null;
  },
  contact_phone:      (t) => t["contact:phone"] ? { value: t["contact:phone"], raw_snippet: t["contact:phone"] } : null,
  contact_whatsapp:   (t) => t["contact:whatsapp"] ? { value: t["contact:whatsapp"], raw_snippet: t["contact:whatsapp"] } : null,
  contact_instagram:  (t) => t["contact:instagram"] ? { value: t["contact:instagram"], raw_snippet: t["contact:instagram"] } : null,
  fax:                (t) => t.fax ? { value: t.fax, raw_snippet: t.fax } : null,
  payment_cash:       (t) => t["payment:cash"] ? { value: t["payment:cash"], raw_snippet: t["payment:cash"] } : null,
  payment_credit_cards: (t) => t["payment:credit_cards"] ? { value: t["payment:credit_cards"], raw_snippet: t["payment:credit_cards"] } : null,
  payment_debit_cards:  (t) => t["payment:debit_cards"] ? { value: t["payment:debit_cards"], raw_snippet: t["payment:debit_cards"] } : null,
  payment_other:      (t) => {
    const keys = Object.keys(t).filter((k) => k.startsWith("payment:") && !["payment:cash","payment:credit_cards","payment:debit_cards"].includes(k));
    if (keys.length === 0) return null;
    const value = Object.fromEntries(keys.map((k) => [k, t[k]]));
    return { value, raw_snippet: JSON.stringify(value) };
  },
  building_levels:    (t) => t["building:levels"] ? { value: t["building:levels"], raw_snippet: t["building:levels"] } : null,
  height:             (t) => t.height ? { value: t.height, raw_snippet: t.height } : null,
  start_date:         (t) => t.start_date ? { value: t.start_date, raw_snippet: t.start_date } : null,
};

// ── Food-specific extractors (OSM tags accommodation doesn't care about) ─
const FOOD_EXTRACTORS = {
  // Cuisine · granular. NEX may cite cuisine as OBSERVED evidence · never invent.
  cuisine:            (t) => t.cuisine ? { value: t.cuisine, raw_snippet: t.cuisine } : null,
  // Dietary. Each is one signal · interpretation happens in Decision Context · NEVER promote
  // to "safe for X" without traveller-protection SCIUD gate.
  diet_vegetarian:    (t) => t["diet:vegetarian"] ? { value: t["diet:vegetarian"], raw_snippet: t["diet:vegetarian"] } : null,
  diet_vegan:         (t) => t["diet:vegan"] ? { value: t["diet:vegan"], raw_snippet: t["diet:vegan"] } : null,
  diet_halal:         (t) => t["diet:halal"] ? { value: t["diet:halal"], raw_snippet: t["diet:halal"] } : null,
  diet_kosher:        (t) => t["diet:kosher"] ? { value: t["diet:kosher"], raw_snippet: t["diet:kosher"] } : null,
  diet_gluten_free:   (t) => t["diet:gluten_free"] ? { value: t["diet:gluten_free"], raw_snippet: t["diet:gluten_free"] } : null,
  diet_dairy_free:    (t) => t["diet:dairy_free"] ? { value: t["diet:dairy_free"], raw_snippet: t["diet:dairy_free"] } : null,
  diet_pescetarian:   (t) => t["diet:pescetarian"] ? { value: t["diet:pescetarian"], raw_snippet: t["diet:pescetarian"] } : null,
  // Service modes
  takeaway:           (t) => t.takeaway ? { value: t.takeaway, raw_snippet: t.takeaway } : null,
  delivery:           (t) => t.delivery ? { value: t.delivery, raw_snippet: t.delivery } : null,
  drive_through:      (t) => t.drive_through ? { value: t.drive_through, raw_snippet: t.drive_through } : null,
  outdoor_seating:    (t) => t.outdoor_seating ? { value: t.outdoor_seating, raw_snippet: t.outdoor_seating } : null,
  indoor_seating:     (t) => t.indoor_seating ? { value: t.indoor_seating, raw_snippet: t.indoor_seating } : null,
  capacity:           (t) => t.capacity ? { value: t.capacity, raw_snippet: t.capacity } : null,
  // Accessibility · evidence only. Interpretation in Decision Context.
  wheelchair:         (t) => t.wheelchair ? { value: t.wheelchair, raw_snippet: t.wheelchair } : null,
  wheelchair_toilets: (t) => t["toilets:wheelchair"] ? { value: t["toilets:wheelchair"], raw_snippet: t["toilets:wheelchair"] } : null,
  toilets:            (t) => t.toilets ? { value: t.toilets, raw_snippet: t.toilets } : null,
  // Family evidence (raw · Decision Context decides if "family-safe" is even sayable)
  changing_table:     (t) => t.changing_table ? { value: t.changing_table, raw_snippet: t.changing_table } : null,
  child_seats:        (t) => t.child_seats ? { value: t.child_seats, raw_snippet: t.child_seats } : null,
  kids_area:          (t) => t.kids_area ? { value: t.kids_area, raw_snippet: t.kids_area } : null,
  // Environmental
  smoking:            (t) => t.smoking ? { value: t.smoking, raw_snippet: t.smoking } : null,
  air_conditioning:   (t) => t.air_conditioning ? { value: t.air_conditioning, raw_snippet: t.air_conditioning } : null,
  wifi:               (t) => t.internet_access ? { value: t.internet_access, raw_snippet: t.internet_access } : null,
  wifi_fee:           (t) => t["internet_access:fee"] ? { value: t["internet_access:fee"], raw_snippet: t["internet_access:fee"] } : null,
  // Alcohol · sensitive · evidence only. Traveller Protection Principle applies at read
  // time. Never auto-derive "family-friendly = no alcohol".
  alcohol:            (t) => t.alcohol ? { value: t.alcohol, raw_snippet: t.alcohol } : null,
  microbrewery:       (t) => t.microbrewery ? { value: t.microbrewery, raw_snippet: t.microbrewery } : null,
  brewery:            (t) => t.brewery ? { value: t.brewery, raw_snippet: t.brewery } : null,
  // Booking / online
  website:            (t) => t.website ? { value: t.website, raw_snippet: t.website } : null,
  facebook:           (t) => t["contact:facebook"] ? { value: t["contact:facebook"], raw_snippet: t["contact:facebook"] } : null,
  // Shop-type distinguishes bakery vs supermarket-with-food · evidence only
  shop:               (t) => t.shop ? { value: t.shop, raw_snippet: t.shop } : null,
  amenity:            (t) => t.amenity ? { value: t.amenity, raw_snippet: t.amenity } : null,
};

const EXTRACTORS = { ...SHARED_EXTRACTORS, ...FOOD_EXTRACTORS };

function extractAll(tags, snapshotInfo) {
  const result = {};
  for (const [key, extractor] of Object.entries(EXTRACTORS)) {
    const r = extractor(tags);
    if (r) {
      result[key] = {
        value: r.value,
        source: "osm_replay",
        source_reference: snapshotInfo.source_reference,
        snapshot_id: snapshotInfo.snapshot_id,
        captured_at: snapshotInfo.captured_at,
        raw_snippet: r.raw_snippet,
        recovered_at: new Date().toISOString(),
      };
    }
  }
  return result;
}

async function loadSnapshots() {
  // Only read snapshots that carry raw OSM tags (raw_payload.tags is an object).
  // Skips flat legacy snapshots that Walker wrote before the raw-tags fix.
  const q = await pool.query(`
    SELECT snapshot_id, business_ref, source, source_reference,
           source_ingested_at AS captured_at, raw_payload
      FROM nex.food_business_source_snapshot
     WHERE raw_payload ? 'tags'
       AND jsonb_typeof(raw_payload->'tags') = 'object'
       AND business_ref IS NOT NULL
     ORDER BY business_ref, source_ingested_at DESC
  `);
  const byRef = new Map();
  for (const row of q.rows) {
    if (!byRef.has(row.business_ref)) byRef.set(row.business_ref, row);
  }
  return byRef;
}

async function main() {
  const started = Date.now();
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  PATH A · FOOD PERSIST                                                    ║");
  console.log("║  Reads raw-tags snapshots · persists recovered_evidence + provenance      ║");
  console.log("║  IDEMPOTENT · REVERSIBLE via DROP COLUMN (rollback in migration 088)      ║");
  console.log("║  Walker/scheduler/scorer untouched · no listing activation · no UI change ║");
  console.log("║  Skips flat legacy snapshots (they have no raw tags to recover)           ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  const snapshots = await loadSnapshots();
  console.log(`Loaded ${snapshots.size} food raw-tags snapshots\n`);

  const counts = {
    rowsScanned: 0,
    rowsWithNoRecovery: 0,
    rowsWithRecovery: 0,
    attributeRowsInserted: 0,
    provenanceRowsUpserted: 0,
    rowsMissingBusinessRef: 0,
    perAttribute: {},
  };

  for (const [businessRef, snap] of snapshots) {
    counts.rowsScanned++;
    const tags = snap.raw_payload?.tags ?? {};
    const recovered = extractAll(tags, {
      snapshot_id: snap.snapshot_id,
      source_reference: snap.source_reference,
      captured_at: snap.captured_at,
    });
    const nAttrs = Object.keys(recovered).length;
    if (nAttrs === 0) { counts.rowsWithNoRecovery++; continue; }

    // Confirm the business row exists BEFORE we write · silently skip and count if it doesn't
    const check = await pool.query(
      `SELECT 1 FROM nex.food_business WHERE public_listing_ref = $1`,
      [businessRef],
    );
    if (check.rowCount === 0) {
      counts.rowsMissingBusinessRef++;
      continue;
    }

    counts.rowsWithRecovery++;
    await pool.query(
      `UPDATE nex.food_business
          SET recovered_evidence    = $1::jsonb,
              evidence_recovered_at = now(),
              evidence_source       = $2
        WHERE public_listing_ref = $3`,
      [JSON.stringify(recovered), EVIDENCE_SOURCE, businessRef],
    );
    counts.attributeRowsInserted += nAttrs;
    for (const k of Object.keys(recovered)) counts.perAttribute[k] = (counts.perAttribute[k] || 0) + 1;

    // Direct-Provenance A · one row per recovered attribute
    for (const [key, ev] of Object.entries(recovered)) {
      await pool.query(
        `INSERT INTO nex.food_business_field_provenance
           (business_ref, field_name, trust_layer, written_at, written_by, source_reference)
         VALUES ($1, $2, 'source_import', now(), $3, $4)
         ON CONFLICT (business_ref, field_name) DO UPDATE SET
           written_at = now(),
           written_by = EXCLUDED.written_by,
           source_reference = EXCLUDED.source_reference`,
        [businessRef, `recovered:${key}`, `agent:${EVIDENCE_SOURCE}`, ev.source_reference || ev.snapshot_id],
      );
      counts.provenanceRowsUpserted++;
    }
  }

  console.log("── COUNTS ─────────────────────────────────────────────────────");
  console.log(`  raw-tags snapshots scanned          : ${counts.rowsScanned}`);
  console.log(`  rows with at least one recovery     : ${counts.rowsWithRecovery}`);
  console.log(`  rows with no recovery (empty tags)  : ${counts.rowsWithNoRecovery}`);
  console.log(`  rows skipped · business_ref missing : ${counts.rowsMissingBusinessRef}`);
  console.log(`  attribute rows written (JSONB keys) : ${counts.attributeRowsInserted}`);
  console.log(`  provenance rows upserted            : ${counts.provenanceRowsUpserted}`);
  console.log("");
  console.log("── PER-ATTRIBUTE RECOVERY ────────────────────────────────────");
  const sorted = Object.entries(counts.perAttribute).sort((a, b) => b[1] - a[1]);
  for (const [k, n] of sorted) console.log(`  ${k.padEnd(24)} ${String(n).padStart(4)}`);
  console.log("");

  console.log("── DOCTRINE COMPLIANCE ────────────────────────────────────────");
  console.log(`  Walker touched:                       NO`);
  console.log(`  Scheduler touched:                    NO`);
  console.log(`  Scorer touched:                       NO`);
  console.log(`  Auto-list threshold changed:          NO`);
  console.log(`  Rows auto-listed:                     0 (no publishing)`);
  console.log(`  Ranking penalty introduced:           NO (recovered_evidence not read by any scorer)`);
  console.log(`  Truth Invariant:                      YES (every attribute carries source+ref+snapshot_id+captured_at+raw_snippet)`);
  console.log(`  Provenance chain:                     YES (field_name=recovered:<key> · trust_layer=source_import)`);
  console.log(`  Idempotent:                           YES (UPDATE overwrites · ON CONFLICT DO UPDATE on provenance)`);
  console.log(`  Reversible:                           YES (migration 088 rollback removes columns)`);
  console.log(`  Flat legacy snapshots read:           NO (WHERE raw_payload ? 'tags' skips them)`);
  console.log(`  Live backfill process interfered:     NO (read-only from snapshots table)`);
  console.log(`  Runtime:                              ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log("");

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
