// NEX Auth · POST /api/b/[slug]/customer/login (Philip 2026-08-14).
//
// Customer login. In dev/local: email is the identity (no verification).
// In production: an email-verification adapter (Resend) can be added later.
//
// Sets a signed cookie · returns the customer identity.

import { NextResponse } from "next/server";
import { ensureSeeded, getBusiness } from "@/lib/nex/business-context";
import { upsertCustomer } from "@/lib/nex/auth/accounts";
import { signSession, serializeSessionCookie } from "@/lib/nex/auth/session-signer";
import { SESSION_COOKIE_NAME } from "@/lib/nex/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  if (!biz) return NextResponse.json({ ok: false, error: "unknown-business" }, { status: 404 });

  let body: { email?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }
  const email = (body.email ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }

  const cust = upsertCustomer(email, slug);
  const cookieValue = signSession({
    role: "customer",
    businessSlug: slug,
    customerId: cust.customerId,
    email: cust.email
  });

  const res = NextResponse.json({
    ok: true,
    customer: { customerId: cust.customerId, email: cust.email, businessSlug: slug }
  });
  res.headers.append("set-cookie", serializeSessionCookie(SESSION_COOKIE_NAME, cookieValue));
  return res;
}
