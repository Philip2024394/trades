// src/app/nex-native/chat-themes-library/_category-member-counts.ts
//
// Pure helper · counts how many Theme Worlds belong to each category
// in a merged `BrowserThemeRow[]` collection. Extracted from
// `_load-library-data.ts` so the vitest harness can import it without
// pulling in the `supabase-admin` module (which requires env vars at
// import time).
//
// No I/O · no React · no server-only dependencies. Safe to import
// from any surface.

import type { BrowserThemeRow } from "./_theme-browser-client";

/** Count how many worlds belong to each category in the merged
 *  collection. Returns a Record keyed by categoryId with the member
 *  count. Zero-member categories are absent from the returned map
 *  (callers can treat `?? 0` as "no worlds yet"). */
export function countCategoryMembers(
  browserThemes: readonly BrowserThemeRow[],
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const row of browserThemes) {
    counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
  }
  return counts;
}
