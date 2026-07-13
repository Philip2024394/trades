// GET /api/auth/trade/facebook?next=/tc/notebook
//
// Kicks off Facebook OAuth via Supabase. Requires the Facebook
// provider to be enabled in the Supabase project (Dashboard →
// Authentication → Providers → Facebook).

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/tradeAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/tc/notebook";
  // Same role passthrough as the Google route — DIY signups via
  // Facebook must persist "diy" not the legacy trade default.
  const roleParam = url.searchParams.get("role");
  const role = roleParam === "diy" ? "diy" : "trade";
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: {
      redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}&role=${role}`,
      scopes: "email public_profile"
    }
  });

  if (error || !data?.url) {
    return NextResponse.redirect(new URL("/tc/sign-in?error=facebook_failed", url.origin));
  }
  return NextResponse.redirect(data.url);
}
