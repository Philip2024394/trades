// src/app/nex-native/dev/category-grid-fixture/page.tsx
//
// Step 1B.1 dev fixture · founder-approved 2026-10-06.
//
// Mounts <CategoryGrid> directly with the real live-world rows so a
// signed-out visitor (or Playwright) can verify the phone-frame hero
// tiles at every mainstream breakpoint. chat-themes-library's landing
// redirects anonymous visitors to /sign-in, which blocks visual
// verification · this fixture bypasses the auth gate for the grid
// alone.
//
// DEV ONLY · same gate as the Phase 1 phone-gallery fixture · NODE_ENV
// !== "production" (always true under `next dev`) with NEX_DEV_ROUTES=1
// as an explicit prod override. Returns notFound() otherwise.
//
// NON-GOALS · this fixture does NOT exercise the sign-in / trial /
// subscriber flow · those surfaces live above the grid in the real
// landing. The grid is universal · its data contract is a merged
// BrowserThemeRow[] · nothing else.

import { notFound } from "next/navigation";
import * as React from "react";
import { CategoryGrid } from "../../chat-themes-library/_category-grid";
import { listLiveWorldsAsBrowserRows } from "../../chat-themes-library/_live-worlds-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CategoryGridFixturePage(): Promise<React.JSX.Element> {
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) {
    notFound();
  }

  // Real live-world rows · the merged collection the production
  // landing passes to <CategoryGrid>. Enough coverage to render all
  // three categories (Ocean · Café · Explore) with their hero worlds
  // and dynamic counts (ocean=1, cafe=4, explore=1 today).
  const browserThemes = listLiveWorldsAsBrowserRows();

  return (
    <>
      <style>{`
        html, body { background: #020914 !important; color: #F4F7FC; margin: 0; }
        body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
      `}</style>
      <meta name="robots" content="noindex, nofollow" />
      <main
        style={{
          padding: "24px 16px 60px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
        data-nex-category-grid-fixture=""
      >
        <h1 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>
          Category Grid fixture
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 12,
            color: "#8BA9D1",
            maxWidth: 820,
          }}
        >
          Dev-only fixture for Step 1B.1 phone-frame hero tiles.
          Mounts <code>&lt;CategoryGrid&gt;</code> with the real
          live-world rows · bypasses the sign-in redirect that gates the
          production landing. Resize the browser between the sealed
          breakpoints (320 · 375 · 390 · 430 · 1280) to verify the
          responsive 1/2/3 column layout.
        </p>
        <CategoryGrid browserThemes={browserThemes} />
      </main>
    </>
  );
}
