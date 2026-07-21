// POST /api/canteens/[slug]/posts/[postId]/contact
//
// Match-making moment: a viewer taps "Contact" on a canteen post → we
// resolve the post's author (a canteen member), pull their WhatsApp
// (from members table or fallback to the trade listing), fire a
// `match_created` event into the Liquidity Engine, and hand back a
// wa.me deep-link the client opens.
//
// Response shape:
//   { ok: true, whatsappUrl: string | null, authorDisplayName: string,
//     fallbackHref: string | null }
//
// If no WhatsApp exists we return null + a fallbackHref that lets the
// UI degrade to an in-canteen reply flow instead of dropping the intent.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trackLiquidity } from "@/lib/analytics/track";
import { getMerchantSlug } from "@/lib/merchantSession";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toWaDigits(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length >= 8 ? digits : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  const { slug: canteenSlug, postId } = await params;

  // Load the post + author + canteen in parallel.
  const [postRes, canteenRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_canteen_posts")
      .select("id, canteen_id, author_slug, author_display_name, body")
      .eq("id", postId)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_canteens")
      .select("id, trade_slug")
      .eq("slug", canteenSlug)
      .maybeSingle()
  ]);
  if (!postRes.data)    return NextResponse.json({ ok: false, error: "post-not-found" }, { status: 404 });
  if (!canteenRes.data) return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });
  const post = postRes.data as { id: string; canteen_id: string; author_slug: string; author_display_name: string; body: string };
  if (post.canteen_id !== canteenRes.data.id) {
    return NextResponse.json({ ok: false, error: "post-canteen-mismatch" }, { status: 400 });
  }

  // Resolve author's WhatsApp — canteen member row first (per-canteen
  // overrides), then trade listing (global). Nulls collapse gracefully.
  const [memberRes, listingRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_canteen_members")
      .select("whatsapp, display_name")
      .eq("canteen_id", canteenRes.data.id)
      .eq("member_slug", post.author_slug)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("whatsapp, display_name")
      .eq("slug", post.author_slug)
      .maybeSingle()
  ]);
  const rawWhatsapp = memberRes.data?.whatsapp ?? (listingRes.data as { whatsapp?: string | null } | null)?.whatsapp ?? null;
  const waDigits = toWaDigits(rawWhatsapp);
  const authorDisplayName = post.author_display_name || memberRes.data?.display_name || listingRes.data?.display_name || post.author_slug;

  const teaser = post.body.slice(0, 100);
  const waText = `Hi ${authorDisplayName.split(" ")[0]} — saw your post on ${canteenSlug} canteen ("${teaser}${post.body.length > 100 ? "…" : ""}"). Want to talk it through?`;
  const whatsappUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}`
    : null;

  // Fallback — deep-link the viewer to the author's own canteen page so
  // they can post a reply there. Better than dropping the intent.
  const fallbackHref = `/trade-off/yard/canteens/${post.author_slug}`;

  // Resolve viewer identity for the liquidity event. Order:
  //  1. Signed-in merchant session (getMerchantSlug)
  //  2. Homeowner cookie (tn_homeowner_sid)
  //  3. Anonymous
  const viewerMerchantSlug = await getMerchantSlug();
  const jar = await cookies();
  const homeownerId = jar.get("tn_homeowner_sid")?.value ?? null;
  const actorKind: "merchant" | "homeowner" | "guest" =
    viewerMerchantSlug ? "merchant" : homeownerId ? "homeowner" : "guest";
  const actorId = viewerMerchantSlug ?? homeownerId ?? "guest";

  // Fire match_created — one-way handshake counts as a match attempt in
  // the Liquidity Engine. Real match_completed fires when the author
  // responds (Phase 3 wiring — inbound reply / WhatsApp bounce-back).
  void trackLiquidity({
    slug:           "canteen.post_contacted",
    product:        "canteen",
    actorKind,
    actorId,
    lifecycleStage: "match_created",
    targetKind:     "canteen_post",
    targetId:       post.id,
    metadata: {
      canteen_slug:      canteenSlug,
      via:               waDigits ? "whatsapp" : "in_platform_fallback",
      counterparty_kind: "trade",
      counterparty_id:   post.author_slug
    }
  });

  return NextResponse.json({
    ok: true,
    whatsappUrl,
    authorDisplayName,
    fallbackHref
  });
}
