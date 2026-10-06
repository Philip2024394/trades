// src/lib/nex-native/theme-category/types.ts
//
// Theme Category · type contract · sealed 2026-10-06 (Step 1A).
//
// A Theme Category is a visual family / showcase room. A Theme World
// (ThemePackage) declares which category it belongs to via
// `identity.categoryId` · the category registry at `./registry.ts`
// decides what that id MEANS as a presentation surface.
//
// Load-bearing architectural rules:
//
//   · The category registry is CODE-SIDE · no DB column · no migration.
//   · ids are stable internal identifiers · "ocean" · "cafe" · never
//     emoji / display strings.
//   · Display metadata (name · tagline · icon) belongs here, in the
//     registry · NOT duplicated into every ThemePackage.
//   · A World belongs to exactly one category. If it declares nothing,
//     the Library adapter defaults it to the "explore" collection.

/** A Theme Category · visual family / showcase room. */
export interface ThemeCategory {
  /** Stable internal id · never changes. e.g. "ocean" · "cafe" ·
   *  "explore". Lowercase + hyphenated. Used as the registry key. */
  readonly id: string;
  /** Display name shown in Library UI. e.g. "Ocean" · "Café". May be
   *  reworded later without breaking anything · the id is the key. */
  readonly name: string;
  /** One-line descriptor shown in the category tile. Null when the
   *  category has no tagline yet. */
  readonly tagline: string | null;
  /** Optional emoji shown on the category tile. NEVER an identifier.
   *  Null when the category has no icon yet. */
  readonly icon: string | null;
}
