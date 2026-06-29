// POST /api/affiliates/logout — clears the affiliate session cookie.
import { NextResponse, type NextRequest } from "next/server";
import { clearAffiliateSessionCookie } from "@/lib/affiliateSession";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  clearAffiliateSessionCookie(response);
  return response;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Allow GET so the dashboard nav link can use a plain anchor.
  const response = NextResponse.redirect(
    new URL("/affiliates/login", req.url)
  );
  clearAffiliateSessionCookie(response);
  return response;
}
