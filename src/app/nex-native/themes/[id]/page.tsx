// src/app/nex-native/themes/[id]/page.tsx
//
// Dynamic theme viewer · Bridge 97g · Founder-set 2026-09-29.
// -------------------------------------------------------------------
// Renders a live sample chat for ANY registered theme id. Reads the
// theme from nex_chat_theme and hands the palette + wallpaper +
// animation config + bubble preset to a client viewer that mounts a
// mock peer chat via PortraitBloomShell.
//
// This is the "just show me what it looks like" surface. Sits next
// to the gallery: gallery = 31 cards at a glance, viewer = one theme
// full-screen.
//
// Static preview pages under this folder (theme-1, pink-dream,
// cyber-grid) take precedence for their ids · this dynamic route
// only fires for the 20-theme batch + any future theme without a
// sealed spec page.
//
// No auth. The viewer uses no-op actions (send/react/delete are all
// preview stubs) so nothing writes to the DB.

import { notFound, redirect } from "next/navigation";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { listThemeEmojis } from "@/lib/nex-native/theme-emoji-service";
import { listThemeStickers } from "@/lib/nex-native/theme-sticker-service";
import ThemeViewerClient from "./_viewer";
import { parseJokerMotion } from "./_joker-motion-data";
import { HauntedHotelChrome } from "@/components/nex-native/HauntedHotelChrome";
import {
  isLiveWorldId,
  LIVE_WORLD_PACKAGES,
} from "../../chat-standard/_live-worlds";
import { StandardExperienceLiveClient } from "./_standard-experience-live-client";
import { UniversalChromeOverlay } from "../../chat-standard/_universal-chrome-overlay";
import { UniversalComposerFooter } from "../../chat-standard/_universal-composer-footer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ThemeViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    mode?: string;
    motion?: string;
    shop_setup?: string;
  }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};

  // Standard-Experience-backed worlds short-circuit the DB-driven
  // viewer path · they are code-registered in `_live-worlds.ts` and
  // render the full Standard Experience (header icons + bubbles +
  // composer + shop sheet + call actions + + menu) as the live chat.
  // Rule sealed 2026-10-05 · scope: ocean · coffee · botanical-cafe ·
  // midnight-cafe · french-cafe.
  if (isLiveWorldId(id)) {
    return <StandardExperienceLiveClient pkg={LIVE_WORLD_PACKAGES[id]} />;
  }

  // The Haunted Hotel preview IS the depth-cards experience that the
  // founder spent 6 hours building: card carousel + atmosphere +
  // smoke + FX controller. Route this theme's preview URL directly at
  // that surface so there's one source of truth for the Haunted Hotel
  // chat look, instead of trying to replicate it in two places.
  if (id === "haunted-hotel") {
    redirect("/nex-native/chat/prototypes/hauntedhoteltheme");
  }

  const theme = await chatThemeService.getThemeById(id);
  if (!theme || !theme.is_active) notFound();

  // Bridge 97g · pre-compute sample message timestamps on the SERVER
  // so SSR and client hydration see identical ISO strings. Calling
  // Date.now() inside the client viewer produced a hydration mismatch
  // because server-render time and client-hydrate time drift by
  // 100-300ms. Passing them as props locks the values.
  const now = Date.now();
  const sentAts = {
    m1: new Date(now - 9 * 60_000).toISOString(),
    m2: new Date(now - 8 * 60_000).toISOString(),
    m3: new Date(now - 6 * 60_000).toISOString(),
    m4: new Date(now - 4 * 60_000).toISOString(),
    m5: new Date(now - 1 * 60_000).toISOString(),
    readEarly: new Date(now - 7 * 60_000).toISOString(),
    readMid: new Date(now - 5 * 60_000).toISOString(),
    readLate: new Date(now - 3 * 60_000).toISOString(),
  };

  // Preview-mode shop · defaults to product mode. `?mode=menu` on
  // the URL flips isVenue so the header icon becomes cutlery and
  // the slider header reads "Menu". Same data structure otherwise.
  const isVenueMode = sp.mode === "menu";
  const motionVariant = parseJokerMotion(sp.motion);
  // Sealed 2026-10-01 · default-ON in the theme preview so the
  // founder sees the 3-button chooser (Sell Products / Sell Food /
  // Affiliate) the moment they tap the Shop icon. Explicit opt-out
  // via `?shop_setup=0` falls through to the mock products grid.
  const showShopSetupChooser = sp.shop_setup !== "0";

  // Bridge ThemeEmoji-B · load this theme's emoji set (if any) so
  // the composer emoji picker paints the theme's tiles instead of
  // the default 40-emoji hardcoded array.
  const themeEmojiRows = await listThemeEmojis(theme.id).catch(() => []);
  const themeEmojis = themeEmojiRows.map((row) => ({
    slug: row.slug,
    imageUrl: row.image_url,
    label: row.label,
  }));

  // Bridge ThemeSticker · sealed 2026-10-01 · load this theme's
  // sticker set (if any) so the composer exposes the dedicated
  // Stickers tab. See Migration 118 + theme-sticker-service.ts.
  const themeStickerRows = await listThemeStickers(theme.id).catch(() => []);
  const themeStickers = themeStickerRows.map((row) => ({
    slug: row.slug,
    imageUrl: row.image_url,
    label: row.label,
    stickerType: row.sticker_type,
    aspectRatio: row.aspect_ratio,
  }));

  return (
    <>
      <ThemeViewerClient
        themeId={theme.id}
        themeName={theme.name}
        accent={theme.accent_hex}
        bubbleRim={theme.bubble_rim_hex ?? theme.accent_hex}
        composerRim={theme.composer_rim_hex ?? theme.accent_hex}
        wallpaperUrl={theme.hero_image_url}
        wallpaperConfig={theme.wallpaper_config}
        layoutStyle={theme.layout_style}
        sentAts={sentAts}
        isVenueMode={isVenueMode}
        showShopSetupChooser={showShopSetupChooser}
        themeEmojis={themeEmojis}
        themeStickers={themeStickers}
        motionVariant={motionVariant}
      />
      {/* Haunted Hotel chrome · atmosphere + smoke + FX controller.
          Mounted as a sibling of the viewer so the server-rendered
          Atmosphere layer can flow in from a server parent (viewer
          itself is a client component). Chrome's 10 FX toggles ship
          OFF by default · discoverable via the floating 3-dots. */}
      {theme.id === "haunted-hotel" && <HauntedHotelChrome />}
      {/* UNIVERSAL CHROME OVERLAY · sealed 2026-10-05 · every live
          theme route carries the 3-dots call actions. Joker (theme-0)
          has its own native lower-right controller (zIndex 9995) so
          the universal overlay is NOT mounted for Joker · otherwise
          two 3-dots buttons would be visible. Joker keeps its native
          motion controller as its only lower-right affordance. */}
      {theme.id !== "theme-0" && (
        <UniversalChromeOverlay accent={theme.accent_hex} />
      )}
      {/* UNIVERSAL COMPOSER FOOTER OVERLAY · sealed R3 revision 2 ·
          Prototype 5 pattern (pill with inline divider) drops on top
          of every legacy theme's native composer so the footer looks
          identical across every live theme. */}
      <UniversalComposerFooter accent={theme.accent_hex} />
    </>
  );
}
