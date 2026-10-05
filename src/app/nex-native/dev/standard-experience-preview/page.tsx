// src/app/nex-native/dev/standard-experience-preview/page.tsx
//
// Phase 2A.0 Ocean pilot · dev route.
//
// Mounts the Ocean StandardExperience in a phone-sized viewport so the
// founder can run the acceptance test: "If I remove the Ocean wallpaper,
// does the remaining interface still feel Ocean?"
//
// Query params:
//   ?wallpaper=off  disables the wallpaper fallback (bubbles/motion/
//                   stickers/emoji/composer/shop/ambient must still
//                   feel Ocean on their own)
//
// Dev only · gated by NODE_ENV !== "production" with NEX_DEV_ROUTES=1
// as explicit prod override · same pattern as every other dev fixture.

import { notFound } from "next/navigation";
import * as React from "react";
import { OceanPilotBody } from "./_fixture-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StandardExperiencePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ wallpaper?: string; theme?: string }>;
}): Promise<React.JSX.Element> {
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) notFound();

  const sp = await searchParams;
  const wallpaperFallback =
    sp.wallpaper === "off" ? ("none" as const) : ("theme-gradient" as const);
  const themeId = sp.theme === "coffee" ? "coffee" : "ocean";

  return (
    <>
      <style>{`
        html, body { background: #020914 !important; color: #F4F7FC; margin: 0; }
        body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
      `}</style>
      <meta name="robots" content="noindex, nofollow" />
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px 12px 40px",
          gap: 16,
        }}
      >
        <div style={{ maxWidth: 560, width: "100%" }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
            Standard Experience · {themeId === "coffee" ? "Coffee" : "Ocean"} pilot
          </h1>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 12,
              color: "#8BA9D1",
              lineHeight: 1.6,
            }}
          >
            Phase 2A.0 · five surfaces mounted via the Theme Engine ·
            Maria Santos / Footwear Designer fixture ·
            {wallpaperFallback === "none" ? (
              <strong style={{ color: "#F4F7FC" }}>
                {" "}
                wallpaper OFF (acceptance test)
              </strong>
            ) : (
              <span> wallpaper ON</span>
            )}
            <br />
            <a
              href={`?${new URLSearchParams({
                ...(themeId !== "ocean" ? { theme: themeId } : {}),
                ...(wallpaperFallback !== "none" ? { wallpaper: "off" } : {}),
              }).toString()}`}
              style={{ color: "#00AFFF" }}
            >
              {wallpaperFallback === "none"
                ? "Turn wallpaper ON"
                : "Turn wallpaper OFF (acceptance test)"}
            </a>
            {" · "}
            <a
              href={`?${new URLSearchParams({
                theme: themeId === "ocean" ? "coffee" : "ocean",
                ...(wallpaperFallback === "none" ? { wallpaper: "off" } : {}),
              }).toString()}`}
              style={{ color: "#00AFFF" }}
            >
              Switch to {themeId === "ocean" ? "Coffee" : "Ocean"}
            </a>
          </p>
        </div>
        <div
          data-nex-standard-experience-stage
          style={{
            width: 390,
            height: 790,
            maxHeight: "calc(100dvh - 120px)",
            borderRadius: 32,
            overflow: "hidden",
            border: "1px solid rgba(0,175,255,0.35)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          }}
        >
          <OceanPilotBody wallpaperFallback={wallpaperFallback} themeId={themeId} />
        </div>
      </main>
    </>
  );
}
