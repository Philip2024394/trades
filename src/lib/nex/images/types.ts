// Universal Directory Image types · Phase 1 · 2026-08-22.
//
// Doctrine anchors:
//   project_nex_universal_directory_image_doctrine_2026_08_22
//   project_nex_country_scope_from_phone_country_code_2026_08_22 (country baked in · Q6 RESOLVED)

/** The three (and only three) image states per Universal Image Doctrine. */
export type ImageType = "OWNER_IMAGE" | "VERIFIED_REAL" | "CATEGORY_FALLBACK";

/** Row shape from nex.business_image (migration 080). */
export interface BusinessImageRow {
  id: string;
  business_type: string;
  business_country: string;   // ISO 3166-1 alpha-2
  business_ref: string;
  image_type: ImageType;
  url: string;
  source: string;
  provenance: Record<string, unknown> | null;
  confidence: number | null;
  cycle_run_id: string | null;
  fallback_category: string | null;
  owner_approved: boolean;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

/** Return shape of the universal directory hero resolver.
 *  Contract: NEVER null. NEVER broken. Always resolves to a renderable state. */
export interface ResolvedDirectoryHero {
  url: string;
  imageType: ImageType;
  source: string;
  fallbackCategory?: string;
  provenance?: Record<string, unknown>;
  confidence?: number;
  cycleRunId?: string;
}
