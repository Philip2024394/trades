#!/usr/bin/env node
// scripts/inspect-source-snapshot-breakfast.mjs
//
// Diagnostic · what does accommodation_business_source_snapshot legitimately contain
// re: breakfast? Reads a small sample · no writes · no external calls.

import pg from "pg";
const { Pool } = pg;
const conn = process.env.NEX_POSTGRES_URL;
if (!conn) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

const pool = new Pool({ connectionString: conn, max: 2 });

const rows = await pool.query(`
  SELECT
    s.business_ref,
    b.business_name,
    b.city,
    b.amenities,
    s.raw_payload
  FROM nex.accommodation_business_source_snapshot s
  JOIN nex.accommodation_business b ON b.public_listing_ref = s.business_ref
  WHERE b.city = 'Yogyakarta' AND b.claim_status IN ('listed','invited','claimed','paying')
  LIMIT 5
`);

for (const r of rows.rows) {
  console.log("─".repeat(78));
  console.log(`property : ${r.business_name}  (${r.business_ref})`);
  console.log(`city     : ${r.city}`);
  console.log(`amenities: ${JSON.stringify(r.amenities)}`);
  const payload = r.raw_payload ?? {};
  // Look for known breakfast-related keys in the JSONB
  const keys = Object.keys(payload);
  const breakfastKeys = keys.filter((k) => /breakfast|meal|kitchen/i.test(k));
  console.log(`payload_top_keys (${keys.length}): ${keys.slice(0, 10).join(", ")}${keys.length > 10 ? "..." : ""}`);
  if (breakfastKeys.length > 0) {
    console.log(`breakfast_keys: ${breakfastKeys.join(", ")}`);
    for (const k of breakfastKeys) console.log(`  ${k}: ${JSON.stringify(payload[k])}`);
  } else {
    console.log(`breakfast_keys: (none in top-level)`);
  }
  // Sample the OSM tags block if present
  const osm = payload.tags ?? payload.osm_tags ?? payload.raw_tags;
  if (osm && typeof osm === "object") {
    const tagKeys = Object.keys(osm);
    const breakfastTags = tagKeys.filter((k) => /breakfast|meal|internet_access|wheelchair|payment/i.test(k));
    console.log(`osm_tags_keys (${tagKeys.length}): ${tagKeys.slice(0, 10).join(", ")}${tagKeys.length > 10 ? "..." : ""}`);
    if (breakfastTags.length > 0) {
      console.log(`breakfast_tags: ${breakfastTags.join(", ")}`);
      for (const k of breakfastTags) console.log(`  ${k}: ${JSON.stringify(osm[k])}`);
    }
  }
}

await pool.end();
