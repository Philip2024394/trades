// src/lib/nex-directory/category-fallback.ts
//
// NEX Directory · Category fallback resolver · Philip 2026-08-27 (STEP 2).
//
// Given a set of listings + a category slug, load the curated fallback library
// and compute the best-available image per listing:
//   OWNER_IMAGE (future)  > VERIFIED_REAL (listing.heroImageUrl) > CATEGORY_FALLBACK
//
// Selection algorithm mirrors scripts/nex-category-library/_resolver.mjs
// EXACTLY (locked by that module's 13 vitest cases). Duplicated here in TS
// rather than importing .mjs to keep type-check clean · both are ~20 lines
// of pure array filter/sort.
//
// Called from server components (accommodation page, food page, /services/*)
// once per request. Library table is small (curated · Philip fills manually)
// so a single SELECT * per request is fine.

import { getFoodDbPool } from "@/lib/nex-food/db";

export interface LibraryRow {
  id: string;
  category_slug: string;
  variant_tag: string | null;
  url: string;
  priority: number;
  active: boolean;
  created_at: string;
}

/** Load ALL active library rows relevant to a category. Includes category-
 *  specific rows AND '*' whole-directory fallbacks. Cheap query · small table. */
export async function loadLibraryForCategory(categorySlug: string): Promise<LibraryRow[]> {
  const pool = getFoodDbPool();
  const r = await pool.query<LibraryRow>(
    `SELECT id::text, category_slug, variant_tag, url, priority, active, created_at::text
       FROM nex.category_image_library
      WHERE active = true
        AND (category_slug = $1 OR category_slug = '*')
      ORDER BY priority ASC, created_at DESC`,
    [categorySlug],
  );
  return r.rows;
}

/** Pure resolver · MUST match scripts/nex-category-library/_resolver.mjs::pickFallback. */
export function pickFallback(params: {
  categorySlug: string;
  preferredVariants?: string[];
  libraryRows: LibraryRow[];
}): LibraryRow | null {
  const { categorySlug, preferredVariants = [], libraryRows } = params;
  if (libraryRows.length === 0) return null;

  const eligible = libraryRows.filter(
    (r) => r.active !== false && (r.category_slug === categorySlug || r.category_slug === "*"),
  );
  if (eligible.length === 0) return null;

  const ordered = [...eligible].sort((a, b) => {
    const pa = a.priority ?? 100;
    const pb = b.priority ?? 100;
    if (pa !== pb) return pa - pb;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  for (const variant of preferredVariants) {
    const hit = ordered.find((r) => r.variant_tag === variant);
    if (hit) return hit;
  }
  const variantTagged   = ordered.filter((r) => r.variant_tag != null && r.category_slug === categorySlug);
  if (variantTagged.length > 0)   return variantTagged[0];
  const untaggedSpecific = ordered.filter((r) => r.variant_tag == null && r.category_slug === categorySlug);
  if (untaggedSpecific.length > 0) return untaggedSpecific[0];
  const generic = ordered.filter((r) => r.category_slug === "*");
  if (generic.length > 0) return generic[0];
  return null;
}

/**
 * Resolve fallback image URL for ONE listing (no owner/verified assumption).
 * The caller should pass this ONLY for listings whose heroImageUrl is null.
 */
export function resolveFallbackUrl(params: {
  categorySlug: string;
  preferredVariants?: string[];
  libraryRows: LibraryRow[];
}): string | null {
  const row = pickFallback(params);
  return row?.url ?? null;
}
