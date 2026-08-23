// NEX Food · directory adapter · Phase 4.
//
// Transforms nex.food_business rows into the FoodListing shape the
// customer-facing Food Directory UI consumes.
//
// Rules:
//   - Only rows with claim_status IN ('listed','invited','claimed','paying')
//     surface publicly. Discovered/verifying rows stay hidden.
//   - claim_status mapping DB → UI:
//       listed  → unclaimed  (renders LOCAL BUSINESS badge)
//       invited → invited    (renders INVITED badge)
//       claimed → claimed    (renders NEX MEMBER badge)
//       paying  → claimed    (still renders NEX MEMBER · pricing tier is
//                             a separate concern from UI status)
//   - hero_image_url only surfaced if hero_image_approved = true. This
//     enforces the pinned Owner-Provenanced image doctrine at the query
//     boundary · UI cannot bypass.
//   - ODbL attribution for OSM-sourced records is preserved in provenance.

import type { FoodListing, FoodCategory, ClaimStatus } from "@/lib/nexapp/foodListings";
import type { NexFoodBusiness, NexFoodClaimStatus } from "./schema";

/** DB claim_status → UI claimStatus. Returns null for rows that should not surface. */
export function mapClaimStatus(dbStatus: NexFoodClaimStatus): ClaimStatus | null {
  switch (dbStatus) {
    case "discovered":
    case "verifying":
      return null;
    case "listed":
      return "unclaimed";
    case "invited":
      return "invited";
    case "claimed":
    case "paying":
      return "claimed";
  }
}

/** Transform a nex.food_business row into a FoodListing. Returns null if the row
 *  should not surface publicly (e.g. still in discovered/verifying). */
export function dbRowToFoodListing(row: NexFoodBusiness): FoodListing | null {
  const claimStatus = mapClaimStatus(row.claimStatus);
  if (claimStatus === null) return null;

  // Hero image gate · only approved images surface.
  const heroImageUrl = row.heroImageApproved && row.heroImageUrl
    ? row.heroImageUrl
    : PLACEHOLDER_HERO_BY_CATEGORY[row.category as FoodCategory];

  const heroImageSource = row.heroImageSource ?? "nex_curated_v1";

  const provenance = row.claimStatus === "claimed" || row.claimStatus === "paying"
    ? "owner_direct"
    : "nex_curated_v1";

  return {
    id: row.internalId,
    publicListingRef: row.publicListingRef,
    cityCode: "YOG",
    category: row.category as FoodCategory,
    name: row.businessName,
    district: row.district ?? "Yogyakarta",
    distanceKm: undefined,           // computed client-side later · null in DB
    heroImageUrl,
    heroImageApproved: row.heroImageApproved,
    heroImageSource,
    rating: row.rating ?? undefined,
    ratingSource: undefined,          // not surfaced in UI type · kept in DB
    reviewCount: row.reviewCount ?? undefined,
    openingStatus: "unknown",         // Phase 4b · parse opening_information
    description: undefined,           // owner-provenanced only · never invented
    phone: row.phone ?? undefined,
    claimStatus,
    provenance,
  };
}

/** Batch transform · filters out rows that should not surface. */
export function dbRowsToFoodListings(rows: readonly NexFoodBusiness[]): FoodListing[] {
  return rows
    .map(dbRowToFoodListing)
    .filter((l): l is FoodListing => l !== null);
}

/**
 * Fallback hero images per category · used when a listing has no approved
 * hero image yet. Category-representative only per pinned Lock 12.
 * Sourced from the existing NexVisualAsset library.
 */
const PLACEHOLDER_HERO_BY_CATEGORY: Record<FoodCategory, string> = {
  "coffee-cafe":       "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadaddsscxcccdddddsssda-removebg-preview.png?updatedAt=1777019597797",
  "ice-cream-dessert": "https://ik.imagekit.io/nepgaxllc/odfss-removebg-preview.png?updatedAt=1777007894759",
  "fast-food":         "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssddddfssdssssddffdddd-removebg-preview.png?updatedAt=1777007292974",
  "restaurant":        "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadaddss-removebg-preview.png?updatedAt=1777019098200",
};

/**
 * ODbL attribution string · must be surfaced anywhere OSM-sourced data
 * is displayed. Per OpenStreetMap ODbL terms + pinned Business Acquisition
 * Pipeline provenance rules.
 */
export const OSM_ATTRIBUTION_TEXT =
  "Business data © OpenStreetMap contributors · ODbL";
