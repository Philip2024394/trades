// Studio magic-link entry.
//
// GET /api/studio/enter?token=<edit_token>
//
// Route Handler (not a Server Component) so it can legally call
// cookies().set() — Next.js 15+ restricts cookie mutation to Route
// Handlers and Server Actions.
//
// Validates the token against hammerex_trade_off_listings.edit_token,
// sets the HttpOnly session cookie, and 303s the merchant into
// /studio/home. Bad tokens 303 to /studio?failed=1 so the sign-in
// screen shows the "link expired" hint.

import { NextResponse } from "next/server";
import {
  setStudioSession,
  validateEntryToken
} from "@/lib/studio/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();

  if (!token) {
    return NextResponse.redirect(new URL("/studio?failed=1", req.url), {
      status: 303
    });
  }

  const merchant = await validateEntryToken(token);
  if (!merchant) {
    return NextResponse.redirect(new URL("/studio?failed=1", req.url), {
      status: 303
    });
  }

  await setStudioSession(token);
  return NextResponse.redirect(new URL("/studio/home", req.url), {
    status: 303
  });
}
