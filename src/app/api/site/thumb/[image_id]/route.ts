// GET /api/site/thumb/[image_id]?w=800
//
// Watermarked thumbnail proxy for The Site wall. Wall previews route
// through here so free viewers see the "thenetworkers.app" mark
// burned in — the visible reason to upgrade. Any source CDN works
// (sharp fetches + composites), so we're not locked to ImageKit.
//
// Entitled viewers can bypass by calling /api/site/download/[id]
// which serves the raw file. The wall keeps using the watermarked
// thumb regardless — chip + Download button carry the "you own this"
// affordance.
//
// Caching: strong CDN + browser cache; the mark is deterministic per
// (image_id, width). Rev the query when the mark design changes.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { watermarkThumb } from "@/lib/siteWatermark";

export const runtime = "nodejs";
// Dynamic segment ([image_id]) — can't `force-static`, so we lean on
// the Cache-Control header set on the response to let the CDN + browser
// cache each rendered variant for a day.
export const dynamic = "force-dynamic";

const ALLOWED_WIDTHS = [400, 800, 1200, 1600];

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ image_id: string }> }
): Promise<NextResponse> {
  const { image_id: imageId } = await ctx.params;
  if (!imageId) return NextResponse.json({ error: "image_id_required" }, { status: 400 });

  const wIn = Number(req.nextUrl.searchParams.get("w") ?? "800");
  const width = ALLOWED_WIDTHS.includes(wIn) ? wIn : 800;

  const image = await supabaseAdmin
    .from("hammerex_feed_tile_library")
    .select("url, active, tier")
    .eq("slug", imageId)
    .maybeSingle();
  if (image.error || !image.data) {
    return NextResponse.json({ error: "image_not_found" }, { status: 404 });
  }
  if (!image.data.active) {
    return NextResponse.json({ error: "image_not_active" }, { status: 404 });
  }

  try {
    const { bytes, contentType } = await watermarkThumb(image.data.url as string, {
      maxWidth: width,
      format:   "webp"
    });
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type":  contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
        "X-Site-Thumb":  "watermarked"
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[site/thumb] failed:", message);
    return NextResponse.json({ error: `thumb_failed: ${message}` }, { status: 502 });
  }
}
