#!/usr/bin/env node
// scripts/nex-canonical/populate-business-leads-from-food-2026-10-12.mjs
//
// Founder-authorised 2026-10-12 · "Make eligible business contact
// records available for NEX marketing".
//
// Source: nex.food_business WHERE country='ID' AND canonical_business_id
// IS NOT NULL AND (phone IS NOT NULL OR whatsapp_number IS NOT NULL
// OR website IS NOT NULL).
//
// Target: nex.business_lead_directory with commercial_status='discovered'
// (entry state · not yet qualified for marketing · marketing_ready_at
// stays NULL until a separate qualification pass).
//
// Idempotency: deterministic `public_listing_ref` derived from SHA256
// of dedupe_hash (first 25 bits → 5 Crockford Base32 chars). Rerunning
// the script produces identical refs; ON CONFLICT (public_listing_ref)
// DO NOTHING silently skips any already-inserted lead. Dedupe is also
// enforced upstream of the INSERT by filtering rows whose dedupe_hash
// already exists in business_lead_directory.
//
// Safety: READ-ONLY probe first (counts expected inserts); SELECT the
// candidate set; INSERT in 500-row batches with explicit COMMIT per
// batch so a mid-run failure leaves a clean, inspectable state.
//
// Rollback: `DELETE FROM nex.business_lead_directory WHERE
// verification_source = 'founder_backfill_2026_10_12_from_food_business'`.

import pg from "pg";
import { createHash } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function listingRefFromHash(dedupeHash) {
  const buf = createHash("sha256").update(dedupeHash).digest();
  // Read 25 bits from the first 4 bytes.
  const n = buf.readUInt32BE(0) >>> 7; // top 25 bits
  let s = "";
  let x = n;
  for (let i = 0; i < 5; i++) {
    s = CROCKFORD[x & 31] + s;
    x = x >>> 5;
  }
  const year = new Date().getUTCFullYear();
  return `#BL-${year}-${s}`;
}

