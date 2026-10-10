// src/lib/nex-native/directory/category-image-resolver.ts
//
// NEX Directory · P0 · Category image resolver (pure · client-safe).
//
// What this module is
//   · The pure, deterministic resolver that selects a representative
//     category illustration for a canonical row that has no
//     OWNER_IMAGE / VERIFIED_REAL primary image.
//   · Shared types for the server-side library reader (see
//     `category-image-library-reader.ts` for the DB helper).
//
// What this module is NOT
//   · Not a fabricator. Images are curated in-house SVGs declared in
//     `nex.category_image_library`. The resolver NEVER synthesises a
//     URL · it only picks among what the library actually holds.
//   · Not a server-only module. This file is intentionally free of
//     `import "server-only"` so client components (DirectoryCard,
//     ListingDetailPanel) can call `resolveCategoryImage` directly on
//     snapshot rows that the server threaded into their props.
//   · Not a hero of specific business photos. Every resolved image is
//     flagged `isRepresentative: true` so the UI renders the honest
//     "Representative illustration" caption. ADR-0022 is sealed · the
//     Directory does not pretend a representative illustration is a
//     photograph of the specific business.
//
// Determinism
//   · Same (library snapshot + canonical id + entity type +
//     category ids) → same resolved variant, every time. The variant
//     hash uses a stable FNV-1a over the canonical id (never a clock,
//     never Math.random).
//
// Priority / tie-break
//   1. Rows whose `category_slug` matches an element of `categoryIds`
//      AND whose `variant_tag` also matches an element of categoryIds
//      (finest match).
//   2. Rows whose `category_slug` matches an element of `categoryIds`.
//   3. Rows whose `category_slug` equals the `entityType`.
//   4. Rows whose `category_slug` equals the `'*'` wildcard.
//   Within each bucket · sort by (priority ASC, created_at ASC) then
//   pick a variant deterministically by hashing the canonical id
//   modulo the candidate count.
//
// Static invariants
//   · No network, no clock, no randomness, no filesystem.
//   · No `import "server-only"` · safe to import from client bundles.

// ═════════════════════════════════════════════════════════════════════
// §1 · Types
// ═════════════════════════════════════════════════════════════════════

/** One row of `nex.category_image_library` (migration 112). Only the
 *  columns the resolver consumes are reflected here; the full table
 *  schema lives in `deploy/postgres/init/112_nex_category_image_library.sql`. */
export interface CategoryImageLibraryRow {
  readonly id: string;
  readonly category_slug: string;
  readonly variant_tag: string | null;
  readonly url: string;
  readonly attribution: string | null;
  readonly licence: string | null;
  readonly priority: number;
  readonly active: boolean;
  readonly created_at: string; // ISO-8601 · tie-break ordering
}

/** The result of a successful category-image resolve. The `isRepresentative`
 *  flag is a literal `true` so TypeScript guarantees the UI always sees
 *  the honest-caption signal · ADR-0022 compliance baked into the type. */
export interface CategoryImageResolved {
  readonly url: string;
  readonly attribution: string | null;
  readonly licence: string;
  readonly isRepresentative: true;
  readonly category_slug: string;
  readonly variant_tag: string | null;
}

export interface ResolveCategoryImageArgs {
  readonly libraryRows: readonly CategoryImageLibraryRow[];
  readonly entityType: string;
  readonly categoryIds: readonly string[];
  readonly canonicalBusinessId: string;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Pure resolver
// ═════════════════════════════════════════════════════════════════════

/**
 * Resolve a category image for a canonical row. Pure · deterministic.
 * Returns `null` iff no library row matches any of the fallback tiers.
 */
export function resolveCategoryImage(
  args: ResolveCategoryImageArgs,
): CategoryImageResolved | null {
  const { libraryRows, entityType, categoryIds, canonicalBusinessId } = args;

  // Only consider active rows · the DB default is `active = true` but
  // we never trust the caller to have pre-filtered.
  const active = libraryRows.filter((r) => r.active);
  if (active.length === 0) return null;

  const categoryIdSet = new Set(categoryIds);

  // Tier 1 · category_slug ∈ categoryIds AND variant_tag ∈ categoryIds.
  const tier1 = active.filter(
    (r) =>
      categoryIdSet.has(r.category_slug) &&
      r.variant_tag !== null &&
      categoryIdSet.has(r.variant_tag),
  );
  if (tier1.length > 0) {
    return pickDeterministic(tier1, canonicalBusinessId);
  }

  // Tier 2 · category_slug ∈ categoryIds.
  const tier2 = active.filter((r) => categoryIdSet.has(r.category_slug));
  if (tier2.length > 0) {
    return pickDeterministic(tier2, canonicalBusinessId);
  }

  // Tier 3 · category_slug === entityType.
  const tier3 = active.filter((r) => r.category_slug === entityType);
  if (tier3.length > 0) {
    return pickDeterministic(tier3, canonicalBusinessId);
  }

  // Tier 4 · wildcard.
  const tier4 = active.filter((r) => r.category_slug === "*");
  if (tier4.length > 0) {
    return pickDeterministic(tier4, canonicalBusinessId);
  }

  return null;
}

/** Sort candidates by (priority ASC, created_at ASC) then pick one
 *  deterministically. Within the lowest-priority tie group a stable
 *  FNV-1a hash of the canonical id selects the variant. */
function pickDeterministic(
  candidates: readonly CategoryImageLibraryRow[],
  canonicalBusinessId: string,
): CategoryImageResolved {
  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.created_at < b.created_at) return -1;
    if (a.created_at > b.created_at) return 1;
    // Final tie-break on id so sort is total · prevents engine-dependent
    // ordering drift.
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  // Within equal (priority, created_at) the first element wins the
  // sort tie-break by id · but founder requires DETERMINISTIC VARIANT
  // selection per canonical. Collect the equal-priority prefix and
  // hash into it.
  const bestPriority = sorted[0].priority;
  const bestGroup = sorted.filter((r) => r.priority === bestPriority);
  const idx = fnv1aUint32(canonicalBusinessId) % bestGroup.length;
  const chosen = bestGroup[idx];
  return {
    url: chosen.url,
    attribution: chosen.attribution,
    licence: chosen.licence ?? "unspecified",
    isRepresentative: true,
    category_slug: chosen.category_slug,
    variant_tag: chosen.variant_tag,
  };
}

/** Stable 32-bit FNV-1a over a UTF-16 string. Pure · deterministic ·
 *  no dependencies. */
function fnv1aUint32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // 32-bit multiply · emulate via Math.imul.
    h = Math.imul(h, 0x01000193);
  }
  // Force unsigned.
  return h >>> 0;
}
