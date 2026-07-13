// GET /api/affiliates/dev-signin
//
// [DEV BUTTON] — remove on "remove dev buttons"
//
// Dev-only affiliate bypass. Signs in as the first affiliate in the
// DB (usually the demo affiliate) with no password. Prod returns 404.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setAffiliateSessionCookie } from "@/lib/affiliateSession";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const url = new URL(req.url);

  const { data, error } = await supabaseAdmin
    .from("hammerex_affiliates")
    .select("id")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    return NextResponse.json({
      error: "no_affiliate_seeded",
      hint: "Run scripts/seed-showcase-data.mjs to create demo affiliates."
    }, { status: 404 });
  }

  const res = NextResponse.redirect(new URL("/affiliates/dashboard", url.origin));
  setAffiliateSessionCookie(res, data.id);
  return res;
}
