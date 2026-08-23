// src/lib/nex-accommodation/list-businesses.ts
//
// Task #89 Phase B (2026-08-22) · SSR loader for accommodation focused routes.
//
// Filters nex.accommodation_business by:
//   · city='Yogyakarta'
//   · claim_status IN ('listed','invited','claimed','paying')  (customer-visible only)
//   · category (when narrowing to a focused route like /hotel · /villa · /kos)
//
// Same visibility filter shape as nex-food/directory-adapter.ts · Walker's
// 881 'discovered' rows are NOT surfaced to customers until admin promotion
// (Phase C · same doctrine as Food).
//
// Currently: 881 rows all at 'discovered' → focused routes render EMPTY state
// (correct behaviour · not a bug). This proves the visibility gate holds ·
// admin promotion is required to populate customer views.

import { getAccommodationDbPool } from "./db";
import { DEFAULT_MARKET } from "@/lib/nex/directoryCountry";

export interface AccommodationListing {
  publicListingRef: string;
  businessName: string;
  category: string;
  categories: string[];
  city: string;
  district: string | null;
  address: string | null;
  coordinatesLat: number | null;
  coordinatesLng: number | null;
  phone: string | null;
  whatsappNumber: string | null;
  website: string | null;
  publicSocialLinks: Record<string, string>;
  starRating: number | null;
  roomCount: number | null;
  amenities: string[];
  heroImageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  claimStatus: string;
  ownerStatus: string;
}

const VISIBILITY_FILTER = "claim_status IN ('listed','invited','claimed','paying')";

export async function loadAccommodationListings(opts: {
  category?: string;  // when defined · narrows to focused route (e.g. 'hotel')
  city?: string;      // defaults 'Yogyakarta'
  country?: string;   // Country Foundation Step 5 (2026-08-22) · ISO-2 · defaults DEFAULT_MARKET ('ID')
  limit?: number;     // safety cap · default 500
}): Promise<AccommodationListing[]> {
  const pool = getAccommodationDbPool();
  const city = opts.city ?? "Yogyakarta";
  const country = opts.country ?? DEFAULT_MARKET;
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 1000);

  const params: unknown[] = [city, country];
  let sql = `
    SELECT
      public_listing_ref, business_name, category, categories,
      city, district, address, coordinates_lat, coordinates_lng,
      phone, whatsapp_number, website, public_social_links,
      star_rating, room_count, amenities,
      hero_image_url, rating, review_count,
      claim_status, owner_status
    FROM nex.accommodation_business
    WHERE city = $1 AND country = $2 AND ${VISIBILITY_FILTER}
  `;
  if (opts.category) {
    params.push(opts.category);
    sql += ` AND category = $${params.length}`;
  }
  sql += ` ORDER BY business_name LIMIT ${limit}`;

  const q = await pool.query(sql, params);
  return q.rows.map((r): AccommodationListing => ({
    publicListingRef:  r.public_listing_ref,
    businessName:      r.business_name,
    category:          r.category,
    categories:        Array.isArray(r.categories) ? r.categories : [],
    city:              r.city,
    district:          r.district,
    address:           r.address,
    coordinatesLat:    r.coordinates_lat != null ? Number(r.coordinates_lat) : null,
    coordinatesLng:    r.coordinates_lng != null ? Number(r.coordinates_lng) : null,
    phone:             r.phone,
    whatsappNumber:    r.whatsapp_number,
    website:           r.website,
    publicSocialLinks: (r.public_social_links as Record<string, string>) ?? {},
    starRating:        r.star_rating != null ? Number(r.star_rating) : null,
    roomCount:         r.room_count != null ? Number(r.room_count) : null,
    amenities:         Array.isArray(r.amenities) ? r.amenities : [],
    heroImageUrl:      r.hero_image_url,
    rating:            r.rating != null ? Number(r.rating) : null,
    reviewCount:       r.review_count != null ? Number(r.review_count) : null,
    claimStatus:       r.claim_status,
    ownerStatus:       r.owner_status,
  }));
}

// Discovery-universe count (independent of visibility · used for empty-state copy).
// Shows the admin how many undiscovered rows are waiting behind the promotion gate.
export async function countAccommodationDiscovered(opts: {
  category?: string;
  city?: string;
  country?: string;   // Country Foundation Step 5 (2026-08-22) · ISO-2 · defaults DEFAULT_MARKET ('ID')
}): Promise<{ visible: number; discovered: number; total: number }> {
  const pool = getAccommodationDbPool();
  const city = opts.city ?? "Yogyakarta";
  const country = opts.country ?? DEFAULT_MARKET;
  const params: unknown[] = [city, country];
  let categoryClause = "";
  if (opts.category) {
    params.push(opts.category);
    categoryClause = ` AND category = $${params.length}`;
  }
  const q = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE ${VISIBILITY_FILTER})::int AS visible,
       COUNT(*) FILTER (WHERE claim_status = 'discovered')::int AS discovered,
       COUNT(*)::int AS total
     FROM nex.accommodation_business
     WHERE city = $1 AND country = $2 ${categoryClause}`,
    params,
  );
  const r = q.rows[0];
  return { visible: Number(r.visible), discovered: Number(r.discovered), total: Number(r.total) };
}
