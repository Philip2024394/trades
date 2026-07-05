// Blueprint preview-layout endpoint.
//
//   GET /api/studio/blueprints/[id]/preview-layout?page=home
//     → { ok, layout: StudioLayoutJson }
//
// Returns a live-renderable layout built from the manifest — no
// persistence. Consumed by BlueprintPreviewSlideover so the visual
// preview goes through the exact same StudioLiveShell that renders
// published sites, guaranteeing WYSIWYG.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { blueprintRegistry } from "@/lib/studio/blueprints";
import { buildLayoutFromSeeds } from "@/lib/studio/blueprints/buildLayout";
import type { BlueprintSectionSeed } from "@/lib/studio/blueprints";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const { id } = await ctx.params;
  const manifest = blueprintRegistry.get(id);
  if (!manifest) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 }
    );
  }
  const url = new URL(req.url);
  const pageId = url.searchParams.get("page") ?? "home";
  const seeds =
    (manifest.layout as Record<string, BlueprintSectionSeed[]>)[pageId] ??
    manifest.layout.home;
  const canonicalTrade = manifest.trades[0];
  const layout = await buildLayoutFromSeeds(seeds, {
    heroPool: pageId === "home" ? manifest.heroPool : undefined,
    assetContext: {
      industry: canonicalTrade,
      style: manifest.variant,
      seed: `preview:${id}`
    }
  });
  return NextResponse.json({ ok: true, layout });
}
