// scripts/nex-canonical/_bulk-promote-run.mjs
//
// End-to-end bulk admin-attested promotion of Indonesian food businesses.
//
// This uses the SEALED admin-promotion path (same as the first-listing
// operator checklist) applied in bounded batches:
//   1. Insert canonical row from legacy food_business (DISCOVERED)
//   2. Insert business_evidence citing nex_food_business_legacy
//   3. Insert business_canonical_lifecycle_log DISCOVERED -> VERIFIED
//   4. Update business_canonical.lifecycle_state = VERIFIED
//
// Admin-attested per-row: each row carries transition_reason='bulk_admin_promote_2026-10-09'
// so provenance is traceable. Only rows with sufficient fill (name_norm + country
// + city + coordinates) are promoted. Idempotent: ON CONFLICT via (country, osm_id)
// unique index · a repeat run finds existing canonicals and skips.
//
// Reads only from source legacy food_business. Writes atomically per candidate in a
// transaction. Zero fabrication: every field from the source row verbatim.

import pg from "pg";

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);
const DRY_RUN = process.argv.includes("--dry-run");
const TRANSITION_REASON = "bulk_admin_promote_2026-10-09";
const ADMIN_ID = "philip";
const SOURCE_ID = "nex_food_business_legacy";

const client = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
await client.connect();

const t0 = Date.now();

// pull candidates: food_business rows with full fill, not yet canonical
const candidates = await client.query(`
  SELECT fb.internal_id, fb.business_name, fb.city, fb.country,
         fb.coordinates_lat, fb.coordinates_lng, fb.phone, fb.website,
         fb.address, fb.street_line, fb.neighbourhood, fb.district,
         fb.source_reference, fb.source,
         fb.categories, fb.canonical_business_id
    FROM nex.food_business fb
   WHERE fb.business_name IS NOT NULL
     AND length(trim(fb.business_name)) > 0
     AND fb.country = 'ID'
     AND fb.city IS NOT NULL
     AND fb.coordinates_lat IS NOT NULL
     AND fb.coordinates_lng IS NOT NULL
     AND fb.canonical_business_id IS NULL
     AND fb.source_reference ~ '^(node|way|relation)/[0-9]+$'
   ORDER BY fb.internal_id
   LIMIT $1
`, [BATCH_SIZE]);

console.log(`candidates fetched: ${candidates.rowCount}`);
console.log(`dry-run: ${DRY_RUN}`);

if (DRY_RUN) {
  console.log("sample:", candidates.rows.slice(0, 3).map(r => ({
    name: r.business_name, city: r.city, osm: r.source_reference,
    has_phone: !!r.phone, has_website: !!r.website, has_address: !!r.address,
  })));
  await client.end();
  process.exit(0);
}

// Normalise helpers
const normPhone = (p) => {
  if (!p || typeof p !== "string") return null;
  const t = p.trim();
  return /^\+[1-9][0-9]{6,14}$/.test(t) ? t : null;
};
const canonWeb = (w) => {
  if (!w || typeof w !== "string") return null;
  let s = w.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
  return s.includes(".") ? s : null;
};
const osmId = (ref) => (ref && ref.match(/^(node|way|relation)\/\d+$/) ? ref : null);

let inserted_canonical = 0;
let skipped_existing_osm = 0;
let inserted_evidence = 0;
let promoted_lifecycle = 0;
let failed = 0;
const failures = [];

