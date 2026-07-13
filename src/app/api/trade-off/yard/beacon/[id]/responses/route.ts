// GET /api/trade-off/yard/beacon/[id]/responses
//
// Public read of a beacon's response thread. Returns responses in
// chronological order with responder identity (slug + trade + city)
// so the client can render a lightweight chat log.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: beaconId } = await ctx.params;
  if (!beaconId) {
    return NextResponse.json(
      { ok: false, error: "missing_beacon_id" },
      { status: 400 }
    );
  }

  const { data: responses, error } = await supabaseAdmin
    .from("hammerex_yard_beacon_responses")
    .select(
      "id, responder_listing_id, message, availability_text, price_pence, is_accepted, created_at"
    )
    .eq("beacon_post_id", beaconId)
    .eq("moderation_status", "live")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "query_failed", detail: error.message },
      { status: 500 }
    );
  }

  const responderIds = Array.from(
    new Set((responses ?? []).map((r) => r.responder_listing_id))
  );
  const responders: Record<
    string,
    {
      slug: string;
      display_name: string;
      trading_name: string | null;
      primary_trade: string;
      city: string | null;
      avatar_url: string | null;
    }
  > = {};
  if (responderIds.length > 0) {
    const { data: rows } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(
        "id, slug, display_name, trading_name, primary_trade, city, avatar_url"
      )
      .in("id", responderIds);
    for (const r of rows ?? []) {
      responders[r.id] = {
        slug: r.slug,
        display_name: r.display_name,
        trading_name: r.trading_name,
        primary_trade: r.primary_trade,
        city: r.city,
        avatar_url: r.avatar_url
      };
    }
  }

  const shaped = (responses ?? []).map((r) => ({
    id: r.id,
    message: r.message,
    availability: r.availability_text,
    pricePence: r.price_pence,
    isAccepted: r.is_accepted,
    createdAt: r.created_at,
    responder: responders[r.responder_listing_id] ?? null
  }));

  return NextResponse.json({ ok: true, responses: shaped });
}
