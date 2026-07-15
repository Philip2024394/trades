// POST /api/merchant/[slug]/apply-palette
//
// Sets the merchant's palette on hammerex_trade_off_listings.palette_slug.
// Auth: the signed-in trade session cookie must match the slug in the
// URL path — otherwise 403. Body: { paletteSlug }.
//
// Rejects any slug not present in PALETTES so we never write an
// unknown value the canteen renderer wouldn't understand.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { PALETTES } from "@/lib/paletteTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  paletteSlug?: unknown;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sessionSlug = await getMerchantSlug();
  if (!sessionSlug) {
    return NextResponse.json({ ok: false, error: "not-signed-in" }, { status: 401 });
  }
  if (sessionSlug !== slug) {
    return NextResponse.json({ ok: false, error: "not-your-listing" }, { status: 403 });
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const paletteSlug =
    typeof payload.paletteSlug === "string" ? payload.paletteSlug.trim() : "";
  if (!paletteSlug || !(paletteSlug in PALETTES)) {
    return NextResponse.json({ ok: false, error: "invalid-palette" }, { status: 400 });
  }

  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ palette_slug: paletteSlug })
    .eq("slug", slug);
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[apply-palette] failed", { slug, paletteSlug, error: res.error });
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, applied: paletteSlug });
}
