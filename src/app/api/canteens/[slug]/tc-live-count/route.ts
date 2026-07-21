// GET /api/canteens/[slug]/tc-live-count
//
// Returns { count: number } — how many of this canteen owner's
// products are currently live on the platform-wide Trade Center
// (hammerex_xrated_trade_center_picks.status='active').
//
// Feeds the "Trade Center" stat tile on the canteen hero stats bar.
// Cheap: one join, one COUNT, no data returned besides the number.
//
// Missing listing (canteen with no trade-off listing row) → count 0.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("host_slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!canteen.data) return NextResponse.json({ count: 0 });

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", canteen.data.host_slug)
    .maybeSingle();
  if (!listing.data) return NextResponse.json({ count: 0 });

  const picks = await supabaseAdmin
    .from("hammerex_xrated_trade_center_picks")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listing.data.id)
    .eq("status", "active");

  return NextResponse.json({ count: picks.count ?? 0 });
}
