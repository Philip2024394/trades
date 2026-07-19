// POST /api/homeowner/activate
//
// Convert a guest session (cookie with just a SiteBook nickname) into
// a real hammerex_homeowners account.
//
// Body: { firstName, email, password, postcode?, whatsappNumber? }
// The nickname is read from the guest cookie server-side — client
// cannot forge it because we don't accept it in the body.
//
// On success:
//   - Real account created (house_nickname = guest nickname, slug generated)
//   - Real session cookie set
//   - Guest cookie cleared
//   - 200 { ok: true, homeownerId, slug }

import { NextResponse } from "next/server";
import { getGuestSession, clearGuestSession } from "@/lib/homeowners/guestSession";
import { signupHomeowner } from "@/lib/homeowners/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guest = await getGuestSession();
  if (!guest) return NextResponse.json({ ok: false, error: "no-guest" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    firstName?: string; email?: string; password?: string;
    postcode?: string; whatsappNumber?: string;
  } | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });

  const res = await signupHomeowner({
    email:          (body.email || "").trim(),
    password:       body.password || "",
    firstName:      (body.firstName || "").trim(),
    postcode:       body.postcode || undefined,
    whatsappNumber: body.whatsappNumber || undefined,
    houseNickname:  guest.nickname   // authoritative — from the guest cookie
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  // Real session cookie was set inside signupHomeowner; clear the
  // guest one so we don't drift into split-state.
  await clearGuestSession();

  return NextResponse.json({
    ok:          true,
    homeownerId: res.homeowner.id,
    slug:        res.homeowner.slug
  });
}
