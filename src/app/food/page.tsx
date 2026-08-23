// /food · NEX Food Directory · Yogyakarta.
// Mirrors /nex-app/centre visual language exactly (Philip 2026-08-21):
//   · bg #faf7f2 off-white
//   · sticky header with title + filter row
//   · CSS-columns masonry (2 / 3 / 4 responsive)
//   · rounded-2xl white cards with hero image + orange View Details CTA
//   · sponsor + category interstitials interleaved
//   · bottom sheet on tap (reuses NexBottomSheet)
//
// SSR loads real Yogyakarta businesses from nex.food_business (only rows
// with claim_status IN ('listed','invited','claimed','paying') surface).

import { getFoodDbPool } from "@/lib/nex-food/db";
import { FoodCentreLiveFeed } from "./FoodCentreLiveFeed";
import type { NexFoodBusiness } from "@/lib/nex-food/schema";
import { dbRowsToFoodListings, OSM_ATTRIBUTION_TEXT } from "@/lib/nex-food/directory-adapter";
import DevInspector from "./DevInspector";
import { loadDevInspectorData } from "@/lib/nex-food/dev-inspector-data";
import { normalizeDirectoryCountry } from "@/lib/nex/directoryCountry";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX Food · Yogyakarta" };

// Country Foundation Step 5 (2026-08-22) · country is applied server-side to filter inventory to the caller's market.
async function loadListings(country: string) {
  const pool = getFoodDbPool();
  const q = await pool.query(`
    SELECT
      internal_id, public_listing_ref, business_name, category, categories,
      address, city, district, coordinates_lng, coordinates_lat,
      phone, whatsapp_number, website, public_social_links, opening_information,
      source, source_reference, source_ingested_at, source_checked_at, source_licence_terms,
      dedupe_hash, claim_status, owner_status,
      hero_image_url, hero_image_source, hero_image_approved, hero_image_provenance,
      rating, rating_source, review_count, review_count_source,
      created_at, updated_at, created_by
    FROM nex.food_business
    WHERE city = $1 AND country = $2
      AND claim_status IN ('listed','invited','claimed','paying')
    ORDER BY
      CASE claim_status
        WHEN 'paying'  THEN 1
        WHEN 'claimed' THEN 2
        WHEN 'invited' THEN 3
        ELSE 4
      END,
      business_name
  `, ['Yogyakarta', country]);
  const rows: NexFoodBusiness[] = q.rows.map((r) => ({
    internalId: r.internal_id, publicListingRef: r.public_listing_ref,
    businessName: r.business_name, category: r.category,
    categories: Array.isArray(r.categories) ? r.categories : [],   // Task #85 · secondary category tokens
    address: r.address, city: r.city, district: r.district,
    coordinatesLng: r.coordinates_lng != null ? Number(r.coordinates_lng) : null,
    coordinatesLat: r.coordinates_lat != null ? Number(r.coordinates_lat) : null,
    phone: r.phone, whatsappNumber: r.whatsapp_number, website: r.website,
    publicSocialLinks: r.public_social_links, openingInformation: r.opening_information,
    source: r.source, sourceReference: r.source_reference,
    sourceIngestedAt: r.source_ingested_at ? new Date(r.source_ingested_at).toISOString() : "",
    sourceCheckedAt: r.source_checked_at ? new Date(r.source_checked_at).toISOString() : null,
    sourceLicenceTerms: r.source_licence_terms, dedupeHash: r.dedupe_hash,
    claimStatus: r.claim_status, ownerStatus: r.owner_status,
    heroImageUrl: r.hero_image_url, heroImageSource: r.hero_image_source,
    heroImageApproved: r.hero_image_approved, heroImageProvenance: r.hero_image_provenance,
    rating: r.rating != null ? Number(r.rating) : null, ratingSource: r.rating_source,
    reviewCount: r.review_count, reviewCountSource: r.review_count_source,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : "",
    createdBy: r.created_by,
  }));
  const listings = dbRowsToFoodListings(rows);
  // Also expose the raw claim_status (for Promoted pill) + OSM cuisine
  // string (used by filter-intent sub-tokens · e.g. italian · japanese · pedas).
  const listingsWithClaim = listings.map((l) => {
    const raw = rows.find((r) => r.publicListingRef === l.publicListingRef);
    return {
      ...l,
      rawClaimStatus: raw?.claimStatus ?? ("listed" as const),
      cuisine: (raw?.openingInformation as { notes?: string })?.notes ?? null,   // not the real cuisine · placeholder
      categories: raw?.categories ?? [],   // Task #85 · secondary category tokens for filter matcher
    };
  });
  // Pull cuisine from a dedicated column · re-query the specific fields we need
  // Country Foundation Step 5 (2026-08-22) · country filter matches the main query.
  const cuisines = await pool.query(
    `SELECT public_listing_ref, source_reference,
            (SELECT string_agg(DISTINCT snap.raw_payload->>'cuisine', ' ')
             FROM nex.food_business_source_snapshot snap
             WHERE snap.business_ref = f.public_listing_ref) AS cuisine_agg
     FROM nex.food_business f
     WHERE f.city=$1 AND f.country=$2 AND f.claim_status IN ('listed','invited','claimed','paying')`,
    ['Yogyakarta', country]
  );
  const cuisineByRef = new Map<string, string>();
  cuisines.rows.forEach((r) => {
    if (r.cuisine_agg) cuisineByRef.set(r.public_listing_ref, r.cuisine_agg);
  });
  for (const l of listingsWithClaim) {
    const c = cuisineByRef.get(l.publicListingRef);
    if (c) (l as { cuisine: string | null }).cuisine = c;
  }
  const hasOsm = rows.some((r) => r.source.startsWith("openstreetmap"));
  return { listings: listingsWithClaim, attribution: hasOsm ? OSM_ATTRIBUTION_TEXT : "" };
}

// Task #87 dev inspector data extracted to src/lib/nex-food/dev-inspector-data.ts
// (Task #88 Phase 1 doctrine repair · dashboard-singularity DS3 · 2026-08-22).
// The /food page must not contain HQ_OPERATIONAL_MARKERS strings directly.

export default async function FoodDirectoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ admin?: string; country?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const showDevInspector = params.admin === "1";
  // Country Foundation Step 5 (2026-08-22) · `?country=XX` filters visible inventory.
  const country = normalizeDirectoryCountry(params.country);
  const [{ listings, attribution }, devData] = await Promise.all([
    loadListings(country),
    showDevInspector ? loadDevInspectorData() : Promise.resolve(null),
  ]);
  return (
    <>
      {devData && <DevInspector data={devData} />}
      <FoodCentreLiveFeed listings={listings} attribution={attribution} />
    </>
  );
}
