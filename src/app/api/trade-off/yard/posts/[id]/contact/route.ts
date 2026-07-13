// GET /api/trade-off/yard/posts/:id/contact
//
// Click-through redirect for the WhatsApp / Reply button on a Yard
// post card. We increment the post's contact_count by 1 and 302
// redirect the browser to the wa.me URL. Using a server redirect (vs
// a client fetch + window.open) means:
//   - no popup-blocker issues
//   - works with JS disabled
//   - the counter is reliable + we own the rate-limit story
//
// Query params: ?to=wa-deeplink-url (must be a wa.me URL).

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logContactReceived } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ?? "";

  // Only accept wa.me destinations. Anything else gets dropped to
  // /find/beacon as a safe fallback so we never become an open
  // redirector.
  const safe = /^https?:\/\/wa\.me\//i.test(to);
  const dest = safe ? to : "/";

  // Bump the counter. Best-effort — even if this fails we still
  // redirect so the user's button tap doesn't dead-end.
  try {
    await supabaseAdmin.rpc("hammerex_increment_yard_contact", {
      p_post_id: id
    });
  } catch {
    // Trigger an inline fallback if the RPC isn't deployed yet —
    // simpler, slightly racy increment via a read-then-write.
    try {
      const row = await supabaseAdmin
        .from("hammerex_trade_off_yard_posts")
        .select("contact_count")
        .eq("id", id)
        .maybeSingle();
      const current = (row.data?.contact_count as number | null) ?? 0;
      await supabaseAdmin
        .from("hammerex_trade_off_yard_posts")
        .update({ contact_count: current + 1 })
        .eq("id", id);
    } catch {
      // swallow — never block the user's tap
    }
  }

  // Log to the post owner's activity feed — best-effort, never blocks.
  try {
    const { data: postRow } = await supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .select("listing_id")
      .eq("id", id)
      .maybeSingle();
    if (postRow?.listing_id) {
      await logContactReceived({
        post_id: id,
        post_owner_listing_id: postRow.listing_id
      });
    }
  } catch {
    /* swallow */
  }

  return NextResponse.redirect(dest, { status: 302 });
}
