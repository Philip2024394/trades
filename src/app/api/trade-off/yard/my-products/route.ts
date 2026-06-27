// GET /api/trade-off/yard/my-products?slug=&token=
//
// Returns the authed listing's published Shop Mode products so the
// Yard composer's left drawer can pre-fill a Product post from the
// merchant's existing catalogue. No paid-tier gate — builder-grade
// trades on the free Yard plan can use the drawer too as long as
// they have published products.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  const token = (url.searchParams.get("token") ?? "").trim();
  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or token" },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found" },
      { status: 404 }
    );
  }
  if (!constantTimeEq(token, listing.data.edit_token ?? "")) {
    return NextResponse.json(
      { ok: false, error: "Bad token" },
      { status: 403 }
    );
  }

  const products = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select(
      "id, name, description, price_pence, cover_url, gallery_urls, stock_count, status"
    )
    .eq("listing_id", listing.data.id)
    .eq("status", "live")
    .order("sort_order", { ascending: true })
    .limit(60);
  if (products.error) {
    return NextResponse.json(
      { ok: false, error: products.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, products: products.data ?? [] });
}
