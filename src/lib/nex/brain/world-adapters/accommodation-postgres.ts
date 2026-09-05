// src/lib/nex/brain/world-adapters/accommodation-postgres.ts
//
// Stage 3.34 · Phase 27 · Accommodation Postgres adapter (Philip 2026-08-31).
//
// Reads nex.accommodation_business through the same pool the
// /accommodation customer page uses. Same visibility gate. Same rows.
// Brain and directory always agree.
//
// Constitutional invariants (see world-adapters/types.ts):
//   · Never fabricates a field · unknown = null
//   · Respects the vertical's visibility rule verbatim (VISIBILITY_FILTER)
//   · Emits provenance on every record with the DB read timestamp
//   · Uses standard SQL parameters · no string interpolation of user input

import type {
  WorldAdapter,
  WorldRecord,
  WorldSearchInput,
  WorldSearchResult,
} from "./types";

// SAME visibility rule as the public /accommodation page (see
// src/lib/nex-accommodation/list-businesses.ts). Do not fork.
const VISIBILITY_FILTER = "claim_status IN ('listed','invited','claimed','paying')";

const SELECT_COLS = [
  "public_listing_ref",
  "business_name",
  "category",
  "categories",
  "city",
  "district",
  "address",
  "coordinates_lat",
  "coordinates_lng",
  "phone",
  "whatsapp_number",
  "website",
  "public_social_links",
  "star_rating",
  "room_count",
  "amenities",
  "hero_image_url",
  "rating",
  "review_count",
  "claim_status",
  "owner_status",
  "updated_at",
].join(", ");

// Lazy-import the pool so this module can be imported in test contexts
// that stub Postgres out. Import fails loudly in production if
// NEX_POSTGRES_URL is missing — same behaviour as the rest of the app.
async function getPool() {
  const { getAccommodationDbPool } = await import("@/lib/nex-accommodation/db");
  return getAccommodationDbPool();
}

/**
 * Map a raw nex.accommodation_business row to the canonical WorldRecord.
 * Every optional field is nullified (via undefined) when the DB has NULL
 * so downstream consumers can honestly say "unknown" rather than 0/"".
 */
function rowToRecord(r: Record<string, unknown>, readAt: string): WorldRecord {
  const cat = String(r.category ?? "");
  const rawCategories = Array.isArray(r.categories)
    ? (r.categories as unknown[]).filter((x): x is string => typeof x === "string")
    : undefined;
  const rawAmenities = Array.isArray(r.amenities)
    ? (r.amenities as unknown[]).filter((x): x is string => typeof x === "string")
    : undefined;
  const social = r.public_social_links && typeof r.public_social_links === "object"
    ? (r.public_social_links as Record<string, string>)
    : undefined;
  const claim = String(r.claim_status ?? "");
  const claimStatus =
    claim === "listed" || claim === "invited" || claim === "claimed" || claim === "paying"
      ? claim
      : undefined;

  return {
    id:       String(r.public_listing_ref),
    name:     String(r.business_name ?? "(unnamed)"),
    vertical: "accommodation",
    market:   "ID",
    category: cat || undefined,
    categories: rawCategories,
    city:     r.city != null ? String(r.city) : undefined,
    district: r.district != null ? String(r.district) : undefined,
    address:  r.address != null ? String(r.address) : undefined,
    latitude:  r.coordinates_lat != null ? Number(r.coordinates_lat) : undefined,
    longitude: r.coordinates_lng != null ? Number(r.coordinates_lng) : undefined,
    phone:    r.phone != null ? String(r.phone) : undefined,
    whatsapp: r.whatsapp_number != null ? String(r.whatsapp_number) : undefined,
    website:  r.website != null ? String(r.website) : undefined,
    socialLinks: social,
    heroImage: r.hero_image_url != null ? String(r.hero_image_url) : undefined,
    // `images` not populated · the DB stores only a single hero image
    // reference at this schema version. Adding a gallery is a schema
    // change · not this adapter's job to fabricate one.
    rating:      r.rating != null ? Number(r.rating) : undefined,
    reviewCount: r.review_count != null ? Number(r.review_count) : undefined,
    starRating:  r.star_rating != null ? Number(r.star_rating) : undefined,
    roomCount:   r.room_count != null ? Number(r.room_count) : undefined,
    amenities:   rawAmenities,
    // No price · no availability · the DB schema does not currently
    // publish nightly rates or live availability for accommodation.
    // The Brain will honestly say "no price data" when asked.
    claimStatus,
    verified: r.owner_status === "verified" || r.owner_status === "claimed",
    provenance: {
      sourceKey:  "nex.accommodation_business",
      sourceTier: "directory_live",
      readAt,
    },
    updatedAt: r.updated_at != null ? String(r.updated_at) : undefined,
  };
}

