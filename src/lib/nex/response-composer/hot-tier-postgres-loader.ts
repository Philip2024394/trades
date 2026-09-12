// src/lib/nex/response-composer/hot-tier-postgres-loader.ts
//
// Wires the HotAccommodationTier to the actual nex.accommodation_business
// table via a single scan on server start (or scheduled refresh).
//
// Called ONCE at load time · then every query lookup happens in-memory.
// Founder mandate: aggressively avoid Postgres · this is the "hot data"
// layer that makes 218 ms Postgres median irrelevant for read-path queries.
//
// The loader accepts a caller-provided pool so tests can inject a fake pool.
// Not tied to production DB init.

import type { Pool } from "pg";
import { performance } from "node:perf_hooks";
import type { HotAccommodationRecord, HotTierLoader } from "./hot-accommodation-tier.js";

/**
 * Build a HotTierLoader closure over a caller-provided Pool.
 * Filters to visible records per accommodation-postgres.ts convention.
 */
export function buildHotTierPostgresLoader(pool: Pool, opts: {
  onlyVisible?: boolean;          // default true (matches accommodation-postgres.ts)
  cityFilter?: string | null;     // null = all
  limit?: number | null;          // null = all
} = {}): HotTierLoader {
  const onlyVisible = opts.onlyVisible ?? true;
  const cityFilter = opts.cityFilter ?? null;
  const limit = opts.limit ?? null;

  return async () => {
    const t0 = performance.now();
    const wheres: string[] = [];
    const params: unknown[] = [];
    if (onlyVisible) {
      wheres.push(`claim_status IN ('listed','invited','claimed','paying')`);
    }
    if (cityFilter) {
      params.push(cityFilter.toLowerCase());
      wheres.push(`LOWER(city) = $${params.length}`);
    }
    let sql = `
      SELECT
        public_listing_ref,
        business_name,
        city,
        district,
        address,
        coordinates_lat,
        coordinates_lng,
        categories,
        amenities,
        star_rating,
        room_count,
        rating,
        review_count,
        claim_status,
        updated_at
      FROM nex.accommodation_business
    `;
    if (wheres.length > 0) sql += `\nWHERE ${wheres.join(" AND ")}`;
    sql += `\nORDER BY public_listing_ref`;
    if (limit != null) sql += `\nLIMIT ${Math.max(1, Math.floor(limit))}`;

    const res = await pool.query(sql, params);
    const source_query_ms = Math.round((performance.now() - t0) * 100) / 100;

    const records: HotAccommodationRecord[] = res.rows.map((row) => ({
      public_listing_ref: String(row.public_listing_ref),
      business_name: String(row.business_name ?? ""),
      city: row.city ? String(row.city) : null,
      district: row.district ? String(row.district) : null,
      address: row.address ? String(row.address) : null,
      coordinates_lat: row.coordinates_lat != null ? Number(row.coordinates_lat) : null,
      coordinates_lng: row.coordinates_lng != null ? Number(row.coordinates_lng) : null,
      categories: normalizeArrayField(row.categories),
      amenities: normalizeArrayField(row.amenities),
      star_rating: row.star_rating != null ? Number(row.star_rating) : null,
      room_count: row.room_count != null ? Number(row.room_count) : null,
      rating: row.rating != null ? Number(row.rating) : null,
      review_count: row.review_count != null ? Number(row.review_count) : null,
      claim_status: String(row.claim_status ?? "unknown"),
      updated_at_iso: row.updated_at ? new Date(row.updated_at).toISOString() : new Date(0).toISOString(),
      _name_lower: "", // populated by tier.load()
      _city_lower: null, // populated by tier.load()
    }));

    return { records, source_query_ms };
  };
}

function normalizeArrayField(field: unknown): string[] {
  if (Array.isArray(field)) return field.map(String);
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch { /* fall through */ }
    return field.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
