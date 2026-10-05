// src/app/nex-native/themes/[id]/motion/page.tsx
//
// Theme motion gallery · founder-updated 2026-10-05.
// --------------------------------------------------
// Lists all ten motion variants with TOGGLE SWITCHES (restored from
// the JokerController's dancing-dots panel · the dancing-dots entry
// point was retired, this page now owns the toggle UX). Multiple
// animations can run simultaneously · each enabled variant overlays
// live on this page via <JokerMotionOverlay />.
//
// Sealed 2026-10-01 motion standards section preserved at the end.

import * as React from "react";
import { MotionGalleryClient } from "./_motion-client";

export const runtime = "nodejs";
export const dynamic = "force-static";

export default async function JokerMotionGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#070b0f",
        color: "#F4F7FC",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "48px 20px",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", position: "relative", zIndex: 10 }}>
        <header style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#8FFF6E",
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            Theme · Animation Gallery
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Ten animation effects to choose from
          </h1>
          <p
            style={{
              color: "#8BA9D1",
              fontSize: 15,
              lineHeight: 1.55,
              marginTop: 12,
              maxWidth: 580,
            }}
          >
            Toggle any effect on with the switch · multiple can run at
            the same time and will overlay live on this page. Turn them
            all off and return to the plain chat with the back link
            below. Reached via the universal + menu → Animation on
            every theme.
          </p>
        </header>

        <MotionGalleryClient themeId={id} />
      </div>
    </main>
  );
}
