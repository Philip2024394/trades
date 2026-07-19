// POST /api/homeowner/wa-messages — homeowner sends a WhatsApp message
// through SiteBook. We save the message first, then return a wa.me
// URL for the client to window.open() so WhatsApp launches with the
// composed text pre-filled.
//
// The trade replies via WhatsApp (untracked) OR via the reply-link
// footer that leads to /r/{token} (tracked, lands as inbound).
//
// Body:
//   {
//     postId:         string   (the SiteBook post this thread belongs to)
//     tradeListingId: string   (which merchant we're messaging)
//     body:           string   (message text — required)
//     templateUsed?:  string   (analytics: which preset was picked)
//   }
//
// Response:
//   {
//     ok:          true
//     waUrl:       string   (open this to launch WhatsApp)
//     threadId:    string
//     threadToken: string   (the /r/{token} public reply key)
//   }

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin }           from "@/lib/supabaseAdmin";
import { sendOutgoingMessage }     from "@/lib/homeowners/waMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const payload = await req.json().catch(() => null) as {
    postId?:         string;
    tradeListingId?: string;
    body?:           string;
    templateUsed?:   string;
  } | null;

  if (!payload?.postId)          return NextResponse.json({ ok: false, error: "missing-post" },  { status: 400 });
  if (!payload.tradeListingId)   return NextResponse.json({ ok: false, error: "missing-trade" }, { status: 400 });
  if (!payload.body?.trim())     return NextResponse.json({ ok: false, error: "empty-body" },    { status: 400 });

  // Verify homeowner owns the post
  const post = await supabaseAdmin
    .from("hammerex_sitebook_posts")
    .select("id, project_id, homeowner_id")
    .eq("id", payload.postId)
    .eq("homeowner_id", homeowner.id)
    .maybeSingle();
  if (!post.data) return NextResponse.json({ ok: false, error: "post-not-found" }, { status: 404 });

  // Look up the trade's contact — need WhatsApp e164 for the wa.me URL
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, business_name, whatsapp, phone")
    .eq("id", payload.tradeListingId)
    .maybeSingle();
  if (!listing.data) return NextResponse.json({ ok: false, error: "trade-not-found" }, { status: 404 });
  const trade = listing.data as {
    id:            string;
    slug:          string;
    business_name: string;
    whatsapp:      string | null;
    phone:         string | null;
  };

  const waNumber = trade.whatsapp || trade.phone;
  if (!waNumber) {
    return NextResponse.json({ ok: false, error: "trade-no-whatsapp" }, { status: 400 });
  }

  const res = await sendOutgoingMessage({
    postId:             payload.postId,
    projectId:          post.data.project_id,
    homeownerId:        homeowner.id,
    homeownerFirstName: homeowner.first_name,
    siteBookNickname:   homeowner.house_nickname,
    siteBookSlug:       homeowner.slug,
    tradeListingId:     trade.id,
    tradeSlug:          trade.slug,
    tradeName:          trade.business_name,
    tradeWhatsapp:      waNumber,
    body:               payload.body,
    templateUsed:       payload.templateUsed
  });

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json({
    ok:          true,
    waUrl:       res.waUrl,
    threadId:    res.thread.id,
    threadToken: res.thread.token
  });
}
