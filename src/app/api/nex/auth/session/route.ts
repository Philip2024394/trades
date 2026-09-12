// src/app/api/nex/auth/session/route.ts
//
// Founder Phase 10 · P10-3 · Session introspection.
// GET returns the current user (or anonymous) based on the cookie.

import { NextResponse } from "next/server";
import { resolveSession, sessionCookieName } from "@/lib/nex/identity-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split(/;\s*/).filter(Boolean).map((p) => {
      const idx = p.indexOf("=");
      return idx > 0 ? [p.slice(0, idx), decodeURIComponent(p.slice(idx + 1))] : [p, ""];
    }),
  );
  const token = cookies[sessionCookieName()];
  const resolved = await resolveSession(token ?? null);
  if (!resolved || !resolved.user_id) {
    return NextResponse.json({ authenticated: false, user_id: null });
  }
  return NextResponse.json({
    authenticated: true,
    user_id: resolved.user_id,
    account: resolved.account,
    session_id: resolved.session_id,
  });
}
