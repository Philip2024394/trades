#!/usr/bin/env node
// One-shot backfill · writes source snapshots + field provenance for the
// 10 existing nex.food_business rows that were inserted BEFORE migration 057.
// Safe to re-run (uses ON CONFLICT DO NOTHING on both writes).
import pg from "pg";

const FIELDS = [
  "business_name","category","address","city","district",
  "coordinates_lng","coordinates_lat","phone","whatsapp_number","website",
  "public_social_links","opening_information",
  "hero_image_url","hero_image_source","rating","review_count",
];

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const rows = await pool.query(`
  SELECT * FROM nex.food_business ORDER BY created_at
`);
console.log(`Backfilling ${rows.rowCount} rows...\n`);

let snapshotsWritten = 0;
let provenanceWritten = 0;

for (const r of rows.rows) {
  // Write immutable snapshot from the row itself as reconstructed source
  const snap = await pool.query(
    `INSERT INTO nex.food_business_source_snapshot
       (business_ref, source, source_reference, source_ingested_at,
        source_licence_terms, raw_payload, ingested_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (source, source_reference, source_ingested_at) DO NOTHING
     RETURNING snapshot_id`,
    [
      r.public_listing_ref, r.source, r.source_reference, r.source_ingested_at,
      r.source_licence_terms, JSON.stringify(r), r.created_by ?? "backfill_v1"
    ]
  );
  if (snap.rowCount > 0) snapshotsWritten++;

  // Write initial field provenance · every field starts as source_import
  // (unless the field is null · which means we don't know yet)
  for (const field of FIELDS) {
    const value = r[field];
    if (value === null || value === undefined) continue;   // skip empty
    const prov = await pool.query(
      `INSERT INTO nex.food_business_field_provenance
         (business_ref, field_name, trust_layer, written_at, written_by, source_reference)
       VALUES ($1, $2, 'source_import', $3, $4, $5)
       ON CONFLICT (business_ref, field_name) DO NOTHING
       RETURNING business_ref`,
      [r.public_listing_ref, field, r.source_ingested_at, r.created_by ?? "backfill_v1", r.source_reference]
    );
    if (prov.rowCount > 0) provenanceWritten++;
  }
  console.log(`  ${r.public_listing_ref}  ${r.business_name.padEnd(45)}  snapshot=${snap.rowCount ? "new" : "existing"}`);
}

const snapCount = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.food_business_source_snapshot`);
const provCount = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.food_business_field_provenance`);
console.log(`\nSummary:`);
console.log(`  snapshots written this run   : ${snapshotsWritten}`);
console.log(`  provenance rows written this run: ${provenanceWritten}`);
console.log(`  total snapshots  : ${snapCount.rows[0].n}`);
console.log(`  total provenance : ${provCount.rows[0].n}`);
await pool.end();
