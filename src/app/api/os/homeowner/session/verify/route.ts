// GET /api/os/homeowner/session/verify?token=...&next=/home
//
// Consumes a magic link, sets the long-lived homeowner cookie, and
// redirects. Never renders JSON — this is the tail of an email flow.

import { NextResponse, type NextRequest } from "next/server";
import {
  HOMEOWNER_COOKIE,
  HOMEOWNER_COOKIE_OPTIONS,
  buildSessionCookie,
  verifyMagicLinkToken
} from "@/lib/os/homeownerSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const next = req.nextUrl.searchParams.get("next") || "/home";
  const safeNext = next.startsWith("/") ? next : "/home";

  const result = verifyMagicLinkToken(token);
  if ("error" in result) {
    return NextResponse.redirect(
      new URL(`/home/sign-in?error=${encodeURIComponent(result.error)}`, req.url),
      302
    );
  }

  const cookieValue = buildSessionCookie(result.partyId);
  const res = NextResponse.redirect(new URL(safeNext, req.url), 302);
  res.cookies.set(HOMEOWNER_COOKIE, cookieValue, HOMEOWNER_COOKIE_OPTIONS);
  return res;
}
