// POST /api/site/share
//
// The Site's "social editor" money-out — an entitled merchant posts a
// Site image straight into their own canteen with a caption. Because
// canteen posts aggregate into the platform-wide Yard, "post to
// Canteen" is also "post to Yard" — one call, two surfaces.
//
// Auth:
//   1. Merchant must be signed in (getMerchantIdentity)
//   2. Merchant must have clean access to the image (siteAccessFor):
//        subscription OR bundling tier OR prior purchase.
//      Unentitled callers get 402 with buy hints — same shape the
//      download endpoint returns, so the UI can reuse handling.
//
// Body: { image_id?, image_ids?, video_url?, caption?, kind? }
//   • image_id  — single slug from hammerex_feed_tile_library
//   • image_ids — array of slugs (Instagram-carousel share, up to 10)
//   • video_url — public MP4 URL from /api/site/editor/video/compose
//                 (video path — paid-tier only)
//   • caption  — optional post body (<= 4000 chars)
//   • kind     — "showcase" (default) | "question" | "chat"
//                Matches the canteen-post kinds any member can write.
//
// Response: { ok: true, canteen_slug, post_id }

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { siteAccessFor } from "@/lib/siteAccess";
import { getMerchantIdentity } from "@/lib/merchantSession";

const PAID_TIER_SET = new Set(["app_trial", "app_paid", "verified"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 4000;
type ShareKind = "showcase" | "question" | "chat";
const VALID_KINDS: ShareKind[] = ["showcase", "question", "chat"];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let payload: { image_id?: unknown; image_ids?: unknown; video_url?: unknown; caption?: unknown; kind?: unknown };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const imageId  = typeof payload.image_id === "string" ? payload.image_id.trim() : "";
  const videoUrl = typeof payload.video_url === "string" ? payload.video_url.trim() : "";
  // image_ids is the carousel path — array of slugs, capped at 10 to
  // match Instagram's own carousel cap. Falls back to [image_id] when
  // callers only send the legacy single-image field.
  const rawIds: string[] = Array.isArray(payload.image_ids)
    ? (payload.image_ids as unknown[])
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim())
    : [];
  const imageIds = rawIds.length > 0 ? rawIds.slice(0, 10) : (imageId ? [imageId] : []);
  if (imageIds.length === 0 && !videoUrl) {
    return NextResponse.json({ ok: false, error: "image_id_or_video_url_required" }, { status: 400 });
  }
  const caption = typeof payload.caption === "string" ? payload.caption.trim() : "";
  if (caption.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "caption_too_long" }, { status: 400 });
  }
  const kind: ShareKind = (VALID_KINDS as string[]).includes(payload.kind as string)
    ? (payload.kind as ShareKind)
    : "showcase";

  // Video path — paid-tier gate. Standard/free merchants can share
  // images but not videos to their canteen.
  if (videoUrl) {
    const listing = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("tier")
      .eq("slug", identity.slug)
      .maybeSingle();
    const tier = (listing.data as { tier?: string } | null)?.tier ?? "standard";
    if (!PAID_TIER_SET.has(tier)) {
      return NextResponse.json(
        {
          ok:     false,
          error:  "video_requires_paid",
          detail: "Video posts are a paid-tier feature. Upgrade to include video in your Canteen posts."
        },
        { status: 403 }
      );
    }
  }

  // Image path — enforce the entitlement gate + load the image URL
  // for EVERY slide in the carousel. Any slide the caller isn't
  // entitled to fails the whole share so the merchant doesn't post
  // a half-empty carousel.
  const imageUrlsToPost: string[] = [];
  for (const id of imageIds) {
    const access = await siteAccessFor(id, {
      merchantSlug: identity.slug,
      email:        null
    });
    if (!access.hasClean) {
      return NextResponse.json(
        {
          ok:             false,
          error:          "not_entitled",
          image_id:       id,
          buy_single_url: "/api/site/checkout/single",
          buy_sub_url:    "/api/site/checkout/subscribe"
        },
        { status: 402 }
      );
    }
    const image = await supabaseAdmin
      .from("hammerex_feed_tile_library")
      .select("slug, url, alt, tier, active")
      .eq("slug", id)
      .maybeSingle();
    if (image.error || !image.data) {
      return NextResponse.json({ ok: false, error: "image_not_found", image_id: id }, { status: 404 });
    }
    if (!image.data.active || (image.data.tier !== 2 && image.data.tier !== 3)) {
      return NextResponse.json({ ok: false, error: "image_not_for_sale", image_id: id }, { status: 400 });
    }
    imageUrlsToPost.push(image.data.url as string);
  }

  // Locate the merchant's canteen. If they don't have one, we can't
  // post — return a clear error the UI can surface as a hint to
  // create one first.
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, slug, name")
    .eq("host_slug", identity.slug)
    .limit(1)
    .maybeSingle();
  if (canteen.error || !canteen.data) {
    return NextResponse.json(
      { ok: false, error: "no_canteen", hint: "Create your canteen first." },
      { status: 400 }
    );
  }

  // Author display for the post row — same lookup canteen posts/create
  // uses so voice + avatar stay consistent across surfaces.
  const author = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("display_name, avatar_url")
    .eq("canteen_id", canteen.data.id)
    .eq("member_slug", identity.slug)
    .maybeSingle();

  const insert = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .insert({
      canteen_id:          canteen.data.id,
      author_slug:         identity.slug,
      author_display_name: author.data?.display_name ?? identity.slug,
      author_avatar_url:   author.data?.avatar_url   ?? null,
      kind,
      body:                caption || null,
      photo_urls:          imageUrlsToPost,
      video_urls:          videoUrl ? [videoUrl] : [],
      status:              "live"
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    console.error("[site/share] insert failed:", insert.error?.message);
    return NextResponse.json(
      { ok: false, error: "post_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok:           true,
    canteen_slug: canteen.data.slug as string,
    post_id:      insert.data.id as string
  });
}
