// src/app/api/nex/auth/logout/route.ts
//
// Founder Phase 10 · P10-3 · Logout.
// POST revokes the current session and clears the cookie.

import { NextResponse } from "next/server";
import { revokeSession, sessionCookieName } from "@/lib/nex/identity-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split(/;\s*/).filter(Boolean).map((p) => {
      const idx = p.indexOf("=");
      return idx > 0 ? [p.slice(0, idx), decodeURIComponent(p.slice(idx + 1))] : [p, ""];
    }),
  );
  const token = cookies[sessionCookieName()];
  await revokeSession(token ?? null);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName(), "", { path: "/", expires: new Date(0) });
  return res;
}
