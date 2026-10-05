// src/app/nex-native/dev/status-viewer-v1/page.tsx
//
// Dev route · Status Viewer v1 · founder-sealed 2026-10-05.
//
// Full-fidelity Prototype 8 implementation (vertical-scroll TikTok
// pattern) wired to the real Theme Engine so status pages inherit the
// poster's theme (NEX-unique killer feature #1).
//
// Query params:
//   ?theme=ocean|coffee|botanical-cafe|midnight-cafe|french-cafe
//     Picks which world's engine the viewer uses · defaults to Ocean.
//
// Gated by NODE_ENV !== "production" || NEX_DEV_ROUTES=1.

import { notFound } from "next/navigation";
import * as React from "react";
import { StatusViewerClient } from "./_client";
import { isLiveWorldId, LIVE_WORLD_PACKAGES } from "../../chat-standard/_live-worlds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StatusViewerV1Page({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}): Promise<React.JSX.Element> {
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) notFound();

  const sp = await searchParams;
  const themeId = isLiveWorldId(sp.theme) ? sp.theme : "ocean";
  const pkg = LIVE_WORLD_PACKAGES[themeId];

  return (
    <>
      <style>{`
        html, body { background: #000 !important; color: #F4F7FC; margin: 0; overflow: hidden; }
        body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
      `}</style>
      <meta name="robots" content="noindex, nofollow" />
      <StatusViewerClient pkg={pkg} themeId={themeId} />
    </>
  );
}
