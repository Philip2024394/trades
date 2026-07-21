// POST /api/canteens/[slug]/invite-trade
//
// Owner-only. Adds a trade (by slug) as a member of the canteen. Reads
// the trade's listing display fields to populate the member row so
// the left-column members inbox renders correctly.
//
// Body: { tradeSlug: string }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: canteenSlug } = await params;
  const body = await req.json().catch(() => null) as { tradeSlug?: string } | null;
  const tradeSlug = body?.tradeSlug?.trim().toLowerCase();
  if (!tradeSlug) {
    return NextResponse.json({ ok: false, error: "missing-tradeSlug" }, { status: 400 });
  }

  // Owner check. Dev stub honoured via getMerchantSlug (same one the
  // membership endpoint uses).
  const viewer = await getMerchantSlug();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("slug", canteenSlug)
    .maybeSingle();
  if (!canteen.data) return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });

  const devForceHost = process.env.NETWORK_SESSION_STUB === "1";
  const isHost = devForceHost || canteen.data.host_slug === viewer;
  if (!isHost) {
    return NextResponse.json({ ok: false, error: "not-host" }, { status: 403 });
  }

  // Resolve trade listing for display fields.
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, primary_trade, city, avatar_url")
    .eq("slug", tradeSlug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "trade-not-found" }, { status: 404 });
  }

  // Idempotent — if already a member, return ok without duplicate insert.
  const existing = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("id")
    .eq("canteen_id", canteen.data.id)
    .eq("member_slug", tradeSlug)
    .maybeSingle();
  if (existing.data) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  const insert = await supabaseAdmin
    .from("hammerex_canteen_members")
    .insert({
      canteen_id:   canteen.data.id,
      member_slug:  listing.data.slug,
      display_name: listing.data.display_name ?? listing.data.slug,
      trade_label:  listing.data.primary_trade ?? "trade",
      city:         listing.data.city ?? null,
      avatar_url:   listing.data.avatar_url ?? null,
      role:         "member"
    })
    .select("id")
    .maybeSingle();
  if (insert.error) {
    return NextResponse.json({ ok: false, error: insert.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, memberId: insert.data?.id });
}
