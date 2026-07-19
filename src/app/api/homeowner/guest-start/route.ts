// POST /api/homeowner/guest-start
//
// Called when a visitor types their SiteBook nickname on the landing
// and clicks "Create my SiteBook". Sets the guest cookie + redirects
// (or returns JSON) so they land inside /sitebook without signup.
//
// Body: { nickname: string }
// Response: { ok: true, redirect: "/sitebook" }

import { NextResponse } from "next/server";
import { setGuestSession } from "@/lib/homeowners/guestSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { nickname?: string } | null;
  const nickname = body?.nickname?.trim();
  if (!nickname || nickname.length < 2) {
    return NextResponse.json({ ok: false, error: "invalid-nickname" }, { status: 400 });
  }
  await setGuestSession(nickname);
  return NextResponse.json({ ok: true, redirect: "/sitebook" });
}
