// GET /api/site/download/[image_id]
//
// Entitlement-gated file download for The Site. The wall shows every
// image publicly, but *taking* a file (with a proper filename + a
// perpetual-licence receipt header) requires one of:
//   1. Active £14.99/mo Site subscription
//   2. Bundling tier (Professional / The Works)
//   3. Prior £5.99 single-image purchase for THIS image
//
// Access rule lives in src/lib/siteAccess.ts — this endpoint is the
// only enforcement point, so the rule stays in one place.
//
// Anonymous buyers pass their email as ?email=… so a purchase made
// during checkout can be redeemed later without logging in. Signed-in
// merchants skip the query param.
//
// On success we proxy-stream the upstream bytes with:
//   Content-Disposition: attachment; filename="the-site-{slug}.{ext}"
//   X-Site-Licence: <reason> — auditable header for support tickets
// Redirect-style downloads would leak the raw URL to browser history,
// so we proxy to give the file a proper name + a licence header.
//
// On failure we return 402 (Payment Required) with a JSON body the
// UI can use to launch the BuyImageModal with the right context.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { siteAccessFor } from "@/lib/siteAccess";
import { getMerchantSlug } from "@/lib/merchantSession";
import { readSiteBuyerEmailCookie } from "@/lib/siteBuyerCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(slug: string, url: string): string {
  const extMatch = url.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
  const ext = (extMatch?.[1] ?? "jpg").toLowerCase();
  const safeSlug = slug.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80);
  return `the-site-${safeSlug}.${ext}`;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ image_id: string }> }
): Promise<NextResponse> {
  const { image_id: imageId } = await ctx.params;
  if (!imageId) {
    return NextResponse.json({ error: "image_id_required" }, { status: 400 });
  }

  // Resolve identity in priority order:
  //   1. Signed-in merchant session
  //   2. Signed tn_site_buyer cookie (set by /api/site/return after
  //      an anonymous checkout succeeds)
  //   3. Explicit ?email= override (legacy / manual redemption)
  const merchantSlug = await getMerchantSlug();
  const cookieEmail  = await readSiteBuyerEmailCookie();
  const queryIn      = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  const queryEmail   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(queryIn) ? queryIn : null;
  const email        = cookieEmail ?? queryEmail;

  const access = await siteAccessFor(imageId, { merchantSlug, email });
  if (!access.hasClean) {
    return NextResponse.json(
      {
        error:          "not_entitled",
        image_id:       imageId,
        buy_single_url: "/api/site/checkout/single",
        buy_sub_url:    "/api/site/checkout/subscribe",
        hint:           "Buy this image for £5.99, or subscribe unlimited at £14.99/mo."
      },
      { status: 402 }
    );
  }

  // Look up the upstream URL. Tier 2/3 only — same guard the checkout
  // uses so we never serve a non-sellable asset even if a stale row
  // slipped through access.
  const image = await supabaseAdmin
    .from("hammerex_feed_tile_library")
    .select("slug, url, alt, tier, active")
    .eq("slug", imageId)
    .maybeSingle();
  if (image.error || !image.data) {
    return NextResponse.json({ error: "image_not_found" }, { status: 404 });
  }
  if (!image.data.active || (image.data.tier !== 2 && image.data.tier !== 3)) {
    return NextResponse.json({ error: "image_not_for_sale" }, { status: 400 });
  }

  const upstream = await fetch(image.data.url as string, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "upstream_fetch_failed" }, { status: 502 });
  }

  const filename    = safeFilename(image.data.slug as string, image.data.url as string);
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const length      = upstream.headers.get("content-length");

  const headers = new Headers({
    "Content-Type":        contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control":       "private, no-store",
    "X-Site-Licence":      access.reason
  });
  if (length) headers.set("Content-Length", length);

  return new NextResponse(upstream.body, { status: 200, headers });
}