function pickCategorySlug(row) {
  // nex.food_business.category is NOT NULL per sampled data; keep
  // slug-safe. category_group is intentionally "food" for every row
  // this script writes (we're reading from food_business only).
  const raw = (row.category || "food-unclassified")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw || "food-unclassified";
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
  await client.connect();

  const DRY_RUN = process.argv.includes("--dry-run");
  const LIMIT = Number(process.env.BLD_BACKFILL_LIMIT || 0) || null;

  console.log(JSON.stringify({ phase: "pre-count", dry_run: DRY_RUN, limit: LIMIT }));
  const pre = await client.query(`SELECT count(*)::int AS n FROM nex.business_lead_directory`);
  console.log(JSON.stringify({ phase: "pre-count", bld_rows_before: pre.rows[0].n }));

  const selectSql = `
    SELECT f.internal_id,
           f.business_name,
           f.category,
           f.city,
           f.district,
           f.neighbourhood,
           f.address,
           f.coordinates_lng,
           f.coordinates_lat,
           f.phone,
           f.whatsapp_number,
           f.website,
           f.source,
           f.source_reference,
           f.source_licence_terms,
           f.source_ingested_at,
           f.source_updated_at,
           f.last_verified_at,
           f.verification_source,
           f.dedupe_hash
      FROM nex.food_business f
     WHERE f.country = 'ID'
       AND f.canonical_business_id IS NOT NULL
       AND (f.phone IS NOT NULL OR f.whatsapp_number IS NOT NULL OR f.website IS NOT NULL)
       AND f.business_name IS NOT NULL
       AND f.city IS NOT NULL
       AND f.dedupe_hash IS NOT NULL
       AND f.dedupe_hash NOT IN (SELECT dedupe_hash FROM nex.business_lead_directory WHERE dedupe_hash IS NOT NULL)
     ORDER BY f.internal_id
     ${LIMIT ? "LIMIT " + LIMIT : ""}
  `;

  const rows = (await client.query(selectSql)).rows;
  console.log(JSON.stringify({ phase: "candidate-set", candidates: rows.length }));

  if (DRY_RUN) {
    console.log(JSON.stringify({ phase: "dry-run-exit", would_insert: rows.length }));
    await client.end();
    return;
  }

  const BATCH = 500;
  let inserted = 0;
  let conflicts = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let p = 1;
    for (const r of chunk) {
      const ref = listingRefFromHash(r.dedupe_hash);
      const slug = pickCategorySlug(r);
      values.push(
        `($${p++}, $${p++}, $${p++}, $${p++}, ARRAY[$${p++}]::text[], $${p++}, $${p++}, $${p++}, 'ID', $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, ARRAY[]::text[], $${p++}, 'osm_overpass', $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, 'listed', false, false, 'public', 'discovered', false, now(), now())`
      );
      params.push(
        ref,                                   // public_listing_ref
        r.business_name,                       // business_name
        slug,                                  // category_slug
        "food",                                // category_group
        slug,                                  // categories (ARRAY[slug])
        r.address,                             // address
        r.city,                                // city
        r.district,                            // district
        r.coordinates_lng,                     // coordinates_lng
        r.coordinates_lat,                     // coordinates_lat
        r.phone,                               // phone
        r.whatsapp_number,                     // whatsapp_number
        null,                                  // email · OSM food_business has no email column
        r.website,                             // website
        r.source_reference,                    // source_reference
        r.source_licence_terms,                // source_licence_terms
        r.source_ingested_at,                  // source_ingested_at
        r.source_updated_at,                   // source_updated_at
        r.last_verified_at,                    // last_verified_at
        "founder_backfill_2026_10_12_from_food_business", // verification_source
        r.dedupe_hash,                         // dedupe_hash
      );
    }
    const insertSql = `
      INSERT INTO nex.business_lead_directory (
        public_listing_ref, business_name, category_slug, category_group, categories,
        address, city, district, country, coordinates_lng, coordinates_lat,
        phone, whatsapp_number, email, additional_emails, website,
        source, source_reference, source_licence_terms, source_ingested_at, source_updated_at,
        last_verified_at, verification_source, dedupe_hash,
        status, claimed, verified, visibility, commercial_status, contact_opt_out, created_at, updated_at
      ) VALUES ${values.join(",")}
      ON CONFLICT (public_listing_ref) DO NOTHING
      RETURNING internal_id
    `;
    try {
      await client.query("BEGIN");
      const res = await client.query(insertSql, params);
      await client.query("COMMIT");
      inserted += res.rowCount;
      conflicts += chunk.length - res.rowCount;
      console.log(JSON.stringify({
        phase: "batch",
        batch_index: Math.floor(i / BATCH) + 1,
        batch_size: chunk.length,
        inserted_this_batch: res.rowCount,
        conflicts_this_batch: chunk.length - res.rowCount,
        total_inserted: inserted,
      }));
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(JSON.stringify({
        phase: "batch-error",
        batch_index: Math.floor(i / BATCH) + 1,
        error: e.message,
      }));
      throw e;
    }
  }

  const post = await client.query(`SELECT count(*)::int AS n FROM nex.business_lead_directory`);
  console.log(JSON.stringify({
    phase: "done",
    bld_rows_after: post.rows[0].n,
    inserted,
    conflicts_skipped: conflicts,
  }));

  // Final readback: who's got what contact channels.
  const breakdown = await client.query(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE email IS NOT NULL)::int AS has_email,
           count(*) FILTER (WHERE whatsapp_number IS NOT NULL)::int AS has_whatsapp,
           count(*) FILTER (WHERE email IS NOT NULL AND whatsapp_number IS NOT NULL)::int AS has_both,
           count(*) FILTER (WHERE email IS NULL AND whatsapp_number IS NULL)::int AS has_neither,
           count(*) FILTER (WHERE phone IS NOT NULL)::int AS has_phone,
           count(*) FILTER (WHERE website IS NOT NULL)::int AS has_website
      FROM nex.business_lead_directory
  `);
  console.log(JSON.stringify({ phase: "contact-breakdown", ...breakdown.rows[0] }));

  await client.end();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
