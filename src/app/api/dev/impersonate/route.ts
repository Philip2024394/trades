// GET /api/dev/impersonate?slug=<merchant-slug>&next=<path>
//
// [DEV BUTTON] — remove on "remove dev buttons"
//
// Dev-only admin sign-in. Reads the merchant's `edit_token` from
// hammerex_trade_off_listings and sets the studio session cookie so
// every server-side session helper (loadStudioSession /
// loadMerchantSession) returns that merchant. Redirects to `next`.
//
// Prod (NODE_ENV === "production") returns 404.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setStudioSession } from "@/lib/studio/session";

export const dynamic = "force-dynamic";

const DEFAULT_SLUG = "demo-stuart-kingsley-building-merchant-hull";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? DEFAULT_SLUG;
  const next = url.searchParams.get("next") ?? `/trade-off/yard`;

  const { data, error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, edit_token")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data?.edit_token) {
    return NextResponse.json({
      error: "merchant_not_found_or_no_edit_token",
      slug,
      hint: "Pick a different slug via ?slug=<slug>. Only merchants with an edit_token can be impersonated."
    }, { status: 404 });
  }

  await setStudioSession(data.edit_token);
  return NextResponse.redirect(new URL(next, url.origin));
}
