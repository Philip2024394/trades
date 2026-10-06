// src/lib/nex-native/theme-category/types.ts
//
// Theme Category · type contract · sealed 2026-10-06 (Step 1A).
// Colour contract added 2026-10-06 (Step 2 · Universal Theme Colour
// Rule).
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
//   · UNIVERSAL THEME COLOUR RULE (sealed 2026-10-06): a category
//     declares its OWN ColourSystem · the category showcase surface
//     renders its atmosphere from this palette · it does NOT derive
//     from any individual world inside the category (so adding/
//     removing worlds never changes the category's identity). The
//     Library tile grid INSIDE the category continues to render each
//     world via its own ThemePackage colours · only the surrounding
//     wrapper (header · tagline · back-link · empty-state) uses the
//     category palette.

import type { ColourSystem } from "@/lib/nex-native/theme-package/types";

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
  /** Resolved visual palette for this category's showcase surface.
   *
   *  Sealed by the Universal Theme Colour Rule · every visual chrome
   *  surface (background · headers · back-link · empty-state · future
   *  showcase atmosphere) must derive from these colours. The grid
   *  tiles themselves continue to render each world via its OWN
   *  ThemePackage colours · the category palette is for the wrapper
   *  only.
   *
   *  Required field · `Required<ColourSystem>` means every slot
   *  (primary · secondary · highlight · glow · deep) must be declared
   *  by the category · the showcase page can then read any slot
   *  without needing a generic-NEX fallback. This closes the loophole
   *  where a `??` fallback would silently re-introduce the generic
   *  palette the rule forbids. */
  readonly colours: Required<ColourSystem>;
}
