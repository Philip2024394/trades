// src/app/api/nex-directory/listings/route.ts
//
// Country Foundation Step 7 Part B · Phase 7B.3 · 2026-08-23.
//
// Category-scoped listings API for the CategoryConstellation focused view.
// Returns visible NEX business listings for (category, country, city) so the
// constellation can render real businesses as inline cards inside the NEX
// conversation — never a navigation to an old directory page.
//
// Truth Invariant:
//   · Rejects unknown categories (honest 404)
//   · Returns empty `listings: []` + explicit `reason` when the category has
//     no inventory in the requested country (never invents cross-country results)
//   · Never fabricates rows · always sourced from real DB
//
// Doctrine anchors:
//   project_nex_category_wheel_experience_doctrine_2026_08_22 (Phase 7B.3)
//   project_nex_country_foundation_phased_plan_2026_08_22 (Step 7 · country in every scope)
//   project_nex_truth_invariant_2026_08_22
//   project_nex_walker_stays_pure_acquisition_2026_08_22 (visibility filter preserved)

import { NextResponse } from "next/server";
import { normalizeDirectoryCountry } from "@/lib/nex/directoryCountry";
import { getCategory } from "@/lib/nex/category-registry";
import {
  loadAccommodationListings,
  type AccommodationListing,
} from "@/lib/nex-accommodation/list-businesses";
import { getFoodDbPool } from "@/lib/nex-food/db";

export const dynamic = "force-dynamic";

/** Max listings returned per query · keeps the constellation card list conversational, not a full directory. */
const MAX_LISTINGS = 12;

/** Unified listing shape returned to the client · independent of underlying vertical table. */
export interface DirectoryListing {
  publicListingRef: string;
  businessName: string;
  category: string;
  city: string;
  district: string | null;
  address: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  website: string | null;
  heroImageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
}

export interface DirectoryListingsResponse {
  ok: true;
  category: string;
  country: string;
  city: string;
  listings: DirectoryListing[];
  total: number;
  /** Explicit reason when listings is empty · lets the caller respond honestly. */
  reason?:
    | "no_inventory_in_country"     // category is not active for this country
    | "category_inactive"           // category exists but inactive in Registry
    | "no_visible_listings"         // active + country match but zero visible rows
    | "unsupported_vertical";       // vertical adapter not yet implemented
}

export interface DirectoryListingsError {
  ok: false;
  error: string;
}

// ═══════════════════════════════════════════════════════════════════════
// GET /api/nex-directory/listings?category=X&country=Y&city=Z
// ═══════════════════════════════════════════════════════════════════════

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const country = normalizeDirectoryCountry(url.searchParams.get("country"));
  const city = url.searchParams.get("city") ?? "Yogyakarta";

  if (!category) {
    return NextResponse.json<DirectoryListingsError>(
      { ok: false, error: "category query parameter is required" },
      { status: 400 },
    );
  }

  const cat = getCategory(category);
  if (!cat) {
    return NextResponse.json<DirectoryListingsError>(
      { ok: false, error: `unknown category: ${category}` },
      { status: 404 },
    );
  }

  // Registry inactive-category gate · Truth Invariant · Villa etc. are known but not shipped
  if (!cat.active) {
    return NextResponse.json<DirectoryListingsResponse>({
      ok: true,
      category,
      country,
      city,
      listings: [],
      total: 0,
      reason: "category_inactive",
    });
  }

  // Registry country-scope gate · Truth Invariant · GB user requesting hotel returns empty
  if (!cat.countries.includes(country)) {
    return NextResponse.json<DirectoryListingsResponse>({
      ok: true,
      category,
      country,
      city,
      listings: [],
      total: 0,
      reason: "no_inventory_in_country",
    });
  }

  // Route to the right vertical adapter
  if (cat.parentVertical === "food") {
    return await getFoodListings(category, country, city);
  }
  if (cat.parentVertical === "accommodation") {
    return await getAccommodationListings(category, country, city);
  }
  // rentals + future verticals · adapter not yet implemented
  return NextResponse.json<DirectoryListingsResponse>({
    ok: true,
    category,
    country,
    city,
    listings: [],
    total: 0,
    reason: "unsupported_vertical",
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Food adapter · direct pool query (mirrors /food/page.tsx visibility filter)
// ═══════════════════════════════════════════════════════════════════════

async function getFoodListings(category: string, country: string, city: string): Promise<Response> {
  const pool = getFoodDbPool();
  const q = await pool.query(
    `SELECT public_listing_ref, business_name, category, city, district, address,
            phone, whatsapp_number, website, hero_image_url, rating, review_count
       FROM nex.food_business
      WHERE city = $1 AND country = $2
        AND claim_status IN ('listed','invited','claimed','paying')
      ORDER BY CASE claim_status
                 WHEN 'paying'  THEN 1
                 WHEN 'claimed' THEN 2
                 WHEN 'invited' THEN 3
                 ELSE 4
               END,
               business_name
      LIMIT $3`,
    [city, country, MAX_LISTINGS],
  );

  const listings: DirectoryListing[] = q.rows.map((r) => ({
    publicListingRef: r.public_listing_ref,
    businessName:     r.business_name,
    category:         r.category ?? category,
    city:             r.city ?? city,
    district:         r.district ?? null,
    address:          r.address ?? null,
    phone:            r.phone ?? null,
    whatsappNumber:   r.whatsapp_number ?? null,
    website:          r.website ?? null,
    heroImageUrl:     r.hero_image_url ?? null,
    rating:           r.rating != null ? Number(r.rating) : null,
    reviewCount:      r.review_count ?? null,
  }));

  return NextResponse.json<DirectoryListingsResponse>({
    ok: true,
    category,
    country,
    city,
    listings,
    total: listings.length,
    reason: listings.length === 0 ? "no_visible_listings" : undefined,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Accommodation adapter · reuses existing loadAccommodationListings (Step 5)
// ═══════════════════════════════════════════════════════════════════════

async function getAccommodationListings(category: string, country: string, city: string): Promise<Response> {
  // Broad "accommodation" category = no category filter (matches /accommodation page)
  const catFilter = category === "accommodation" ? undefined : category;
  const rows = await loadAccommodationListings({
    category: catFilter,
    city,
    country,
    limit: MAX_LISTINGS,
  });

  const listings: DirectoryListing[] = rows.map((l: AccommodationListing) => ({
    publicListingRef: l.publicListingRef,
    businessName:     l.businessName,
    category:         l.category,
    city:             l.city,
    district:         l.district,
    address:          l.address,
    phone:            l.phone,
    whatsappNumber:   l.whatsappNumber,
    website:          l.website,
    heroImageUrl:     l.heroImageUrl,
    rating:           l.rating,
    reviewCount:      l.reviewCount,
  }));

  return NextResponse.json<DirectoryListingsResponse>({
    ok: true,
    category,
    country,
    city,
    listings,
    total: listings.length,
    reason: listings.length === 0 ? "no_visible_listings" : undefined,
  });
}
