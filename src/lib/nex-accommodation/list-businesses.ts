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
  // Path A evidence recovered from OSM raw tags (2026-08-23). May contain
  // addr:street, addr:housenumber, opening_hours, brand, wikidata, etc.
  // Rendered as evidence context in the Details slider (honest · not fabricated).
  recoveredEvidence: Record<string, unknown> | null;
}

const VISIBILITY_FILTER = "claim_status IN ('listed','invited','claimed','paying')";

// Public-directory page ceiling. Set to 1500 so the current 881 Yogyakarta
// records ALL fit in one query · pagination beyond this is via `offset`.
// (Prior default was 500 · that was the invisible ceiling causing the
// HQ 881 vs public 500 discrepancy.)
export const DEFAULT_PUBLIC_LIMIT = 1500;

export async function loadAccommodationListings(opts: {
  category?: string;  // when defined · narrows to focused route (e.g. 'hotel')
  city?: string;      // defaults 'Yogyakarta'
  country?: string;   // Country Foundation Step 5 (2026-08-22) · ISO-2 · defaults DEFAULT_MARKET ('ID')
  limit?: number;     // safety cap · default DEFAULT_PUBLIC_LIMIT
  offset?: number;    // pagination · default 0
}): Promise<AccommodationListing[]> {
  const pool = getAccommodationDbPool();
  const city = opts.city ?? "Yogyakarta";
  const country = opts.country ?? DEFAULT_MARKET;
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_PUBLIC_LIMIT, 1), 2000);
  const offset = Math.max(opts.offset ?? 0, 0);

  const params: unknown[] = [city, country];
  let sql = `
    SELECT
      public_listing_ref, business_name, category, categories,
      city, district, address, coordinates_lat, coordinates_lng,
      phone, whatsapp_number, website, public_social_links,
      star_rating, room_count, amenities,
      hero_image_url, rating, review_count,
      claim_status, owner_status, recovered_evidence
    FROM nex.accommodation_business
    WHERE city = $1 AND country = $2 AND ${VISIBILITY_FILTER}
  `;
  if (opts.category) {
    params.push(opts.category);
    sql += ` AND category = $${params.length}`;
  }
  sql += ` ORDER BY business_name LIMIT ${limit} OFFSET ${offset}`;

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
    recoveredEvidence: r.recovered_evidence && typeof r.recovered_evidence === "object"
      ? (r.recovered_evidence as Record<string, unknown>)
      : null,
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

// PART A (2026-08-24) · Honest funnel breakdown for HQ display + operator
// diagnostics. Counts must come from DB · never hard-coded · exposes why the
// visible-total can differ from what the public directory actually renders.
//
// Funnel doctrine: Discovered ≠ Eligible ≠ Public ≠ Claimed ≠ Verified.
export interface AccommodationFunnelBreakdown {
  // Universe
  total:                number;
  // Stage counts (mutually exclusive across claim_status)
  discovered:           number;   // walker-found · not yet promoted
  eligibleListed:       number;   // claim_status='listed'
  invited:              number;   // owner invited to claim
  claimed:              number;   // owner claim received
  paying:               number;   // paying subscriber
  otherStatus:          number;   // any other status (safety catchall)
  // Verification (owner_status)
  ownerVerified:        number;   // owner_status IN ('verified','claimed')
  ownerUnknown:         number;   // owner_status='unknown' (majority for now)
  // Row quality within the eligible set (affects perceived directory quality)
  eligibleWithHeroImage:      number;
  eligibleWithAmenities:      number;
  eligibleWithContact:        number;   // phone OR whatsapp OR website
  eligibleWithCoords:         number;
  eligibleWithStarRating:     number;
  eligibleWithRecoveredEv:    number;   // Path A OSM raw-tag recovery
  // Public rendering cap (matches DEFAULT_PUBLIC_LIMIT unless overridden)
  publicRenderCap:      number;
  publicPagesAvailable: number;   // ceil(eligibleListed / cap)
}

