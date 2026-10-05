// src/lib/nex-native/chat-render/atmosphere-registry.ts
//
// Theme Atmosphere Registry · Stage 1 of the universal-chrome
// convergence · sealed 2026-10-05.
//
// Replaces the two theme-id if-branches that previously lived in the
// production peer-chat page:
//
//   {peerThemeRow?.id === "theme-0"      && <JokerChatOverlays />}
//   {peerThemeRow?.id === "haunted-hotel" && <HauntedHotelChrome />}
//
// with a single declarative lookup. The registry is the one place
// where "this theme has an atmosphere" is encoded; everywhere else
// (production chat routes, future preview routes, chrome registry)
// consumes it through a single function.
//
// Load-bearing architectural rules (Stage 1):
//
//   · This registry is CODE-SIDE, not DB-backed · the DB schema does
//     NOT carry an atmosphere-component column and Stage 1 does not
//     add one. When Theme Brain Phase 1 seals + a Stage 3 atmosphere
//     field lands on ThemePackage, this registry becomes empty.
//   · Entries are DECLARATIVE DATA, not control flow · adding a new
//     atmospheric theme is one line here, not a new branch in the
//     chat shell.
//   · The shell / page NEVER checks a theme id. It calls
//     `getAtmosphereForTheme(themeId)` and renders whatever comes
//     back (or nothing when the theme has no atmosphere).
//   · "Atmosphere" means visual-only layers: continuous overlays,
//     entry theatre, FX controllers that control the ambient
//     presentation of a specific theme. It does NOT mean functional
//     NEX capabilities. Trust Scan, calls, video, mic, status · all
//     of these are universal shell features, not atmosphere.
//
// Anti-patterns this closes:
//
//   · if (themeId === "theme-0") { ... } anywhere outside this file
//   · atmosphere components mounting functional NEX actions (every
//     Trust Scan trigger moved out of JokerController / JokerChatOverlays
//     into UniversalChatControls as part of Stage 1)
//   · multiple-registries drift · this is the single source of truth
//     for the theme → atmosphere mapping

import type { ComponentType } from "react";
import { JokerAtmosphereBundle } from "@/app/nex-native/themes/[id]/_joker-chat-overlays";
import { HauntedHotelChrome } from "@/components/nex-native/HauntedHotelChrome";

/** The shape every atmosphere component accepts. Kept intentionally
 *  minimal · atmosphere layers render visual-only effects. If a future
 *  atmosphere needs more context, we add it here (and every entry
 *  adopts it uniformly) rather than letting one entry drift into a
 *  wider contract. Components may ignore props they do not use. */
export interface ThemeAtmosphereProps {
  /** Opaque identifier for the "subject" of the atmosphere · usually
   *  the peer account id for peer chat so entry-theatre effects can
   *  re-fire when the user navigates between different peers. Null
   *  when the surface does not have a stable subject (e.g. business
   *  chat does not currently thread an identity-scoped subject). */
  readonly subjectId: string | null;
}

export type ThemeAtmosphereComponent = ComponentType<ThemeAtmosphereProps>;

/** Internal registry · the single source of truth for theme → ambient.
 *  Imported statically so the module graph is predictable; the two
 *  bundles here are small enough that lazy loading is not justified
 *  at Stage 1 scale. */
const REGISTRY: Record<string, ThemeAtmosphereComponent> = {
  "theme-0": JokerAtmosphereBundle,
  // HauntedHotelChrome currently takes no props · the cast lets it
  // participate in the uniform ThemeAtmosphereComponent contract. The
  // component ignores subjectId, which is safe. If a future atmosphere
  // needs subjectId, HauntedHotelChrome accepts-and-ignores it just the
  // same.
  "haunted-hotel": HauntedHotelChrome as unknown as ThemeAtmosphereComponent,
};

/** Lookup · returns the atmosphere component bound to a theme, or
 *  null when the theme has no registered atmosphere. The shell / page
 *  is expected to render the result (or nothing) · it MUST NEVER
 *  branch on themeId directly. */
export function getAtmosphereForTheme(
  themeId: string | null | undefined,
): ThemeAtmosphereComponent | null {
  if (!themeId) return null;
  return REGISTRY[themeId] ?? null;
}

/** Introspection helper · used by tests to confirm which theme ids are
 *  registered. Returns a snapshot array; mutating it does not affect
 *  the real registry. */
export function listAtmosphereThemeIds(): readonly string[] {
  return Object.keys(REGISTRY);
}
