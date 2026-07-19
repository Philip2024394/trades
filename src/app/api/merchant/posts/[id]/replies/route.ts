// POST /api/merchant/posts/[id]/replies — merchant replies to a SiteBook post
// they've been invited to.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addReply, canMerchantAccessPost } from "@/lib/homeowners/posts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getListing() {
  const c    = await cookies();
  const slug = c.get("tn_merchant_slug")?.value;
  if (!slug) return null;
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, business_name")
    .eq("slug", slug)
    .maybeSingle();
  return res.data as { id: string; business_name: string } | null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  const listing = await getListing();
  if (!listing) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const allowed = await canMerchantAccessPost(postId, listing.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null) as { body?: string } | null;
  if (!body?.body?.trim()) return NextResponse.json({ ok: false, error: "empty-body" }, { status: 400 });

  const res = await addReply({
    postId,
    authorType: "trade",
    authorId:   listing.id,
    authorName: listing.business_name,
    body:       body.body
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });

  // Stamp last_read_at + mark this member as active on the post
  await supabaseAdmin
    .from("hammerex_sitebook_post_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("post_id", postId)
    .eq("listing_id", listing.id);

  return NextResponse.json({ ok: true, replyId: res.reply.id });
}
