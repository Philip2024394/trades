// GET /api/trade-off/products/list?slug=<slug>&edit_token=<token>
// Returns the listing's products ordered with live first, then by sort_order.

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

async function handle(
  slug: string,
  token: string,
  kindFilter: "product" | "service" | null
) {
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

  let q = supabaseAdmin
    .from("hammerex_xrated_products")
    .select("*")
    .eq("listing_id", listing.data.id);
  if (kindFilter) q = q.eq("kind", kindFilter);
  const res = await q
    .order("status", { ascending: true })
    .order("sort_order", { ascending: true });

  if (res.error) {
    console.error("[trade-off/products/list] select failed:", res.error);
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, products: res.data ?? [] });
}

function parseKind(raw: string): "product" | "service" | null {
  if (raw === "product") return "product";
  if (raw === "service") return "service";
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return handle(
    s(url.searchParams.get("slug")),
    s(url.searchParams.get("edit_token")),
    parseKind(s(url.searchParams.get("kind")))
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  return handle(s(body.slug), s(body.edit_token), parseKind(s(body.kind)));
}
