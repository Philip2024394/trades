// src/lib/nex/lab/executors/food-executor.ts
//
// Founder ADR-0304 · Per-domain promotion executor · FOOD.
//
// Takes staged rows from nex_lab.promotion_rows (created when a
// promotion was approved) + joins to nex_lab_food.verified for the
// full field_value blob, then INSERTs into nex.food_business with:
//   · deterministic public_listing_ref (#FB-YYYY-CROCKFORD5)
//   · ON CONFLICT (dedupe_hash) DO NOTHING · idempotent
//   · claim_status='discovered' · owner_status='unknown' (never auto-verified)
//   · source='osm_overpass_via_lab'
//   · source_licence_terms='openstreetmap:odbl-1.0'
//
// Every column that's NOT NULL in nex.food_business is set. Every
// optional column comes from verified.field_value when present.

import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function publicListingRef(dedupeHash: string, prefix: string): string {
  const bytes = Buffer.from(dedupeHash.slice(0, 10), "hex");
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let ref5 = "";
  for (let i = 0; i < 5; i++) {
    ref5 = CROCKFORD[Number(bits & 0x1Fn)] + ref5;
    bits >>= 5n;
  }
  return `#${prefix}-${new Date().getUTCFullYear()}-${ref5}`;
}

function categoriseFood(rawTags: Record<string, unknown> | undefined): { primary: string; all: string[] } {
  const amenity = String(rawTags?.amenity ?? "");
  const shop    = String(rawTags?.shop ?? "");
  const cuisine = String(rawTags?.cuisine ?? "");
  // nex.food_business.category CHECK constraint · only these 4 values:
  //   'restaurant' · 'coffee-cafe' · 'ice-cream-dessert' · 'fast-food'
  let primary: "restaurant" | "coffee-cafe" | "ice-cream-dessert" | "fast-food" = "restaurant";
  const all: string[] = [];
  if (amenity === "cafe")           primary = "coffee-cafe";
  else if (amenity === "fast_food") primary = "fast-food";
  else if (amenity === "ice_cream") primary = "ice-cream-dessert";
  else if (amenity === "food_court") primary = "fast-food"; // closest bucket
  else if (amenity === "bar" || amenity === "pub") primary = "restaurant";
  else if (shop === "convenience")  primary = "fast-food";
  else                              primary = "restaurant";
  all.push(primary);
  if (amenity) all.push(`osm:amenity=${amenity}`);
  if (cuisine) for (const c of cuisine.split(";")) if (c.trim()) all.push(`cuisine:${c.trim()}`);
  return { primary, all };
}

export interface FoodExecuteResult {
  inserted:  number;
  updated:   number;
  skipped:   number;
  errors:    string[];
}

/**
 * Execute the food-domain copy for a specific promotion.
 * Called inside the approvePromotion transaction (client already open).
 */
export async function executeFoodPromotion(
  client: PoolClient,
  promotion_id: string,
): Promise<FoodExecuteResult> {
  const out: FoodExecuteResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  // Pull every verified row associated with this promotion, joined
  // with the full field_value blob from nex_lab_food.verified.
  const rows = (await client.query(
    `SELECT pr.subject_ref, v.field_value, v.confidence, v.evidence_refs, v.source_count
     FROM nex_lab.promotion_rows pr
     JOIN nex_lab_food.verified v ON v.subject_ref = pr.subject_ref
     WHERE pr.promotion_id = $1 AND v.field_name = 'identity'`,
    [promotion_id],
  )).rows;

  for (const r of rows) {
    const fv = r.field_value ?? {};
    const name = String(fv.name ?? "").trim();
    const lat = fv.coordinates?.lat;
    const lon = fv.coordinates?.lon;
    if (!name || typeof lat !== "number" || typeof lon !== "number") {
      out.skipped++;
      continue;
    }
    const dedupeHash = r.subject_ref as string;
    // nex.food_business.public_listing_ref format is '#FL-YYYY-CROCKFORD5'
    // (FL = Food Listing). Regex enforced by CHECK constraint.
    const ref = publicListingRef(dedupeHash, "FL");
    const { primary, all } = categoriseFood(fv.raw_tags as Record<string, unknown> | undefined);
    const cityLabel = fv.city ? String(fv.city).charAt(0).toUpperCase() + String(fv.city).slice(1) : "Yogyakarta";

    const addrText = fv.address
      ? [fv.address.street, fv.address.city].filter(Boolean).join(", ") || null
      : null;

    // SAVEPOINT wrap · Postgres aborts the whole txn on first failing
    // INSERT. Savepoints let us skip bad rows without killing the txn.
    const sp = `sp_${dedupeHash.slice(0, 8)}`;
    await client.query(`SAVEPOINT ${sp}`);
    try {
      // No UNIQUE constraint on dedupe_hash · use explicit exists-check
      // instead of ON CONFLICT (Postgres refuses ON CONFLICT on non-unique
      // columns). Race: two concurrent inserts of the same hash would
      // both pass · we accept that risk because promotions are serialised
      // by the promotion txn.
      const existing = await client.query(
        `SELECT internal_id FROM nex.food_business WHERE dedupe_hash = $1 LIMIT 1`,
        [dedupeHash],
      );
      let wasInsert = true;
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE nex.food_business SET last_verified_at = now(), verification_source = $1 WHERE dedupe_hash = $2`,
          [`lab_promotion:${promotion_id}`, dedupeHash],
        );
        wasInsert = false;
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        out.updated++;
        continue;
      }
      const result = await client.query(`
        INSERT INTO nex.food_business
          (public_listing_ref, business_name, category, address, city, country,
           coordinates_lng, coordinates_lat, phone, website,
           source, source_reference, source_licence_terms, source_updated_at,
           dedupe_hash, claim_status, owner_status,
           categories, location_confidence, geocode_evidence, recovered_evidence,
           last_verified_at, verification_source, source_ingested_at)
        VALUES ($1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10,
                $11, $12, $13, now(),
                $14, 'discovered', 'unknown',
                $15, 'EXACT', $16, '{}'::jsonb,
                now(), $17, now())
        RETURNING internal_id
      `, [
        // NOTE the column order: (coordinates_lng, coordinates_lat)
        // so pass lon FIRST then lat. Swapping this triggered the
        // numeric field overflow on Indonesian lng ≈ 115 into a
        // numeric(8,6) column.
        ref, name, primary, addrText, cityLabel, "ID",
        lon, lat, fv.phone ?? null, fv.website ?? null,
        "osm_overpass_via_lab",
        Array.isArray(r.evidence_refs) ? r.evidence_refs.join(",") : null,
        "openstreetmap:odbl-1.0",
        dedupeHash,
        all,
        JSON.stringify({ confidence: r.confidence, source_count: r.source_count, evidence: r.evidence_refs }),
        `lab_promotion:${promotion_id}`,
      ]);
      if (result.rows[0]?.internal_id) out.inserted++;
      await client.query(`RELEASE SAVEPOINT ${sp}`);
    } catch (err) {
      out.skipped++;
      if (out.errors.length < 5) out.errors.push(`${name}: ${String(err).slice(0, 200)}`);
      try { await client.query(`ROLLBACK TO SAVEPOINT ${sp}`); } catch { /* connection lost · outer will handle */ }
    }
  }
  return out;
}
