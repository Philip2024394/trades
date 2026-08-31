// scripts/nex-category-library/_resolver.mjs
//
// NEX Category Image Library · resolver · Philip 2026-08-27 (E).
//
// Selects the best CATEGORY_FALLBACK image for a business that lacks a
// VERIFIED_REAL / OWNER_IMAGE. Pure function · exported as `pickFallback`.
//
// Selection algorithm (deterministic):
//   1. Filter library to rows where category_slug matches (candidate category
//      OR '*' whole-directory generic) AND active=true.
//   2. If preferredVariants[] provided, prefer rows whose variant_tag is in
//      the list (ordered by array position).
//   3. Among matches, pick lowest priority (ascending) · ties broken by
//      created_at DESC (freshest curated first).
//
// This function does NOT hit the database · takes the library rows array
// as input. Caller loads rows once per request/cycle and passes them in.

/**
 * Pick the best CATEGORY_FALLBACK image for a business.
 * @param {object} params
 * @param {string} params.categorySlug           e.g. 'gyms', 'salons', 'food'
 * @param {string[]} [params.preferredVariants]  ordered list of variant tags
 *                                                to prefer (e.g. ["mens-barber","hair-styling"]
 *                                                for a men's salon)
 * @param {Array<object>} params.libraryRows     library rows (fields:
 *                                                id, category_slug, variant_tag,
 *                                                url, priority, active, created_at)
 * @returns {object | null}  the chosen library row, or null if none match
 */
export function pickFallback({ categorySlug, preferredVariants = [], libraryRows }) {
  if (!Array.isArray(libraryRows) || libraryRows.length === 0) return null;

  const eligible = libraryRows.filter(
    (r) => r.active !== false && (r.category_slug === categorySlug || r.category_slug === "*"),
  );
  if (eligible.length === 0) return null;

  // Deterministic ordering: priority ASC, then created_at DESC (freshest first).
  const ordered = [...eligible].sort((a, b) => {
    const pa = a.priority ?? 100;
    const pb = b.priority ?? 100;
    if (pa !== pb) return pa - pb;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  // If preferredVariants supplied, look for the first match in order.
  for (const variant of preferredVariants) {
    const hit = ordered.find((r) => r.variant_tag === variant);
    if (hit) return hit;
  }

  // Otherwise: prefer any variant-tagged row over untagged, then untagged
  // as last resort within the same category. Category-specific always beats
  // '*' generic when both exist.
  const variantTagged = ordered.filter((r) => r.variant_tag != null && r.category_slug === categorySlug);
  if (variantTagged.length > 0) return variantTagged[0];
  const untaggedSpecific = ordered.filter((r) => r.variant_tag == null && r.category_slug === categorySlug);
  if (untaggedSpecific.length > 0) return untaggedSpecific[0];
  const generic = ordered.filter((r) => r.category_slug === "*");
  if (generic.length > 0) return generic[0];

  return null;
}

/**
 * Resolve the FINAL image for a business. Universal Image Doctrine order:
 *   OWNER_IMAGE > VERIFIED_REAL > CATEGORY_FALLBACK
 *
 * @param {object} params
 * @param {string | null} params.ownerImageUrl     row from business_image image_type='OWNER_IMAGE'
 * @param {string | null} params.verifiedRealUrl   e.g. service_business.hero_image_url
 * @param {string} params.categorySlug
 * @param {string[]} [params.preferredVariants]
 * @param {Array<object>} params.libraryRows
 * @returns { { url: string, source: 'owner' | 'verified' | 'fallback', libraryRow?: object } | null }
 */
export function resolveBestImage({
  ownerImageUrl, verifiedRealUrl,
  categorySlug, preferredVariants = [],
  libraryRows,
}) {
  if (ownerImageUrl)   return { url: ownerImageUrl,   source: "owner" };
  if (verifiedRealUrl) return { url: verifiedRealUrl, source: "verified" };
  const fallback = pickFallback({ categorySlug, preferredVariants, libraryRows });
  if (fallback) return { url: fallback.url, source: "fallback", libraryRow: fallback };
  return null;
}
