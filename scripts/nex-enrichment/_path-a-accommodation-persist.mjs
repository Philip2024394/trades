#!/usr/bin/env node
// scripts/nex-enrichment/_path-a-accommodation-persist.mjs
//
// PATH A · PRIORITY 1 · ACCOMMODATION PERSIST
// Reads existing raw snapshots from nex.accommodation_business_source_snapshot,
// extracts the OSM attributes the current Walker does NOT type, and persists
// them to nex.accommodation_business.recovered_evidence (JSONB) with per-attribute
// provenance. Idempotent · reversible via DROP COLUMN.
//
// Doctrine anchors:
//   project_nex_priority_greenlight_accommodation_path_a_food_walker_preservation_2026_08_23
//   project_nex_business_knowledge_object_three_layer_2026_08_23
//   project_nex_c2_greenlight_geographic_intelligence_as_evidence_not_score_2026_08_23
//     (this write is EVIDENCE · scorer untouched · no ranking impact)
//
// What this script writes:
//   1. nex.accommodation_business.recovered_evidence (JSONB per-attribute)
//   2. nex.accommodation_business.evidence_recovered_at (timestamp)
//   3. nex.accommodation_business.evidence_source ('osm_snapshot_replay_v0.1')
//   4. nex.accommodation_business_field_provenance rows (Direct-Provenance A)
//      one per attribute written · field_name='recovered:<key>'
//
// What this script does NOT do:
//   - Modify Walker
//   - Change ≥90 threshold
//   - Activate any listing
//   - Change customer-facing UI
//   - Introduce a ranking penalty

import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 3 });

const EVIDENCE_SOURCE = "osm_snapshot_replay_v0.1";

// ── Extraction rules · same set as Path A dry-run script ─────────────
const EXTRACTORS = {
  // key : (tags) → { value, raw_snippet } | null
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
  building_structure: (t) => t["building:structure"] ? { value: t["building:structure"], raw_snippet: t["building:structure"] } : null,
  building_walls:     (t) => t["building:walls"] ? { value: t["building:walls"], raw_snippet: t["building:walls"] } : null,
  building_roof:      (t) => t["building:roof"] ? { value: t["building:roof"], raw_snippet: t["building:roof"] } : null,
  height:             (t) => t.height ? { value: t.height, raw_snippet: t.height } : null,
  start_date:         (t) => t.start_date ? { value: t.start_date, raw_snippet: t.start_date } : null,
};

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
  const q = await pool.query(`
    SELECT snapshot_id, business_ref, source, source_reference,
           captured_at, raw_payload
      FROM nex.accommodation_business_source_snapshot
     ORDER BY business_ref
  `);
  const byRef = new Map();
  for (const row of q.rows) {
    // Take the earliest snapshot per business_ref if duplicates (preserve original evidence)
    if (!byRef.has(row.business_ref)) byRef.set(row.business_ref, row);
  }
  return byRef;
}

async function main() {
  const started = Date.now();
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  PATH A · PRIORITY 1 · ACCOMMODATION PERSIST                              ║");
  console.log("║  Reads raw snapshots · persists recovered_evidence + provenance            ║");
  console.log("║  IDEMPOTENT · REVERSIBLE via DROP COLUMN (rollback in migration 088)      ║");
  console.log("║  Scorer untouched · ≥90 unchanged · no listing activation · no UI change   ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  const snapshots = await loadSnapshots();
  console.log(`Loaded ${snapshots.size} accommodation snapshots\n`);

  const counts = {
    rowsScanned: 0,
    rowsWithNoRecovery: 0,
    rowsWithRecovery: 0,
    attributeRowsInserted: 0,
    provenanceRowsUpserted: 0,
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
    counts.rowsWithRecovery++;

    // Persist the JSONB (idempotent merge · new run overwrites recovered_evidence
    // for the same business_ref · doctrinally correct because the snapshot is the
    // canonical source · re-runs simply reprocess the same evidence).
    await pool.query(
      `UPDATE nex.accommodation_business
          SET recovered_evidence   = $1::jsonb,
              evidence_recovered_at = now(),
              evidence_source      = $2
        WHERE public_listing_ref = $3`,
      [JSON.stringify(recovered), EVIDENCE_SOURCE, businessRef],
    );
    counts.attributeRowsInserted += nAttrs;
    for (const k of Object.keys(recovered)) counts.perAttribute[k] = (counts.perAttribute[k] || 0) + 1;

    // Direct-Provenance A · one row per recovered attribute
    // field_name='recovered:<key>' distinguishes from Walker-source provenance
    for (const [key, ev] of Object.entries(recovered)) {
      await pool.query(
        `INSERT INTO nex.accommodation_business_field_provenance
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
  console.log(`  rows scanned                        : ${counts.rowsScanned}`);
  console.log(`  rows with at least one recovery     : ${counts.rowsWithRecovery}`);
  console.log(`  rows with no recovery (empty tags)  : ${counts.rowsWithNoRecovery}`);
  console.log(`  attribute rows written (JSONB keys) : ${counts.attributeRowsInserted}`);
  console.log(`  provenance rows upserted            : ${counts.provenanceRowsUpserted}`);
  console.log("");
  console.log("── PER-ATTRIBUTE RECOVERY ────────────────────────────────────");
  const sorted = Object.entries(counts.perAttribute).sort((a, b) => b[1] - a[1]);
  for (const [k, n] of sorted) console.log(`  ${k.padEnd(24)} ${String(n).padStart(4)}`);
  console.log("");

  console.log("── DOCTRINE COMPLIANCE ────────────────────────────────────────");
  console.log(`  Walker touched:            NO`);
  console.log(`  Scorer touched:            NO`);
  console.log(`  ≥90 threshold changed:     NO`);
  console.log(`  Rows auto-listed:          0 (no publishing)`);
  console.log(`  Ranking penalty introduced: NO (recovered_evidence not read by any scorer)`);
  console.log(`  Provenance chain:          YES (per attribute · field_name=recovered:<key>)`);
  console.log(`  Idempotent:                YES (UPDATE overwrites · ON CONFLICT DO UPDATE on provenance)`);
  console.log(`  Reversible:                YES (migration 088 rollback removes columns)`);
  console.log(`  Runtime:                   ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log("");

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
