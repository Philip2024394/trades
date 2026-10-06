// src/lib/nex-native/theme-category/types.ts
//
// Theme Category · type contract · sealed 2026-10-06 (Step 1A).
// Colour contract added 2026-10-06 (Step 2 · Universal Theme Colour
// Rule).
// Hero World mapping added 2026-10-06 (Step 1B.1 · Phone-Frame Hero
// Tiles).
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
//   · PHONE-FRAME HERO (sealed 2026-10-06 · Step 1B.1): a category
//     declares which World represents it on the Theme Library landing
//     via `heroThemeId`. The landing tile for that category renders
//     a phone-frame showing that World painted through the Theme
//     Engine (ThemeWorld + ThemeBubble). Null means "fall back to the
//     first world in this category" at render time. The hero id is
//     advisory · if it does not resolve to a world currently in the
//     category, the fallback kicks in without crashing.

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
  /** Hero World · which Theme World represents this category on the
   *  Library landing phone-frame tile. The id references a
   *  `ThemePackage.identity.id` · the Library's merged theme collection
   *  resolves it to a `BrowserThemeRow` for the engine to paint.
   *
   *  · String · a specific world id · the preferred face of the
   *    category. Must point at a world whose own `categoryId` matches
   *    this category (code-level check in the registry test suite).
   *  · null · "no fixed hero" · the Library tile falls back to the
   *    first world currently in this category. Safer for a bucket like
   *    Explore where the membership can shift.
   *
   *  Hero resolution is a universal, data-driven step at tile render
   *  time · zero per-category JSX branches live inside the grid. */
  readonly heroThemeId: string | null;
}
