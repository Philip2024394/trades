// GET /api/site/return?session_id=cs_test_...
//
// Stripe success handoff for The Site checkout flows. The single +
// subscribe checkout endpoints set their success_url straight to
// /trade-off/search?tab=inspiration; this endpoint is an OPTIONAL
// intermediary the client can be routed through instead so the buyer
// email captured by Stripe becomes a signed cookie — anonymous
// buyers can then re-download without retyping their email.
//
// Flow:
//   1. Client returns from Stripe with ?session_id=cs_test_...
//   2. We retrieve the session, extract customer_email
//   3. Set the signed tn_site_buyer cookie
//   4. 302 redirect to the search page with the same success flag
//
// Signed-in merchants also get the cookie set — harmless, and useful
// as a fallback if they sign out later and still want to redownload.

import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { setSiteBuyerCookieOnResponse } from "@/lib/siteBuyerCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function searchUrl(req: NextRequest, extraQuery: string): string {
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const url = new URL(req.url);
  const origin = envOrigin && /^https?:\/\//.test(envOrigin) ? envOrigin : `${url.protocol}//${url.host}`;
  return `${origin}/trade-off/search?tab=inspiration&${extraQuery}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  const purchased = req.nextUrl.searchParams.get("purchased") ?? "";
  const subscribed = req.nextUrl.searchParams.get("subscribed") ?? "";

  const successQuery = purchased
    ? `purchased=${encodeURIComponent(purchased)}`
    : subscribed
      ? `subscribed=1`
      : "return=1";

  // No session_id means the caller didn't come from Stripe — just
  // pass through with the success flag.
  if (!sessionId) {
    return NextResponse.redirect(searchUrl(req, successQuery), 302);
  }

  let email: string | null = null;
  try {
    const stripe  = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    email = session.customer_details?.email
         ?? session.customer_email
         ?? (typeof session.metadata?.email === "string" ? session.metadata.email : null);
  } catch (err) {
    console.error("[site/return] session retrieve failed:", err instanceof Error ? err.message : err);
  }

  const res = NextResponse.redirect(searchUrl(req, successQuery), 302);
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setSiteBuyerCookieOnResponse(res, email);
  }
  return res;
}
