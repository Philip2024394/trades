// src/app/nex-native/themes/[id]/motion/page.tsx
//
// Animation Gallery · theme-coloured user feature · sealed 2026-10-06.
// --------------------------------------------------------------------
// Lists the available animation effects users can turn on inside the
// chat they are visiting. Reached from the universal + menu →
// Animation on every world · the gallery derives its ENTIRE colour
// treatment from the active world's resolved ThemePackage via
// `resolveGalleryColours`. Zero generic NEX palette lives here.
//
// Universal Theme Colour Rule (sealed 2026-10-06):
//
//   Active World ThemePackage
//      ↓
//   Theme Engine / resolved colours
//      ↓
//   Chat
//      ↓
//   Animation Gallery (background · heading · subcopy · caption)
//
// User-facing copy sealed 2026-10-06 · experiential language · never
// describes implementation details (no CSS behaviour / radial /
// scanline / "reads X" / RGB shift / etc).

import * as React from "react";
import { MotionGalleryClient } from "./_motion-client";
import { resolveGalleryColours } from "./_resolve-gallery-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function JokerMotionGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const colours = await resolveGalleryColours(id);

  return (
    <main
      data-nex-animation-gallery
      data-nex-theme-id={id}
      style={{
        minHeight: "100vh",
        background: colours.deep,
        color: colours.highlight,
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
              color: colours.primary,
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            Animation
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              margin: 0,
              lineHeight: 1.1,
              color: colours.highlight,
            }}
          >
            Bring your world to life
          </h1>
          <p
            style={{
              color: colours.secondary,
              fontSize: 15,
              lineHeight: 1.55,
              marginTop: 12,
              maxWidth: 580,
            }}
          >
            Choose the atmosphere you want in your chat. Turn on one
            effect or mix several together. New animations will be
            added regularly.
          </p>
        </header>

        <MotionGalleryClient themeId={id} colours={colours} />
      </div>
    </main>
  );
}
