// NEX Auth · POST /api/nex/owner/login (Philip 2026-08-14).
//
// Owner login. Email must be on the owner-account registry for the
// requested businessSlug. Cross-business owner access is checked at
// SESSION MINT time here + at REQUEST time in every route (defence in depth).

import { NextResponse } from "next/server";
import { ensureOwnerAccountsSeeded, ownerCanAccess, getOwner } from "@/lib/nex/auth/accounts";
import { signSession, serializeSessionCookie } from "@/lib/nex/auth/session-signer";
import { SESSION_COOKIE_NAME } from "@/lib/nex/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  ensureOwnerAccountsSeeded();

  let body: { email?: string; businessSlug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const email = (body.email ?? "").trim().toLowerCase();
  const slug  = (body.businessSlug ?? "").trim();
  if (!email || !slug) return NextResponse.json({ ok: false, error: "missing-fields" }, { status: 400 });

  // ── Defence-in-depth: owner must genuinely own the target business ─
  if (!ownerCanAccess(email, slug)) {
    return NextResponse.json({ ok: false, error: "owner-not-authorised-for-business" }, { status: 403 });
  }
  const owner = getOwner(email);
  if (!owner) return NextResponse.json({ ok: false, error: "owner-not-found" }, { status: 403 });

  const cookieValue = signSession({
    role: "owner",
    businessSlug: slug,
    ownerAccountId: owner.ownerAccountId,
    email: owner.email
  });

  const res = NextResponse.json({
    ok: true,
    owner: {
      ownerAccountId: owner.ownerAccountId,
      email: owner.email,
      businessSlug: slug,
      allBusinesses: [...owner.ownedBusinesses]
    }
  });
  res.headers.append("set-cookie", serializeSessionCookie(SESSION_COOKIE_NAME, cookieValue));
  return res;
}
