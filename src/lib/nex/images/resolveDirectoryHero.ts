// Universal Directory Hero Image Resolver · Phase 1 · 2026-08-22.
//
// PURE FUNCTION. No DB access. Caller supplies pre-fetched image rows
// (typically via JOIN) + optional fallback lookup override (for tests).
//
// Contract (per Universal Image Doctrine acceptance tests 1–7):
//   · NEVER returns null.
//   · NEVER returns a broken/empty URL.
//   · Priority: OWNER_IMAGE (approved) > VERIFIED_REAL (approved) > CATEGORY_FALLBACK (library) > UNIVERSAL_FALLBACK.
//   · Rows unrelated to (businessType, businessCountry, businessRef) are safely filtered.
//   · Unapproved rows are ignored (owner_approved / approved gates).
//   · CATEGORY_FALLBACK output always carries fallbackCategory.
//   · VERIFIED_REAL output carries cycleRunId when present (Direct-Provenance A).
//
// Doctrine anchors:
//   project_nex_universal_directory_image_doctrine_2026_08_22
//   project_nex_country_scope_from_phone_country_code_2026_08_22

import type { BusinessImageRow, ResolvedDirectoryHero } from "./types";
import { UNIVERSAL_FALLBACK_URL, categoryFallbackFor } from "./categoryFallbackLibrary";

export interface ResolveDirectoryHeroInput {
  businessType: string;
  businessCountry: string;   // ISO 3166-1 alpha-2
  businessRef: string;
  categoryId: string;

  /** Pre-fetched image rows for the business.
   *  Over-broad sets are safely filtered by (type, country, ref). */
  images: readonly BusinessImageRow[];

  /** Override for category fallback lookup — tests inject fixtures.
   *  Defaults to the production library. */
  fallbackLookup?: (categoryId: string, country: string) => string | null;

  /** Override for the universal fallback URL — tests substitute for assertion.
   *  Defaults to the production universal fallback. */
  universalFallback?: string;
}

export function resolveDirectoryHero(input: ResolveDirectoryHeroInput): ResolvedDirectoryHero {
  const {
    businessType,
    businessCountry,
    businessRef,
    categoryId,
    images,
    fallbackLookup = categoryFallbackFor,
    universalFallback = UNIVERSAL_FALLBACK_URL,
  } = input;

  // Filter to rows for THIS specific business.
  const relevant = images.filter(
    (r) =>
      r.business_type === businessType &&
      r.business_country === businessCountry &&
      r.business_ref === businessRef,
  );

  // Priority 1: OWNER_IMAGE (approved)
  const owner = relevant.find((r) => r.image_type === "OWNER_IMAGE" && r.approved);
  if (owner) {
    return {
      url: owner.url,
      imageType: "OWNER_IMAGE",
      source: owner.source,
      provenance: owner.provenance ?? undefined,
      confidence: owner.confidence ?? undefined,
      cycleRunId: owner.cycle_run_id ?? undefined,
    };
  }

  // Priority 2: VERIFIED_REAL (approved)
  const verified = relevant.find((r) => r.image_type === "VERIFIED_REAL" && r.approved);
  if (verified) {
    return {
      url: verified.url,
      imageType: "VERIFIED_REAL",
      source: verified.source,
      provenance: verified.provenance ?? undefined,
      confidence: verified.confidence ?? undefined,
      cycleRunId: verified.cycle_run_id ?? undefined,
    };
  }

  // Priority 3: CATEGORY_FALLBACK from library
  const libraryUrl = fallbackLookup(categoryId, businessCountry);
  if (libraryUrl) {
    return {
      url: libraryUrl,
      imageType: "CATEGORY_FALLBACK",
      source: "nex.categoryLibrary",
      fallbackCategory: categoryId,
    };
  }

  // Priority 4 (Test #7): universal fallback · resolver never returns null
  return {
    url: universalFallback,
    imageType: "CATEGORY_FALLBACK",
    source: "nex.universalFallback",
    fallbackCategory: "universal",
  };
}
