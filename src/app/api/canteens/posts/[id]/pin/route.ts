// POST /api/canteens/posts/[id]/pin   { pinned: bool }
//
// Toggle the is_pinned flag on a canteen post. Only the post owner
// (author OR the canteen host) can pin. Cookie-session auth via
// getMerchantSlug — same pattern as the DELETE endpoint next door.
//
// Pinned posts sort first in the canteen feed.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const callerSlug = await getMerchantSlug();
  if (!callerSlug) return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });

  let body: { pinned?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const pinned = Boolean(body.pinned);

  const post = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("id, canteen_id, author_slug")
    .eq("id", id)
    .maybeSingle();
  if (!post.data) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

  const isAuthor = post.data.author_slug === callerSlug;
  let isHost = false;
  if (!isAuthor) {
    const canteen = await supabaseAdmin
      .from("hammerex_canteens")
      .select("host_slug")
      .eq("id", post.data.canteen_id)
      .maybeSingle();
    isHost = canteen.data?.host_slug === callerSlug;
  }
  if (!isAuthor && !isHost) {
    return NextResponse.json({ ok: false, error: "not-owner" }, { status: 403 });
  }

  const res = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .update({
      is_pinned: pinned,
      pinned_at: pinned ? new Date().toISOString() : null
    })
    .eq("id", id);
  if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, pinned });
}
