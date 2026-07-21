// POST /api/merchant/trust-ladder/custom-badge/save
//
// Saves the merchant's chosen custom badge hex. Gated to Platinum
// tier + must have paid the £2.99 unlock (trust_badge_color must
// already be non-null from the Stripe webhook sentinel write).
//
// Body: { color: "#RRGGBB" }

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin }   from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const slug = await getMerchantSlug();
  if (!slug) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null) as { color?: unknown } | null;
  const color = typeof body?.color === "string" ? body.color.trim() : "";
  if (!HEX_RE.test(color)) {
    return NextResponse.json({ ok: false, error: "invalid_hex" }, { status: 400 });
  }

  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("trust_tier, trust_badge_color")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing) return NextResponse.json({ ok: false, error: "listing_not_found" }, { status: 404 });
  if (listing.trust_tier !== "platinum") {
    return NextResponse.json({ ok: false, error: "platinum_only" }, { status: 403 });
  }
  if (!listing.trust_badge_color) {
    return NextResponse.json({ ok: false, error: "unlock_required" }, { status: 402 });
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ trust_badge_color: color })
    .eq("slug", slug);
  if (upd.error) return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, color });
}
