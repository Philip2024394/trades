// GET /api/trade-off/shipping-zones/list?slug=<slug>&edit_token=<token>
// Returns the listing's shipping zones ordered by sort_order.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function handle(slug: string, token: string) {
  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const res = await supabaseAdmin
    .from("hammerex_xrated_shipping_zones")
    .select("*")
    .eq("listing_id", listing.data.id)
    .order("sort_order", { ascending: true });

  if (res.error) {
    console.error("[trade-off/shipping-zones/list] select failed:", res.error);
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, zones: res.data ?? [] });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return handle(s(url.searchParams.get("slug")), s(url.searchParams.get("edit_token")));
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  return handle(s(body.slug), s(body.edit_token));
}
