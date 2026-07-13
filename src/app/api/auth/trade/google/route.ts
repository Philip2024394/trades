// GET /api/auth/trade/google?next=/tc/notebook
//
// Kicks off the Google OAuth handshake via Supabase. Redirects the
// browser to Google's consent screen. Supabase writes an auth cookie
// on return via /auth/callback.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/tradeAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/tc/notebook";
  // Carry the selected viewer role from the two-card sign-up picker
  // through to the callback so DIY signups persist the correct role
  // at profile provisioning. Only "trade" or "diy" are accepted; any
  // other value falls back to "trade" (legacy default).
  const roleParam = url.searchParams.get("role");
  const role = roleParam === "diy" ? "diy" : "trade";
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}&role=${role}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent"
      }
    }
  });

  if (error || !data?.url) {
    return NextResponse.redirect(new URL(`/tc/sign-in?error=google_failed`, url.origin));
  }
  return NextResponse.redirect(data.url);
}