export async function loadAccommodationFunnel(opts: {
  city?:    string;
  country?: string;
  category?: string;
  publicRenderCap?: number;
}): Promise<AccommodationFunnelBreakdown> {
  const pool = getAccommodationDbPool();
  const city = opts.city ?? "Yogyakarta";
  const country = opts.country ?? DEFAULT_MARKET;
  const publicRenderCap = opts.publicRenderCap ?? DEFAULT_PUBLIC_LIMIT;
  const params: unknown[] = [city, country];
  let categoryClause = "";
  if (opts.category) {
    params.push(opts.category);
    categoryClause = ` AND category = $${params.length}`;
  }

  const q = await pool.query(
    `SELECT
       COUNT(*)::int                                                                          AS total,
       COUNT(*) FILTER (WHERE claim_status = 'discovered')::int                               AS discovered,
       COUNT(*) FILTER (WHERE claim_status = 'listed')::int                                   AS eligible_listed,
       COUNT(*) FILTER (WHERE claim_status = 'invited')::int                                  AS invited,
       COUNT(*) FILTER (WHERE claim_status = 'claimed')::int                                  AS claimed,
       COUNT(*) FILTER (WHERE claim_status = 'paying')::int                                   AS paying,
       COUNT(*) FILTER (WHERE claim_status NOT IN ('discovered','listed','invited','claimed','paying'))::int AS other_status,
       COUNT(*) FILTER (WHERE owner_status IN ('verified','claimed'))::int                    AS owner_verified,
       COUNT(*) FILTER (WHERE owner_status = 'unknown' OR owner_status IS NULL)::int          AS owner_unknown,
       COUNT(*) FILTER (WHERE ${VISIBILITY_FILTER} AND hero_image_url IS NOT NULL)::int       AS eligible_with_hero,
       COUNT(*) FILTER (WHERE ${VISIBILITY_FILTER} AND array_length(amenities,1) > 0)::int    AS eligible_with_amenities,
       COUNT(*) FILTER (WHERE ${VISIBILITY_FILTER} AND (phone IS NOT NULL OR whatsapp_number IS NOT NULL OR website IS NOT NULL))::int AS eligible_with_contact,
       COUNT(*) FILTER (WHERE ${VISIBILITY_FILTER} AND coordinates_lat IS NOT NULL)::int      AS eligible_with_coords,
       COUNT(*) FILTER (WHERE ${VISIBILITY_FILTER} AND star_rating IS NOT NULL)::int          AS eligible_with_star,
       COUNT(*) FILTER (WHERE ${VISIBILITY_FILTER} AND recovered_evidence IS NOT NULL AND recovered_evidence::text <> '{}')::int AS eligible_with_recov_ev
     FROM nex.accommodation_business
     WHERE city = $1 AND country = $2 ${categoryClause}`,
    params,
  );
  const r = q.rows[0];
  const eligibleListed = Number(r.eligible_listed);
  return {
    total:                     Number(r.total),
    discovered:                Number(r.discovered),
    eligibleListed,
    invited:                   Number(r.invited),
    claimed:                   Number(r.claimed),
    paying:                    Number(r.paying),
    otherStatus:               Number(r.other_status),
    ownerVerified:             Number(r.owner_verified),
    ownerUnknown:              Number(r.owner_unknown),
    eligibleWithHeroImage:     Number(r.eligible_with_hero),
    eligibleWithAmenities:     Number(r.eligible_with_amenities),
    eligibleWithContact:       Number(r.eligible_with_contact),
    eligibleWithCoords:        Number(r.eligible_with_coords),
    eligibleWithStarRating:    Number(r.eligible_with_star),
    eligibleWithRecoveredEv:   Number(r.eligible_with_recov_ev),
    publicRenderCap,
    publicPagesAvailable:      publicRenderCap > 0 ? Math.max(1, Math.ceil(eligibleListed / publicRenderCap)) : 1,
  };
}

// Nearby-food query for the Details slider "What's nearby" section.
// Uses haversine on coordinates · only rows that pass the visibility filter.
// Never fabricated distances · every row is real evidence.
export interface NearbyFoodRow {
  publicListingRef: string;
  businessName:     string;
  category:         string | null;
  distanceKm:       number;
}

export async function loadNearbyFood(opts: {
  lat: number;
  lng: number;
  maxKm?: number;    // default 3
  limit?: number;    // default 6
}): Promise<NearbyFoodRow[]> {
  const pool = getAccommodationDbPool();
  const maxKm = opts.maxKm ?? 3;
  const limit = Math.min(Math.max(opts.limit ?? 6, 1), 20);

  const q = await pool.query(
    `SELECT public_listing_ref, business_name, category,
            (6371 * acos(
              GREATEST(-1, LEAST(1,
                cos(radians($1)) * cos(radians(coordinates_lat)) *
                cos(radians(coordinates_lng) - radians($2)) +
                sin(radians($1)) * sin(radians(coordinates_lat))
              ))
            )) AS distance_km
       FROM nex.food_business
      WHERE claim_status IN ('listed','invited','claimed','paying')
        AND coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL
      ORDER BY distance_km ASC
      LIMIT ${limit + 20}`,
    [opts.lat, opts.lng],
  );
  return q.rows
    .map((r): NearbyFoodRow => ({
      publicListingRef: String(r.public_listing_ref),
      businessName:     String(r.business_name),
      category:         r.category ? String(r.category) : null,
      distanceKm:       Number(r.distance_km),
    }))
    .filter((r) => Number.isFinite(r.distanceKm) && r.distanceKm <= maxKm)
    .slice(0, limit);
}
