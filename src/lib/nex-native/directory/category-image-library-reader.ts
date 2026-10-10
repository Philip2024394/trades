// src/lib/nex-native/directory/category-image-library-reader.ts
//
// NEX Directory · P0 · Server-only reader for `nex.category_image_library`.
//
// Split from `category-image-resolver.ts` so the pure resolver stays
// client-safe (it is imported by DirectoryCard + ListingDetailPanel,
// both of which run under the Pages-router dev bundler in some paths).
// Only this file carries the `server-only` guard and the pg import.

import "server-only";
import { withClient } from "@/lib/nex/db";
import type { CategoryImageLibraryRow } from "./category-image-resolver";

/** Fetch all active rows from `nex.category_image_library`. Called
 *  once per request from the Directory page / detail page and threaded
 *  into the card tree as a prop. Returns an empty array when
 *  `NEX_POSTGRES_URL` is unset or the DB is unreachable · the UI then
 *  renders the "no-image" fallback for every card (no fabrication). */
export async function getCategoryImageLibrary(): Promise<CategoryImageLibraryRow[]> {
  const sql =
    "SELECT id, category_slug, variant_tag, url, attribution, licence, " +
    "priority, active, created_at " +
    "FROM nex.category_image_library " +
    "WHERE active = TRUE " +
    "ORDER BY priority ASC, created_at ASC";
  try {
    const result = await withClient(async (client) => client.query(sql));
    if (result === null) return [];
    return (result.rows as unknown as CategoryImageLibraryRow[]).map((r) => ({
      id: String(r.id),
      category_slug: String(r.category_slug),
      variant_tag: r.variant_tag === null ? null : String(r.variant_tag),
      url: String(r.url),
      attribution: r.attribution === null ? null : String(r.attribution),
      licence: r.licence === null ? null : String(r.licence),
      priority: typeof r.priority === "number" ? r.priority : Number(r.priority),
      active: r.active === true,
      created_at:
        typeof r.created_at === "string"
          ? r.created_at
          : new Date(r.created_at as unknown as string).toISOString(),
    }));
  } catch {
    // The service's broader diagnostic surface already covers this path;
    // the resolver returns an empty library so cards render the honest
    // "no-image" fallback without crashing.
    return [];
  }
}
