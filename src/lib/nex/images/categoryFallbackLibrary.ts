// Universal Directory Image · Category Fallback Library · Phase 1 · 2026-08-22.
//
// PRODUCTION contract:
//   categoryFallbackFor(categoryId, country) → URL string when NEX has a
//   curated fallback for that (categoryId, country), else null.
//   Callers MUST fall back to UNIVERSAL_FALLBACK_URL when this returns null
//   (per Universal Image Doctrine acceptance Test #7: never null / never broken).
//
// Doctrine anchors:
//   project_nex_universal_directory_image_doctrine_2026_08_22 (constitutional)
//   project_nex_country_scope_from_phone_country_code_2026_08_22 (country foundational)
//
// Phase 1 seed:
//   Food-family entries reference existing Philip-curated NEX_VISUAL_ASSETS
//   (2026-08-21 curated set of 41 transparent-PNG assets). Under the doctrine
//   amendment (2026-08-22), these MAY be referenced as CATEGORY_FALLBACK only —
//   never as OWNER_IMAGE, never as VERIFIED_REAL, never as a specific-business
//   photograph. See src/lib/nexapp/nexVisualAssets.ts header amendment.
//
//   Non-food verticals (hotel · villa · guesthouse · kos · hostel · apartment ·
//   homestay · resort · car-rental · motorbike-rental · services · trades)
//   have NO entries yet. Philip 2026-08-22: "Do NOT solve the missing non-food
//   fallback artwork yet." Curation happens per-vertical BEFORE Phase 2
//   activation of that vertical. Until then, resolver falls through to
//   UNIVERSAL_FALLBACK_URL.

import { NEX_VISUAL_ASSETS } from "@/lib/nexapp/nexVisualAssets";

/** Look up an asset URL by NEX visual asset id · throws loudly if missing. */
function assetUrl(assetId: string): string {
  const asset = NEX_VISUAL_ASSETS.find((a) => a.id === assetId);
  if (!asset) {
    throw new Error(
      `categoryFallbackLibrary: NEX_VISUAL_ASSETS missing asset id "${assetId}" — ` +
      `update mapping or replace with a valid nva-* id`,
    );
  }
  return asset.imageUrl;
}

/**
 * Universal last-resort fallback URL. Used when no country-specific,
 * category-specific fallback exists (per Test #7: never null / never broken).
 *
 * PHASE 1 PLACEHOLDER: currently reuses nva-011 (healthy grain bowl) so tests
 * validate against a real renderable URL. MUST be replaced by Philip-curated
 * NEX-branded generic fallback before broad Phase 2 production activation.
 */
export const UNIVERSAL_FALLBACK_URL: string = assetUrl("nva-011");

/**
 * Country-scoped, category-specific fallback URLs.
 * Structure: FALLBACK_LIBRARY[country][categoryId] → URL string.
 * Only real Philip-curated entries live here. Missing = null → universal fallback.
 */
const FALLBACK_LIBRARY: Record<string, Readonly<Record<string, string>>> = {
  ID: {
    // Broad Food (Category Registry id="food")
    "food":              assetUrl("nva-011"),   // healthy grain bowl · broad food representative
    // Food primary CHECK values (nex.food_business.category)
    "restaurant":        assetUrl("nva-019"),   // grilled steak
    "coffee-cafe":       assetUrl("nva-002"),   // cappuccino + tea
    "ice-cream-dessert": assetUrl("nva-016"),   // ice cream sundae
    "fast-food":         assetUrl("nva-020"),   // classic cheeseburger
    // Non-food ID verticals — NO ENTRIES · curation deferred per Philip 2026-08-22
  },
  // Other countries — no entries yet · populated when verticals activate per-country
};

/**
 * Return a curated fallback URL for (categoryId, country), or null if none exists.
 * Caller MUST substitute UNIVERSAL_FALLBACK_URL when null is returned.
 */
export function categoryFallbackFor(categoryId: string, country: string): string | null {
  return FALLBACK_LIBRARY[country]?.[categoryId] ?? null;
}
