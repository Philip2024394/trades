// POST /api/trade-off/trade-connections/track
// Body: { merchant_slug, trade_slug?, product_slug?, action }
//
// Public endpoint — called by sendBeacon from the carousel + floating
// back button. Per-IP rate-limit (1 event per 2s) so we don't fill the
// table with bot or spam events. action ∈ view_trade | return_to_merchant
// | whatsapp_trade | call_trade.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const VALID_ACTIONS = new Set([
  "view_trade",
  "return_to_merchant",
  "whatsapp_trade",
  "call_trade"
]);

const RATE: Map<string, number> = new Map();
function ipKey(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || "unknown";
}

export async function POST(req: NextRequest) {
  const ip = ipKey(req);
  const now = Date.now();
  const last = RATE.get(ip) ?? 0;
  if (now - last < 2_000) {
    return NextResponse.json({ ok: false, error: "Slow down" }, { status: 429 });
  }
  RATE.set(ip, now);
  if (RATE.size > 500 && Math.random() < 0.05) {
    const cutoff = now - 10 * 60_000;
    for (const [k, ts] of RATE) if (ts < cutoff) RATE.delete(k);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const merchantSlug = typeof body.merchant_slug === "string" ? body.merchant_slug.trim() : "";
  const tradeSlug = typeof body.trade_slug === "string" ? body.trade_slug.trim() : "";
  const productSlug = typeof body.product_slug === "string" ? body.product_slug.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!merchantSlug || !VALID_ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: "Bad input" }, { status: 400 });
  }

  // Resolve slugs → IDs. We allow either trade_slug or product_slug to
  // be missing — return-trip events typically only carry the merchant.
  const merchantRow = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", merchantSlug)
    .maybeSingle();
  if (!merchantRow.data) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let trade_listing_id: string | null = null;
  if (tradeSlug) {
    const t = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id")
      .eq("slug", tradeSlug)
      .maybeSingle();
    trade_listing_id = t.data?.id ?? null;
  }

  let product_id: string | null = null;
  if (productSlug) {
    const p = await supabaseAdmin
      .from("hammerex_xrated_products")
      .select("id")
      .eq("listing_id", merchantRow.data.id)
      .eq("slug", productSlug)
      .maybeSingle();
    product_id = p.data?.id ?? null;
  }

  await supabaseAdmin.from("hammerex_xrated_trade_connections_events").insert({
    merchant_listing_id: merchantRow.data.id,
    trade_listing_id,
    product_id,
    action,
    session_id: ip
  });

  return NextResponse.json({ ok: true });
}
