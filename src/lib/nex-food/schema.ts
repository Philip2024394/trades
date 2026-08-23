// NEX Food · Business record TypeScript types matching nex.food_business.
//
// Mirrors deploy/postgres/init/054_nex_food_business_schema.sql exactly.
// Any change here needs a matching migration bump. Any change to the SQL
// needs to update these types in the same commit.
//
// Doctrine: project_nex_food_discovery_yogyakarta_v1_2026_08_21 · Phase 1.

/** V1 food categories · locked (Philip 2026-08-21). */
export type NexFoodCategory =
  | "restaurant"
  | "coffee-cafe"
  | "ice-cream-dessert"
  | "fast-food";

/**
 * Listing-side status · what NEX sees about the listing.
 * Progresses: discovered → verifying → listed → invited → claimed → paying
 * Separate concern from `NexFoodOwnerStatus`.
 */
export type NexFoodClaimStatus =
  | "discovered"
  | "verifying"
  | "listed"
  | "invited"
  | "claimed"
  | "paying";

/**
 * Owner-side status · what NEX knows about the owner directly.
 * Progresses: unknown → contacted → responded → verified
 * Separate concern from `NexFoodClaimStatus`.
 */
export type NexFoodOwnerStatus =
  | "unknown"
  | "contacted"
  | "responded"
  | "verified";

/** Hero image source · matches the value stored in hero_image_source. */
export type NexFoodHeroImageSource =
  | "nex_curated_v1"
  | "owner_uploaded"
  | "owner_authorised";

/** Provenance metadata for the hero image · stored as jsonb in the DB. */
export type NexFoodHeroImageProvenance = {
  approvedByNote?: string;
  approvedAt?: string;   // ISO
  notes?: string;
};

/** Public social links · stored as jsonb. Extend when new platforms surface. */
export type NexFoodPublicSocialLinks = {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
};

/** Opening information · stored as jsonb. Times in HH:MM 24-hour local. */
export type NexFoodOpeningInformation = {
  mon?: NexFoodOpeningWindow[];
  tue?: NexFoodOpeningWindow[];
  wed?: NexFoodOpeningWindow[];
  thu?: NexFoodOpeningWindow[];
  fri?: NexFoodOpeningWindow[];
  sat?: NexFoodOpeningWindow[];
  sun?: NexFoodOpeningWindow[];
  timezone?: string;   // e.g. 'Asia/Jakarta'
  notes?: string;      // free-form (e.g. 'closed on public holidays')
};

export type NexFoodOpeningWindow = {
  open: string;    // 'HH:MM'
  close: string;   // 'HH:MM'
};

/**
 * Full Business record shape · one row = one business.
 * Matches every column in nex.food_business (snake_case DB → camelCase TS).
 */
export type NexFoodBusiness = {
  // Identity
  internalId: string;                 // uuid · private
  publicListingRef: string;           // #FL-YYYY-XXXXX

  // Business
  businessName: string;
  category: NexFoodCategory;
  // Task #85 (2026-08-22) · secondary category tokens (bakery · japanese · warung
  // · takeaway · etc.) sourced from richer OSM tags at ingest. OPTIONAL for
  // backward compatibility with callers that construct NexFoodBusiness without
  // the field — DB defaults to '{}' via migration 075, so absent = empty array.
  categories?: string[];
  address: string | null;
  city: string;                       // default 'Yogyakarta'
  district: string | null;
  coordinatesLng: number | null;
  coordinatesLat: number | null;
  phone: string | null;
  whatsappNumber: string | null;      // outreach only · not identity
  website: string | null;
  publicSocialLinks: NexFoodPublicSocialLinks | null;
  openingInformation: NexFoodOpeningInformation | null;

  // Provenance
  source: string;                     // e.g. 'yogyakarta_open_data_2024'
  sourceReference: string | null;
  sourceIngestedAt: string;           // ISO
  sourceCheckedAt: string | null;     // ISO
  sourceLicenceTerms: string | null;

  // Dedupe
  dedupeHash: string;

  // Status (two separate fields)
  claimStatus: NexFoodClaimStatus;
  ownerStatus: NexFoodOwnerStatus;

  // Imagery (external URLs only · never blobs)
  heroImageUrl: string | null;
  heroImageSource: NexFoodHeroImageSource | null;
  heroImageApproved: boolean;
  heroImageProvenance: NexFoodHeroImageProvenance | null;

  // Metrics (source-attributed · never fabricated)
  rating: number | null;              // 0..5
  ratingSource: string | null;
  reviewCount: number | null;
  reviewCountSource: string | null;

  // Audit
  createdAt: string;                  // ISO
  updatedAt: string;                  // ISO
  createdBy: string | null;
};

// ── Helpers ──────────────────────────────────────────────────

/**
 * Format a numeric ID + year into the canonical #FL-YYYY-XXXXX shape.
 * Crockford Base32 · excludes I, L, O, U to reduce misread risk.
 */
export function formatPublicListingRef(year: number, id: number): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const digits: string[] = [];
  let n = id;
  for (let i = 0; i < 5; i++) {
    digits.unshift(alphabet[n & 31] ?? "0");
    n >>>= 5;
  }
  return `#FL-${year}-${digits.join("")}`;
}

/**
 * Compute the composite dedupe hash · Phase 3 wiring uses this.
 * Order matters — do not shuffle inputs across calls.
 */
export function computeDedupeHash(input: {
  businessName: string;
  address: string | null;
  phone: string | null;
  coordinatesLng: number | null;
  coordinatesLat: number | null;
}): string {
  const nameNorm = input.businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const addrNorm = (input.address ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const phoneLast6 = (input.phone ?? "").replace(/\D+/g, "").slice(-6);
  const lngR = input.coordinatesLng != null ? input.coordinatesLng.toFixed(3) : "";
  const latR = input.coordinatesLat != null ? input.coordinatesLat.toFixed(3) : "";
  return [nameNorm, addrNorm, phoneLast6, latR, lngR].join("|");
}