for (const row of candidates.rows) {
  try {
    await client.query("BEGIN");

    const addrJsonb = row.address || row.street_line || row.neighbourhood || row.district
      ? JSON.stringify({
          line1: row.street_line || null,
          address_free: row.address || null,
          neighbourhood: row.neighbourhood || null,
          district: row.district || null,
        })
      : null;

    // 1) insert canonical (DISCOVERED) · idempotent via (country, osm_id) partial unique
    const insC = await client.query(`
      INSERT INTO nex.business_canonical (
        entity_type, country, lifecycle_state, name_canonical,
        phone_e164, website_apex, osm_id, city, district,
        street_line, neighbourhood, address, coordinates,
        category_ids, last_verified_at
      ) VALUES (
        'food', $1, 'DISCOVERED', $2,
        $3, $4, $5, $6, $7,
        $8, $9, $10::jsonb,
        ST_SetSRID(ST_MakePoint($11::float8, $12::float8), 4326)::geography,
        $13::text[], now()
      )
      ON CONFLICT (country, osm_id) WHERE osm_id IS NOT NULL
      DO NOTHING
      RETURNING canonical_business_id
    `, [
      row.country,
      row.business_name.trim(),
      normPhone(row.phone),
      canonWeb(row.website),
      osmId(row.source_reference),
      row.city,
      row.district,
      row.street_line,
      row.neighbourhood,
      addrJsonb,
      row.coordinates_lng,
      row.coordinates_lat,
      Array.isArray(row.categories) && row.categories.length > 0 ? row.categories : ['food'],
    ]);

    let canonId;
    if (insC.rowCount === 0) {
      // conflict · fetch existing
      const existing = await client.query(
        `SELECT canonical_business_id FROM nex.business_canonical WHERE country = $1 AND osm_id = $2`,
        [row.country, osmId(row.source_reference)]
      );
      if (existing.rowCount === 0) {
        await client.query("ROLLBACK");
        failed++;
        failures.push({ internal_id: row.internal_id, reason: "insert returned 0 but no existing row" });
        continue;
      }
      canonId = existing.rows[0].canonical_business_id;
      skipped_existing_osm++;
    } else {
      canonId = insC.rows[0].canonical_business_id;
      inserted_canonical++;
    }

    // 2) backlink legacy row to canonical (169 FK column)
    await client.query(
      `UPDATE nex.food_business SET canonical_business_id = $1 WHERE internal_id = $2 AND canonical_business_id IS NULL`,
      [canonId, row.internal_id]
    );

    // 3) business_evidence · one per promotion · idempotent via (canonical, source, observation_generator)
    const evInsert = await client.query(`
      INSERT INTO nex.business_evidence (
        canonical_business_id, source_id, field_path, value_jsonb,
        observed_at, observation_generator, source_reference
      ) VALUES ($1, $2, $3, $4::jsonb, now(), $5, $6)
      ON CONFLICT DO NOTHING
      RETURNING evidence_id
    `, [
      canonId,
      SOURCE_ID,
      "identity",
      JSON.stringify({
        name_canonical: row.business_name.trim(),
        city: row.city,
        country: row.country,
        osm_id: osmId(row.source_reference),
        coordinates: { lat: row.coordinates_lat, lng: row.coordinates_lng },
      }),
      TRANSITION_REASON,
      row.source_reference,
    ]);
    if (evInsert.rowCount && evInsert.rowCount > 0) inserted_evidence++;

    // 4) lifecycle promotion · admin-attested
    const curState = await client.query(
      `SELECT lifecycle_state FROM nex.business_canonical WHERE canonical_business_id = $1`,
      [canonId]
    );
    const state = curState.rows[0].lifecycle_state;
    if (state === "DISCOVERED") {
      await client.query(`
        INSERT INTO nex.business_canonical_lifecycle_log (
          canonical_business_id, from_state, to_state, transition_reason,
          transitioned_by, transitioned_at, decision_record
        ) VALUES ($1, 'DISCOVERED', 'VERIFIED', $2, $3, now(), $4::jsonb)
      `, [canonId, TRANSITION_REASON, ADMIN_ID, JSON.stringify({ bulk_run: true, legacy_internal_id: row.internal_id })]);
      await client.query(`
        UPDATE nex.business_canonical
           SET lifecycle_state = 'VERIFIED', last_verified_at = now(), updated_at = now()
         WHERE canonical_business_id = $1 AND lifecycle_state = 'DISCOVERED'
      `, [canonId]);
      promoted_lifecycle++;
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    failed++;
    failures.push({ internal_id: row.internal_id, reason: String(e.message || e).slice(0, 160) });
  }
}

const r_after = await client.query("SELECT COUNT(*)::int AS n FROM nex.business_canonical");
const r_dir = await client.query("SELECT COUNT(*)::int AS n FROM nex.business_directory_v");

console.log(JSON.stringify({
  elapsed_s: Math.round((Date.now() - t0) / 1000),
  candidates_pulled: candidates.rowCount,
  inserted_canonical,
  skipped_existing_osm,
  inserted_evidence,
  promoted_lifecycle,
  failed,
  canonical_total_after: r_after.rows[0].n,
  directory_v_total_after: r_dir.rows[0].n,
  sample_failures: failures.slice(0, 5),
}, null, 2));

await client.end();
