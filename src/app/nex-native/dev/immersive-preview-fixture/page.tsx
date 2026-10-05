// src/app/nex-native/dev/immersive-preview-fixture/page.tsx
//
// Phase 2 dev fixture · founder-approved 2026-10-05.
//
// Mounts <ImmersivePreviewShell> directly with hard-coded theme rows so
// Playwright can exercise responsive layout, swipe, URL state, local
// test conversation and reduced-motion without a signed-in session.
// Dev-only · gated by NODE_ENV !== "production" with NEX_DEV_ROUTES=1
// as an explicit prod override.
//
// Query params:
//   ?i=<index>     starting theme index (default 0)
//   ?mode=gratis   canUsePremium=false  (lock state on Bisnis themes)

import { notFound } from "next/navigation";
import * as React from "react";
import type { BrowserThemeRow } from "../../chat-themes-library/_theme-browser-client";
import { ImmersivePreviewFixtureBody } from "./_fixture-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALLPAPER_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO8rPr0PwAG5wLU/EMB7gAAAABJRU5ErkJggg==";

const FIXTURE_THEMES: BrowserThemeRow[] = [
  {
    id: "fx-free-active",
    name: "Free · Classic",
    tagline: "Default · currently active",
    accent_hex: "#00AFFF",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "gratis",
    category: "standard",
    hero_image_url: WALLPAPER_PX,
    sort_order: 1,
    intro_video_url: null,
    intro_poster_url: null,
    wallpaper_config: { bubbleStyle: { preset: "classic" } },
  },
  {
    id: "fx-free-pill",
    name: "Free · Pill",
    tagline: "Rounded calm bubbles",
    accent_hex: "#8BE1E6",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "gratis",
    category: "standard",
    hero_image_url: WALLPAPER_PX,
    sort_order: 2,
    intro_video_url: null,
    intro_poster_url: null,
    wallpaper_config: { bubbleStyle: { preset: "pill" } },
  },
  {
    id: "fx-bisnis-sparkle",
    name: "Bisnis · Sparkle",
    tagline: "Twinkling atmosphere",
    accent_hex: "#FFEDAA",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "bisnis",
    category: "premium",
    hero_image_url: WALLPAPER_PX,
    sort_order: 3,
    intro_video_url: null,
    intro_poster_url: null,
    wallpaper_config: {
      bubbleStyle: { preset: "outlined" },
      sparkle: { color: "#FFEDAA", count: 24, size: 3, twinkleSeconds: 3 },
    },
  },
];

export default async function ImmersivePreviewFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ i?: string; mode?: string }>;
}): Promise<React.JSX.Element> {
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) {
    notFound();
  }
  const sp = await searchParams;
  const i = Math.max(0, Math.min(FIXTURE_THEMES.length - 1, Number(sp.i ?? 0)));
  const canUsePremium = sp.mode !== "gratis";

  return (
    <>
      <style>{`
        html, body { background: #020914 !important; color: #F4F7FC; margin: 0; }
        body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
      `}</style>
      <meta name="robots" content="noindex, nofollow" />
      <main data-nex-immersive-preview-fixture="" style={{ minHeight: "100dvh" }}>
        <ImmersivePreviewFixtureBody
          themes={FIXTURE_THEMES}
          initialIndex={i}
          canUsePremium={canUsePremium}
        />
      </main>
    </>
  );
}
