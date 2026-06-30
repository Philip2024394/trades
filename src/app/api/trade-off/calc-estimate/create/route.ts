// POST /api/trade-off/calc-estimate/create
// Body: { listing_slug, product_slug?, calculator_type, inputs, output }
// Returns: { ok: true, id, url }
//
// Stamps a Material Calculator run into hammerex_xrated_calc_estimates
// so the customer can share the link with their contractor / spouse.
// Public endpoint — no auth needed; cap one estimate per IP per 10s
// via in-memory bucket to slow spam.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "paint", "flooring", "tiles", "gravel", "concrete", "mortar",
  "bricks", "plasterboard", "insulation", "decking", "fencing",
  "paving", "skirting", "roof_tiles", "wallpaper", "render", "turf"
]);

const RATE: Map<string, number> = new Map();
function rateLimitKey(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || "unknown";
}

export async function POST(req: NextRequest) {
  const key = rateLimitKey(req);
  const now = Date.now();
  const last = RATE.get(key) ?? 0;
  if (now - last < 5_000) {
    return NextResponse.json(
      { ok: false, error: "Slow down — wait a few seconds before sharing another estimate." },
      { status: 429 }
    );
  }
  RATE.set(key, now);
  // Crude housekeeping — every ~200 keys, sweep stale entries.
  if (RATE.size > 200 && Math.random() < 0.05) {
    const cutoff = now - 5 * 60_000;
    for (const [k, ts] of RATE) if (ts < cutoff) RATE.delete(k);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const listingSlug = typeof body.listing_slug === "string" ? body.listing_slug.trim() : "";
  const productSlug = typeof body.product_slug === "string" ? body.product_slug.trim() : "";
  const calculatorType = typeof body.calculator_type === "string" ? body.calculator_type : "";
  if (!listingSlug || !ALLOWED_TYPES.has(calculatorType)) {
    return NextResponse.json(
      { ok: false, error: "listing_slug + calculator_type required." },
      { status: 400 }
    );
  }
  if (typeof body.inputs !== "object" || body.inputs === null) {
    return NextResponse.json({ ok: false, error: "inputs must be an object." }, { status: 400 });
  }
  if (typeof body.output !== "object" || body.output === null) {
    return NextResponse.json({ ok: false, error: "output must be an object." }, { status: 400 });
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", listingSlug)
    .eq("status", "live")
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }

  let productId: string | null = null;
  if (productSlug) {
    const prod = await supabaseAdmin
      .from("hammerex_xrated_products")
      .select("id")
      .eq("listing_id", listing.data.id)
      .eq("slug", productSlug)
      .maybeSingle();
    if (prod.data) productId = prod.data.id;
  }

  const ins = await supabaseAdmin
    .from("hammerex_xrated_calc_estimates")
    .insert({
      listing_id: listing.data.id,
      product_id: productId,
      calculator_type: calculatorType,
      inputs: body.inputs,
      output: body.output
    })
    .select("id")
    .maybeSingle();

  if (!ins.data) {
    return NextResponse.json({ ok: false, error: "Save failed." }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    ok: true,
    id: ins.data.id,
    url: `${origin}/shared-estimate/${ins.data.id}`
  });
}
