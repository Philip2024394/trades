// src/app/api/nex/auth/signup/route.ts
//
// Founder Phase 10 · P10-3 · Anonymous signup.
// POST body: { display_name? } → creates account + issues session cookie.
// No password required · opaque session token · 30-day sliding expiry.

import { NextResponse } from "next/server";
import { createAccount, issueSession, sessionCookieName, sha16 } from "@/lib/nex/identity-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty */ }
  const display_name = typeof body.display_name === "string" ? body.display_name : null;
  try {
    const account = await createAccount({ display_name });
    const ipHash = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const uaHash = req.headers.get("user-agent") ?? null;
    const session = await issueSession(account.user_id, {
      ip_hash_16: ipHash ? sha16(ipHash) : null,
      user_agent_hash_16: uaHash ? sha16(uaHash) : null,
    });
    const res = NextResponse.json({
      user_id: account.user_id,
      display_name: account.display_name,
      created_at: account.created_at,
      session: {
        session_id: session.session_id,
        expires_at: session.expires_at,
      },
      note: "Opaque session cookie issued. Use /api/nex/auth/session to inspect.",
    });
    res.cookies.set(sessionCookieName(), session.cookie_token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(session.expires_at),
    });
    return res;
  } catch (e) {
    return NextResponse.json({
      error: "signup_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
