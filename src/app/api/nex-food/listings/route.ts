// NEX Food Directory · listings API · Phase 4.
//
// Returns nex.food_business rows in the FoodListing shape the UI consumes.
// Filters to claim_status IN ('listed','invited','claimed','paying') · rows
// still in discovered/verifying never surface publicly.
//
// GET /api/nex-food/listings?city=Yogyakarta&category=restaurant
//   Query params (all optional):
//     city      · defaults to 'Yogyakarta' · first-class dimension
//     category  · restrict to one V1 category
//
// Response:
//   { listings: FoodListing[], attribution: string, count: number }
//
// Notes:
//   - No auth · public read endpoint (business info is publicly discoverable)
//   - Response includes ODbL attribution string that the UI must surface
//     for any OSM-sourced data (per pinned Business Acquisition Pipeline
//     doctrine + OSM ODbL terms).

import { NextResponse } from "next/server";
import { getFoodDbPool } from "@/lib/nex-food/db";
import { dbRowsToFoodListings, OSM_ATTRIBUTION_TEXT } from "@/lib/nex-food/directory-adapter";
import type { NexFoodBusiness } from "@/lib/nex-food/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_CATEGORIES = new Set(["restaurant", "coffee-cafe", "ice-cream-dessert", "fast-food"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") ?? "Yogyakarta";
  const category = searchParams.get("category");

  if (category && !VALID_CATEGORIES.has(category)) {
    return NextResponse.json(
      { error: `Invalid category '${category}'. Must be one of: ${[...VALID_CATEGORIES].join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const pool = getFoodDbPool();
    const params: (string | null)[] = [city];
    let sql = `
      SELECT
        internal_id, public_listing_ref, business_name, category,
        address, city, district,
        coordinates_lng, coordinates_lat,
        phone, whatsapp_number, website,
        public_social_links, opening_information,
        source, source_reference, source_ingested_at, source_checked_at, source_licence_terms,
        dedupe_hash, claim_status, owner_status,
        hero_image_url, hero_image_source, hero_image_approved, hero_image_provenance,
        rating, rating_source, review_count, review_count_source,
        created_at, updated_at, created_by
      FROM nex.food_business
      WHERE city = $1
        AND claim_status IN ('listed', 'invited', 'claimed', 'paying')
    `;
    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }
    sql += ` ORDER BY business_name`;

    const result = await pool.query(sql, params);
    const rows: NexFoodBusiness[] = result.rows.map((r) => ({
      internalId: r.internal_id,
      publicListingRef: r.public_listing_ref,
      businessName: r.business_name,
      category: r.category,
      address: r.address,
      city: r.city,
      district: r.district,
      coordinatesLng: r.coordinates_lng != null ? Number(r.coordinates_lng) : null,
      coordinatesLat: r.coordinates_lat != null ? Number(r.coordinates_lat) : null,
      phone: r.phone,
      whatsappNumber: r.whatsapp_number,
      website: r.website,
      publicSocialLinks: r.public_social_links,
      openingInformation: r.opening_information,
      source: r.source,
      sourceReference: r.source_reference,
      sourceIngestedAt: r.source_ingested_at ? new Date(r.source_ingested_at).toISOString() : "",
      sourceCheckedAt: r.source_checked_at ? new Date(r.source_checked_at).toISOString() : null,
      sourceLicenceTerms: r.source_licence_terms,
      dedupeHash: r.dedupe_hash,
      claimStatus: r.claim_status,
      ownerStatus: r.owner_status,
      heroImageUrl: r.hero_image_url,
      heroImageSource: r.hero_image_source,
      heroImageApproved: r.hero_image_approved,
      heroImageProvenance: r.hero_image_provenance,
      rating: r.rating != null ? Number(r.rating) : null,
      ratingSource: r.rating_source,
      reviewCount: r.review_count,
      reviewCountSource: r.review_count_source,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : "",
      createdBy: r.created_by,
    }));

    const listings = dbRowsToFoodListings(rows);

    // Any OSM-sourced row triggers ODbL attribution surface.
    const hasOsmSource = rows.some((r) => r.source.startsWith("openstreetmap"));
    const attribution = hasOsmSource ? OSM_ATTRIBUTION_TEXT : "";

    return NextResponse.json({ listings, attribution, count: listings.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `food listings query failed: ${message}` }, { status: 500 });
  }
}
