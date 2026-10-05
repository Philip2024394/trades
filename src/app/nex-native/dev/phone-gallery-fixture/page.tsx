// src/app/nex-native/dev/phone-gallery-fixture/page.tsx
//
// Phase 1 dev fixture · founder-approved 2026-10-05.
//
// Mounts <PhoneGrid> directly with hard-coded theme rows so Playwright
// can verify responsive layout, keyboard navigation, reduced-motion,
// and the IntersectionObserver-based pause without needing a signed-in
// session (chat-themes-library redirects to /sign-in otherwise).
//
// DEV ONLY · same gate as the Phase 0 shadow route · NODE_ENV !==
// "production" (always true under `next dev`) with NEX_DEV_ROUTES=1 as
// an explicit prod override. Returns notFound() otherwise.

import { notFound } from "next/navigation";
import * as React from "react";
import type { BrowserThemeRow } from "../../chat-themes-library/_theme-browser-client";
import { PhoneGalleryFixtureBody } from "./_fixture-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALLPAPER_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO8rPr0PwAG5wLU/EMB7gAAAABJRU5ErkJggg==";

const FIXTURE_THEMES: BrowserThemeRow[] = [
  {
    id: "fx-free-classic",
    name: "Free · Classic",
    tagline: "Default pink-dream fallback",
    accent_hex: "#F8C8DC",
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
    tagline: "Rounded pill bubbles",
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
    tagline: "Twinkling stars overlay",
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
  {
    id: "fx-bisnis-particles",
    name: "Bisnis · Particles",
    tagline: "Ember-style upward drift",
    accent_hex: "#FFB366",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "bisnis",
    category: "premium",
    hero_image_url: WALLPAPER_PX,
    sort_order: 4,
    intro_video_url: null,
    intro_poster_url: null,
    wallpaper_config: {
      bubbleStyle: { preset: "pill" },
      particleDrift: {
        color: "#FFB366",
        count: 16,
        size: 4,
        speedSeconds: 14,
      },
    },
  },
  {
    id: "fx-bisnis-gradient",
    name: "Bisnis · Gradient",
    tagline: "Accent-tinted gradient bubbles",
    accent_hex: "#B57AFF",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "bisnis",
    category: "premium",
    hero_image_url: WALLPAPER_PX,
    sort_order: 5,
    intro_video_url: null,
    intro_poster_url: null,
    wallpaper_config: { bubbleStyle: { preset: "gradient" } },
  },
  {
    id: "fx-bisnis-square",
    name: "Bisnis · Square",
    tagline: "Sharp geometric bubbles",
    accent_hex: "#7CF8B8",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "bisnis",
    category: "premium",
    hero_image_url: WALLPAPER_PX,
    sort_order: 6,
    intro_video_url: null,
    intro_poster_url: null,
    wallpaper_config: { bubbleStyle: { preset: "square" } },
  },
  {
    id: "fx-free-active",
    name: "Free · Active sample",
    tagline: "Shows the Active chip state",
    accent_hex: "#00AFFF",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "gratis",
    category: "standard",
    hero_image_url: WALLPAPER_PX,
    sort_order: 7,
    intro_video_url: null,
    intro_poster_url: null,
    wallpaper_config: { bubbleStyle: { preset: "classic" } },
  },
  {
    id: "fx-locked",
    name: "Bisnis · Locked",
    tagline: "Shows the lock state for gratis viewers",
    accent_hex: "#FF4FA3",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "bisnis",
    category: "premium",
    hero_image_url: WALLPAPER_PX,
    sort_order: 8,
    intro_video_url: null,
    intro_poster_url: null,
    wallpaper_config: { bubbleStyle: { preset: "classic" } },
  },
];

export default async function PhoneGalleryFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}): Promise<React.JSX.Element> {
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) {
    notFound();
  }
  const sp = await searchParams;
  // ?mode=gratis   → canUsePremium=false  (locked badge appears)
  // ?mode=trial    → canUsePremium=true   (FREE pill appears)
  // default        → bisnis subscriber   (no locks, no FREE pill)
  const canUsePremium = sp.mode !== "gratis";
  const trialMode = sp.mode === "trial";

  return (
    <>
      <style>{`
        html, body { background: #020914 !important; color: #F4F7FC; margin: 0; }
        body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
        @keyframes nex-themes-trial-free-pulse {
          0%   { opacity: 1;    transform: scale(1);    box-shadow: 0 0 0 0 rgba(255,120,0,0.5); }
          50%  { opacity: 0.55; transform: scale(1.04); box-shadow: 0 0 0 8px rgba(255,120,0,0); }
          100% { opacity: 1;    transform: scale(1);    box-shadow: 0 0 0 0 rgba(255,120,0,0); }
        }
      `}</style>
      <meta name="robots" content="noindex, nofollow" />
      <main
        style={{
          padding: "24px 16px 60px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
        data-nex-phone-gallery-fixture={sp.mode ?? "default"}
      >
        <h1 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>
          Phone Gallery fixture
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 12,
            color: "#8BA9D1",
            maxWidth: 820,
          }}
        >
          Dev-only fixture for Phase 1 responsive + a11y verification.
          Modes:{" "}
          <code>?mode=gratis</code> (lock badge),{" "}
          <code>?mode=trial</code> (FREE pulse), default (subscriber view).
          The second tile is marked active so the chip renders.
        </p>
        <PhoneGalleryFixtureBody
          themes={FIXTURE_THEMES}
          currentThemeId="fx-free-active"
          canUsePremium={trialMode ? true : canUsePremium}
        />
      </main>
    </>
  );
}
