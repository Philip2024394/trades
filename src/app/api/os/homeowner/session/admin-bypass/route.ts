// POST /api/os/homeowner/session/admin-bypass
//
// Dev-only shortcut. Set HOMEOWNER_ADMIN_BYPASS_SECRET to a long random
// string in the environment, then any client that knows the secret can
// sign in as any email — no magic link, no waiting on Resend.
//
// If the secret is unset, this route returns 404 so its existence isn't
// leaked in production. Bypass usage is logged so it's auditable.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  HOMEOWNER_COOKIE,
  HOMEOWNER_COOKIE_OPTIONS,
  buildSessionCookie
} from "@/lib/os/homeownerSession";
import { findOrCreatePersonParty } from "@/lib/os/parties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSecret(): string | null {
  const s = process.env.HOMEOWNER_ADMIN_BYPASS_SECRET;
  if (!s || s.length < 24) return null;
  return s;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const configured = readSecret();
  if (!configured) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 404 });
  }

  let body: { email?: string; secret?: string; next?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const provided = body.secret ?? "";
  const nextParam = body.next ?? "/home";
  const safeNext = nextParam.startsWith("/") ? nextParam : "/home";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (!safeEqual(provided, configured)) {
    console.warn("[admin-bypass] wrong secret attempt", { email });
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const displayName = email.split("@")[0] || "Homeowner";
  const party = await findOrCreatePersonParty({ displayName, email });

  const cookieValue = buildSessionCookie(party.id);
  console.info("[admin-bypass] session minted", { partyId: party.id, email });

  const res = NextResponse.json({ ok: true, partyId: party.id, next: safeNext });
  res.cookies.set(HOMEOWNER_COOKIE, cookieValue, HOMEOWNER_COOKIE_OPTIONS);
  return res;
}
