// NEX Business PWA · GET /api/b/[slug]/manifest.json (Philip 2026-08-14 · Phase 18).
//
// Dynamic per-business PWA manifest. Every business gets its own
// installable app · same NEX Core underneath, branded outside.
//
// Constitutional locks:
//   - `start_url` = /b/{slug}/chat  · NEVER /nex-app · NEVER /workspace
//   - `scope`     = /b/{slug}/       · install scope is the business branch only
//   - `name`      = business displayName from Blueprint (never hard-coded)
//   - Icon served from same-origin route so no third-party host is involved

import { NextResponse } from "next/server";
import { ensureSeeded, getBusiness } from "@/lib/nex/business-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  if (!biz) return NextResponse.json({ error: "unknown-business" }, { status: 404 });

  const displayName = biz.blueprint.identity.displayName;
  const shortName = displayName.length > 12 ? displayName.slice(0, 11) + "…" : displayName;
  const primary = biz.blueprint.brand.palette.primary;
  const bg = biz.blueprint.brand.palette.background;

  const manifest = {
    name: displayName,
    short_name: shortName,
    description: biz.blueprint.identity.aboutBlurb ?? `${displayName} · installable NEX-powered app`,
    start_url: `/b/${slug}/chat`,
    scope: `/b/${slug}/`,
    display: "standalone",
    orientation: "portrait",
    theme_color: primary,
    background_color: bg,
    icons: [
      { src: `/api/b/${slug}/icon?size=192`, sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
      { src: `/api/b/${slug}/icon?size=512`, sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
    ]
  };

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/manifest+json",
      "cache-control": "no-store"    // Blueprint changes must be reflected immediately
    }
  });
}
