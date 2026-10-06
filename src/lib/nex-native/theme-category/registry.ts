// src/lib/nex-native/theme-category/registry.ts
//
// Theme Category Registry · sealed 2026-10-06 (Step 1A).
//
// The single source of truth for which Theme Categories NEX recognises
// and what each one's display metadata is. Lives in core (not app) so
// Theme Brain, the Library and future consumers can read it without
// crossing the sealed dependency direction.
//
// Rules sealed with the founder 2026-10-06:
//
//   · ids are stable + lowercase + hyphenated · never emoji / display
//     strings.
//   · "explore" is NOT a visual family · it is the universal bucket
//     for Worlds that do not yet have a dedicated category. Treating
//     it as a real family would be a doctrine violation.
//   · A real category is only added when a genuine family of Worlds
//     warrants it. Do not invent categories to fill slots.
//   · DB-backed themes default to "explore" in Step 1A · later phases
//     may migrate specific DB themes into real categories, but that
//     is a separate authorisation.
//   · When a package references a categoryId that is NOT in this
//     registry, the Library adapter defaults it to "explore" so the
//     Library never crashes · a focused test guards that EVERY code-
//     registered Theme Package declares a REGISTERED categoryId (or
//     none at all), so typos cannot land silently.

import type { ThemeCategory } from "./types";

/** The universal uncategorised bucket. Worlds here are NOT a visual
 *  family · they are temporarily collected pending real category
 *  assignment. */
export const EXPLORE_CATEGORY_ID = "explore" as const;

/** All currently-registered Theme Categories. Add a row to this map
 *  to introduce a new category · zero code change elsewhere needed. */
const CATEGORY_REGISTRY: Readonly<Record<string, ThemeCategory>> = {
  ocean: {
    id: "ocean",
    name: "Ocean",
    tagline: "Underwater worlds + voyages",
    icon: "🌊",
  },
  cafe: {
    id: "cafe",
    name: "Café",
    tagline: "Coffee · warmth · pastry",
    icon: "☕",
  },
  [EXPLORE_CATEGORY_ID]: {
    id: EXPLORE_CATEGORY_ID,
    name: "Explore",
    tagline: "Worlds not yet grouped into a dedicated category",
    icon: "✨",
  },
};

/** Look up a registered category by id. Returns `null` for unknown
 *  ids rather than throwing · callers that need loud failure should
 *  pair this with `isRegisteredCategory` and raise their own error. */
export function getCategory(id: string): ThemeCategory | null {
  return CATEGORY_REGISTRY[id] ?? null;
}

/** List every registered category. The returned array is a snapshot;
 *  mutating it does not affect the registry. Order follows the
 *  registration order in the CATEGORY_REGISTRY object. */
export function listCategories(): readonly ThemeCategory[] {
  return Object.values(CATEGORY_REGISTRY);
}

/** True when `id` is a registered category id. Used by tests to guard
 *  against ThemePackages referencing nonexistent categories. */
export function isRegisteredCategory(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(CATEGORY_REGISTRY, id);
}

/** Deterministic resolution for a Theme World's category assignment.
 *
 *  · null · undefined · empty string → `EXPLORE_CATEGORY_ID`
 *  · registered id → that same id
 *  · unknown id → `EXPLORE_CATEGORY_ID` (safe default; the architecture
 *    guard that validates every code-registered package catches typos
 *    at CI time)
 *
 *  Never throws · never undefined · the Library adapter is safe to
 *  call this on every row.
 */
export function resolveCategoryId(
  categoryId: string | null | undefined,
): string {
  if (!categoryId) return EXPLORE_CATEGORY_ID;
  return isRegisteredCategory(categoryId) ? categoryId : EXPLORE_CATEGORY_ID;
}
