// src/app/nex-native/dev/themes-flow-fixture/page.tsx
//
// Phase 2 end-to-end flow fixture · mounts the real ThemeBrowserClient
// with the Phase 1 (phone tiles) and Phase 2 (immersive preview) flags
// forced on, backed by hard-coded themes. Lets Playwright walk the full
// journey without needing an authenticated session.
//
// DEV ONLY · same gate as every other dev fixture.
//   ?mode=gratis   → canUsePremium=false (locked state on Bisnis themes)
//   ?mode=trial    → canUsePremium=true  (treat as subscriber/trial)

import { notFound } from "next/navigation";
import * as React from "react";
import type { BrowserThemeRow } from "../../chat-themes-library/_theme-browser-client";
import { ThemesFlowFixtureBody } from "./_fixture-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALLPAPER_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO8rPr0PwAG5wLU/EMB7gAAAABJRU5ErkJggg==";

const FLOW_THEMES: BrowserThemeRow[] = [
  {
    id: "flow-free-classic",
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
    id: "flow-free-pill",
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
    id: "flow-bisnis-sparkle",
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
  {
    id: "flow-bisnis-gradient",
    name: "Bisnis · Gradient",
    tagline: "Accent-tinted gradient bubbles",
    accent_hex: "#B57AFF",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "bisnis",
    category: "premium",
    hero_image_url: WALLPAPER_PX,
    sort_order: 4,
    intro_video_url: null,
    intro_poster_url: null,
    wallpaper_config: { bubbleStyle: { preset: "gradient" } },
  },
];

export default async function ThemesFlowFixturePage({
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
  const canUsePremium = sp.mode !== "gratis";

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
        data-nex-themes-flow-fixture=""
        style={{ padding: "20px 16px 40px", maxWidth: 920, margin: "0 auto" }}
      >
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>
          Themes · Flow fixture
        </h1>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 12,
            color: "#8BA9D1",
            maxWidth: 820,
          }}
        >
          Phase 1 (tiles) + Phase 2 (immersive preview) both on.
          <code> ?mode=gratis</code> locks Bisnis tiles.
        </p>
        <ThemesFlowFixtureBody
          themes={FLOW_THEMES}
          currentThemeId="flow-free-classic"
          canUsePremium={canUsePremium}
        />
      </main>
    </>
  );
}
