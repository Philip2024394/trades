// src/lib/nex-native/theme-assets.ts
//
// Per-theme asset lookup · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Theme-neutral helper for resolving optional per-theme chrome assets
// that live in /public/nex-themes rather than in the nex_chat_theme
// row (keeps the table lean while still letting individual themes
// stamp their own flavour on specific surfaces).
//
// Current slots:
//   · shopBackgroundUrl · optional backdrop image for the in-chat
//     shop/menu bottom sheet (ShopGridModal). The modal still ships
//     its own gradient scrim · the image renders UNDER the scrim so
//     the product cards stay legible on any theme.
//
// Adding a new theme's shop background is a one-liner here · future
// bridges can migrate this to a dedicated column on nex_chat_theme
// (e.g. `shop_background_url text`) without changing the call sites.

export interface NexThemeAssets {
  /** Full-bleed image shown behind ShopGridModal's dark gradient.
   *  Null = use the modal's default gradient only. */
  shopBackgroundUrl: string | null;
  /** Per-theme send-button artwork · replaces the default orange disc
   *  on the PeerComposer when set. Null = default. */
  sendButtonUrl: string | null;
}

const EMPTY: NexThemeAssets = {
  shopBackgroundUrl: null,
  sendButtonUrl: null,
};

const THEME_ASSETS: Record<string, NexThemeAssets> = {
  // Joker · sealed 2026-10-01 · founder-set alley wallpaper so the
  // Shop/Menu slider reads as "night-alley storefront" instead of a
  // generic dark panel. Send button is the Batman roundel.
  "theme-0": {
    shopBackgroundUrl: "/nex-themes/joker-shop-bg.png",
    sendButtonUrl: "/nex-themes/joker-send-button.png",
  },
};

export function getThemeAssets(
  themeId: string | null | undefined,
): NexThemeAssets {
  if (!themeId) return EMPTY;
  return THEME_ASSETS[themeId] ?? EMPTY;
}
