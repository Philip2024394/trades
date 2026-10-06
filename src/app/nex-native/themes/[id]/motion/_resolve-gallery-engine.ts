// src/app/nex-native/themes/[id]/motion/_resolve-gallery-engine.ts
//
// Animation Gallery · Server-safe colour resolver · sealed 2026-10-06.
//
// Resolves the active theme id into a `Required<ColourSystem>` the
// motion gallery page + client can consume universally. Lives in a
// plain (non-"use client") module so the gallery page can call it
// server-side without pulling the full Theme Engine into the server
// bundle.
//
// Universal Theme Colour Rule enforcement:
//
//   · Live-world id → the world's own ThemePackage.colours (through
//     resolveColours so partial declarations get sensible fills).
//   · DB theme id   → the row's accent_hex is seeded as `primary` ·
//     the engine's own default-fill behaviour supplies secondary /
//     highlight / glow / deep. This mirrors how the Standard
//     Experience shell resolves a sparse theme row.
//   · Unknown id    → the engine's own defaults · identical to how a
//     ThemePackage with no colours would resolve · never a second
//     colour system invented by the gallery.
//
// The NEX_DEFAULT_COLOURS block below MIRRORS the engine's own
// defaults at src/app/nex-native/chat-standard/_engine/theme-engine.tsx
// line 39. The engine is a "use client" module so the gallery page
// (Server Component) cannot import from it directly · if these two
// constants ever diverge, update them together. There is NO second
// colour system here · this is the engine's own fallback mirrored for
// server-side access.

import {
  isLiveWorldId,
  LIVE_WORLD_PACKAGES,
} from "@/app/nex-native/chat-standard/_live-worlds";
import type { ColourSystem } from "@/app/nex-native/chat-standard/_engine/types";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";

/** Engine's authoritative default palette · mirrored here so the
 *  server component can resolve a theme id without crossing the
 *  "use client" boundary. */
const NEX_DEFAULT_COLOURS: Required<ColourSystem> = {
  primary: "#00AFFF",
  secondary: "#4FC3DC",
  highlight: "#F4F7FC",
  glow: "rgba(0,175,255,0.35)",
  deep: "#020914",
};

/** Fill in every slot of a (possibly partial) ColourSystem · same
 *  fallback shape the engine uses internally so a sparse DB theme
 *  resolves identically on the gallery as it does inside the chat. */
function resolveColours(c: ColourSystem | undefined): Required<ColourSystem> {
  return {
    primary: c?.primary ?? NEX_DEFAULT_COLOURS.primary,
    secondary: c?.secondary ?? NEX_DEFAULT_COLOURS.secondary,
    highlight: c?.highlight ?? NEX_DEFAULT_COLOURS.highlight,
    glow: c?.glow ?? `${c?.primary ?? NEX_DEFAULT_COLOURS.primary}55`,
    deep: c?.deep ?? NEX_DEFAULT_COLOURS.deep,
  };
}

/** Resolve the colour bundle the Animation Gallery uses to tint its
 *  wrapper + cards + status strip + back link + NEW badge. Always
 *  returns a fully-resolved palette · never null · the gallery can
 *  tint every surface without a null-check. */
export async function resolveGalleryColours(
  themeId: string,
): Promise<Required<ColourSystem>> {
  if (isLiveWorldId(themeId)) {
    return resolveColours(LIVE_WORLD_PACKAGES[themeId].colours);
  }
  const row = await chatThemeService.getThemeById(themeId);
  if (row) {
    return resolveColours({ primary: row.accent_hex });
  }
  return resolveColours(undefined);
}
