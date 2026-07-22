// Cron · Sunday 23:55 UTC — closes this week's featured-slot auction.
//
// Picks the highest paid bid for the coming Monday, marks it as
// 'winner', marks all other paid bids for that week as 'outbid'.
// The rendering side reads status='winner' for the current week to
// know which merchant to show in the Trade Center featured strip.

import { NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron/authorise";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { nextMonday } from "@/lib/featuredSlotWeek";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const week = nextMonday();

  const { data: bids, error } = await supabaseAdmin
    .from("hammerex_featured_slot_bids")
    .select("id, merchant_slug, bid_amount_pence, paid_at")
    .eq("week_starting", week)
    .not("paid_at", "is", null)
    .order("bid_amount_pence", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const paid = bids ?? [];
  if (paid.length === 0) {
    return NextResponse.json({ ok: true, week, winner: null, participants: 0 });
  }

  const winner = paid[0];
  const outbid = paid.slice(1);

  await Promise.all([
    supabaseAdmin
      .from("hammerex_featured_slot_bids")
      .update({ status: "winner" })
      .eq("id", winner.id),
    outbid.length > 0
      ? supabaseAdmin
          .from("hammerex_featured_slot_bids")
          .update({ status: "outbid" })
          .in("id", outbid.map((b) => b.id))
      : Promise.resolve()
  ]);

  return NextResponse.json({
    ok:            true,
    week,
    winner:        { merchant_slug: winner.merchant_slug, bid_pence: winner.bid_amount_pence },
    participants:  paid.length
  });
}
