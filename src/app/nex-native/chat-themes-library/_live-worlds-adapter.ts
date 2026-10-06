// src/app/nex-native/chat-themes-library/_live-worlds-adapter.ts
//
// Live-world → Theme-Library adapter · sealed 2026-10-06.
//
// Standard Experience worlds (ocean · coffee · botanical-cafe ·
// midnight-cafe · french-cafe) are code-registered in
// `src/app/nex-native/chat-standard/_live-worlds.ts` as full
// `ThemePackage` objects, NOT in the `nex_chat_theme` DB table.
// Before this adapter they were invisible in the Theme Library because
// the Library's data loader queried only `chatThemeService.listActiveThemes()`.
//
// This adapter maps each registered `ThemePackage` into the shape the
// Library's client expects (`BrowserThemeRow`) so the Library can
// present DB themes AND code-registered live-worlds as ONE collection.
//
// Load-bearing architectural rules:
//
//   · Code remains the authoritative source for Standard Experience
//     worlds. The DB `nex_chat_theme` table is NOT augmented with
//     rows for live-worlds (no migration · no duplication · no drift
//     between code and DB).
//   · The adapter is derivation-only · changes to a world's
//     `ThemePackage` automatically propagate to the Library.
//   · Any future live-world added to `LIVE_WORLD_PACKAGES` appears in
//     the Library automatically · no code change in the Library.
//   · No theme-id branches · the mapping is a pure function of the
//     `ThemePackage` fields.
//   · Universal theme handoff (`themePreviewHref(theme.id)` sealed in
//     4974edc9) applies identically to live-worlds · they resolve to
//     `/nex-native/themes/${theme.id}` like every other theme.

import {
  LIVE_WORLD_IDS,
  LIVE_WORLD_PACKAGES,
  type LiveWorldId,
} from "../chat-standard/_live-worlds";
import type { BrowserThemeRow } from "./_theme-browser-client";

/** Convert a single live-world `ThemePackage` into the shape the
 *  Theme Library's client expects. Pure function · no I/O · derived
 *  entirely from the package. */
export function liveWorldAsBrowserRow(id: LiveWorldId): BrowserThemeRow {
  const pkg = LIVE_WORLD_PACKAGES[id];
  const introVideoUrl =
    pkg.intro && pkg.intro.kind === "standard" ? pkg.intro.videoUrl : null;
  return {
    id: pkg.identity.id,
    name: pkg.identity.name,
    tagline: pkg.identity.tagline ?? null,
    accent_hex: pkg.colours.primary,
    // Prefer the engine's secondary/highlight as the bubble/composer
    // rim so themes with a distinct secondary pop a little · fall back
    // to the primary for themes where the two match.
    bubble_rim_hex: pkg.colours.secondary ?? pkg.colours.primary,
    composer_rim_hex: pkg.colours.highlight ?? pkg.colours.primary,
    // Standard Experience worlds are core NEX capability · free for
    // every account. Never gated behind the Bisnis premium tier.
    tier: "gratis",
    category: "standard",
    hero_image_url: pkg.wallpaperUrl ?? null,
    // Sort live-worlds before DB themes · DB themes typically carry
    // positive sort_order values · a negative value puts live-worlds
    // ahead of them deterministically without having to reach into
    // the DB to inspect.
    sort_order: -1,
    intro_video_url: introVideoUrl,
    intro_poster_url: null,
    wallpaper_config: null,
  };
}

/** List every registered Standard Experience world as a
 *  `BrowserThemeRow`. The Theme Library page merges this list with
 *  the DB-sourced themes. Order follows `LIVE_WORLD_IDS` in
 *  `_live-worlds.ts`. */
export function listLiveWorldsAsBrowserRows(): BrowserThemeRow[] {
  return LIVE_WORLD_IDS.map((id) => liveWorldAsBrowserRow(id));
}