export const AccommodationPostgresAdapter: WorldAdapter = {
  vertical: "accommodation",

  async search(input: WorldSearchInput): Promise<WorldSearchResult> {
    const t0 = performance.now();
    const readAt = new Date().toISOString();

    // Market gate — this adapter is Indonesia only. Return empty for
    // any other market rather than leak Yogyakarta hotels to UK users.
    if (input.market !== "ID") {
      return {
        vertical: "accommodation",
        market:   input.market,
        records:  [],
        totalAvailable: 0,
        latencyMs: performance.now() - t0,
        degradedReason: "market_not_supported",
      };
    }

    const pool = await getPool();

    // Build the WHERE clauses with parameterised inputs. Order:
    //   1. country = 'ID' (locked, this adapter is Indonesia)
    //   2. visibility gate (always applied)
    //   3. optional city
    //   4. optional category (accommodation type: hotel|guesthouse|villa|kos|...)
    //   5. optional text query (business_name ILIKE)
    //   6. optional amenity intersection (amenities @> ARRAY[...])
    const params: unknown[] = ["ID"];
    const clauses: string[] = ["country = $1", VISIBILITY_FILTER];

    if (input.city) {
      params.push(input.city);
      clauses.push(`city ILIKE $${params.length}`);
    }
    if (input.category) {
      params.push(input.category);
      clauses.push(`category = $${params.length}`);
    }
    if (input.query) {
      // 2026-09-05 · Chief-engineer widening: user queries like "hotel
      // near Malioboro" fail against business_name alone (Malioboro is
      // a street, not a hotel name). Widen to also ILIKE-match address
      // and district. Same LIKE pattern, one parameter, one OR group —
      // preserves every prior match (business_name still matched),
      // adds surface for address/district natural-language queries.
      // Visibility gate untouched. No new WHERE clause. Backward-safe.
      params.push(`%${input.query.replace(/[%_]/g, "\\$&")}%`);
      const p = params.length;
      clauses.push(`(business_name ILIKE $${p} OR address ILIKE $${p} OR district ILIKE $${p})`);
    }
    if (input.amenities && input.amenities.length > 0) {
      // amenities is a text[] column · @> is "contains all of".
      params.push(input.amenities as unknown[]);
      clauses.push(`amenities @> $${params.length}::text[]`);
    }

    const where = clauses.join(" AND ");
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);

    // Sort · adapter picks sensible default. Only sorts the DB supports
    // without cross-joins. Distance sort would need a lateral join with
    // haversine · left for a later phase when accommodation gets a
    // spatial index.
    const orderBy =
      input.sort === "rating" ? "rating DESC NULLS LAST, review_count DESC NULLS LAST" :
      input.sort === "recent" ? "updated_at DESC NULLS LAST" :
      "business_name ASC";

    // Count + paginated rows in one round trip when possible. The two
    // queries share the same params · Postgres plans them independently
    // but the pool reuses the connection.
    const [countRes, rowsRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS n FROM nex.accommodation_business WHERE ${where}`,
        params,
      ),
      pool.query(
        `SELECT ${SELECT_COLS}
           FROM nex.accommodation_business
          WHERE ${where}
          ORDER BY ${orderBy}
          LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
    ]);

    const records = rowsRes.rows.map((r) => rowToRecord(r as Record<string, unknown>, readAt));

    return {
      vertical: "accommodation",
      market:   "ID",
      records,
      totalAvailable: Number(countRes.rows[0]?.n ?? 0),
      latencyMs: performance.now() - t0,
    };
  },

  async getById({ id, market }): Promise<WorldRecord | null> {
    if (market !== "ID") return null;
    const readAt = new Date().toISOString();
    const pool = await getPool();
    const q = await pool.query(
      `SELECT ${SELECT_COLS}
         FROM nex.accommodation_business
        WHERE public_listing_ref = $1 AND country = 'ID' AND ${VISIBILITY_FILTER}
        LIMIT 1`,
      [id],
    );
    const row = q.rows[0];
    return row ? rowToRecord(row as Record<string, unknown>, readAt) : null;
  },
};
