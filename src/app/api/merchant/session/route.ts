// POST /api/merchant/session
//
// Interim login stub. Sets the network_merchant_slug cookie so
// merchant-scoped endpoints (review respond, notebook, edit gates)
// can be tested end-to-end before real auth lands.
//
// Contract:
//   POST { slug: string, password: string }
//   → sets cookie, returns { ok: true, slug }
//
// SECURITY POSTURE: this stub trusts the client-supplied slug when
// process.env.NETWORK_SESSION_STUB === "1". Never enable in
// production. Real auth (WhatsApp OTP + password verification against
// hammerex_trade_off_listings.password_hash) replaces this endpoint.

import { NextResponse } from "next/server";
import { MERCHANT_COOKIE, MERCHANT_COOKIE_MAX_AGE_S } from "@/lib/merchantSession";

const STUB_ENABLED = process.env.NETWORK_SESSION_STUB === "1";

export async function POST(req: Request) {
  if (!STUB_ENABLED) {
    return NextResponse.json(
      { ok: false, error: "stub-disabled" },
      { status: 403 }
    );
  }

  let payload: { slug?: string };
  try {
    payload = (await req.json()) as { slug?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const slug = String(payload.slug ?? "").trim().toLowerCase();
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid-slug" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, slug });
  res.cookies.set({
    name: MERCHANT_COOKIE,
    value: slug,
    maxAge: MERCHANT_COOKIE_MAX_AGE_S,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  return res;
}

/** DELETE /api/merchant/session — logout (clears the cookie). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(MERCHANT_COOKIE);
  return res;
}
